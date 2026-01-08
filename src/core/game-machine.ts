/**
 * Game state machine - manages game flow (lobby -> playing -> revealing -> finished)
 */

import type {
  GameState,
  GamePhase,
  Question,
  Player,
  QuizGameConfig,
  CurrentQuestionState,
  PlayerAnswer,
  ScoreboardEntry,
} from '../types'
import {
  createInitialGameState,
  createPlayer,
  createCurrentQuestionState,
  calculateScoreboard,
  resetForRematch,
  isValidPhaseTransition,
} from './game-state'
import { generateRoomCode } from './room'

export type GameEvent =
  | { type: 'PLAYER_JOIN'; playerId: string; playerName: string }
  | { type: 'PLAYER_LEAVE'; playerId: string }
  | { type: 'PLAYER_RECONNECT'; playerId: string }
  | { type: 'START_GAME'; questions: Question[] }
  | { type: 'SHOW_QUESTION'; question: Question; index: number; total: number }
  | { type: 'PLAYER_ANSWER'; playerId: string; answer: PlayerAnswer }
  | { type: 'END_QUESTION' }
  | { type: 'REVEAL_ANSWER' }
  | { type: 'NEXT_QUESTION'; question: Question; index: number; total: number }
  | { type: 'END_GAME' }
  | { type: 'REMATCH' }
  | { type: 'KICK_PLAYER'; playerId: string }
  | { type: 'ADJUST_SCORE'; playerId: string; points: number }
  | { type: 'UPDATE_PLAYER_SCORE'; playerId: string; score: number; streak: number }

export interface GameMachineState {
  gameState: GameState
  questions: Question[]
  currentQuestionIndex: number
}

export type GameEventHandler = (event: GameEvent, state: GameMachineState) => void

export class GameMachine {
  private state: GameMachineState
  private listeners: Set<GameEventHandler> = new Set()

  constructor(config: QuizGameConfig) {
    const roomCode = config.roomCode || generateRoomCode()
    this.state = {
      gameState: createInitialGameState(roomCode, config),
      questions: [],
      currentQuestionIndex: -1,
    }
  }

  /**
   * Get current state
   */
  getState(): GameMachineState {
    return this.state
  }

  /**
   * Get game phase
   */
  getPhase(): GamePhase {
    return this.state.gameState.phase
  }

  /**
   * Get room code
   */
  getRoomCode(): string {
    return this.state.gameState.roomCode
  }

  /**
   * Subscribe to state changes
   */
  subscribe(handler: GameEventHandler): () => void {
    this.listeners.add(handler)
    return () => this.listeners.delete(handler)
  }

  /**
   * Emit event to listeners
   */
  private emit(event: GameEvent): void {
    this.listeners.forEach((handler) => handler(event, this.state))
  }

  /**
   * Transition to a new phase
   */
  private transitionTo(phase: GamePhase): boolean {
    if (!isValidPhaseTransition(this.state.gameState.phase, phase)) {
      console.warn(`Invalid phase transition: ${this.state.gameState.phase} -> ${phase}`)
      return false
    }
    this.state.gameState.phase = phase
    return true
  }

  /**
   * Add a player to the game
   */
  addPlayer(playerId: string, playerName: string): Player | null {
    if (this.state.gameState.phase !== 'lobby') {
      // Allow rejoins during game
      const existingPlayer = this.state.gameState.players.get(playerId)
      if (existingPlayer) {
        existingPlayer.isConnected = true
        this.emit({ type: 'PLAYER_RECONNECT', playerId })
        return existingPlayer
      }
      return null
    }

    const player = createPlayer(playerId, playerName)
    this.state.gameState.players.set(playerId, player)
    this.emit({ type: 'PLAYER_JOIN', playerId, playerName })
    return player
  }

  /**
   * Remove a player from the game
   */
  removePlayer(playerId: string): void {
    const player = this.state.gameState.players.get(playerId)
    if (player) {
      player.isConnected = false
      this.emit({ type: 'PLAYER_LEAVE', playerId })
    }
  }

  /**
   * Kick a player (remove completely)
   */
  kickPlayer(playerId: string): void {
    this.state.gameState.players.delete(playerId)
    this.emit({ type: 'KICK_PLAYER', playerId })
  }

  /**
   * Start the game
   */
  startGame(questions: Question[]): boolean {
    if (this.state.gameState.phase !== 'lobby') {
      return false
    }

    if (questions.length === 0) {
      console.warn('Cannot start game with no questions')
      return false
    }

    if (this.state.gameState.players.size === 0) {
      console.warn('Cannot start game with no players')
      return false
    }

    this.state.questions = [...questions]
    this.state.currentQuestionIndex = -1
    this.state.gameState.startedAt = Date.now()
    this.transitionTo('playing')
    this.emit({ type: 'START_GAME', questions })

    return true
  }

  /**
   * Show next question
   */
  nextQuestion(): Question | null {
    if (this.state.gameState.phase !== 'playing' && this.state.gameState.phase !== 'revealing') {
      return null
    }

    const nextIndex = this.state.currentQuestionIndex + 1
    if (nextIndex >= this.state.questions.length) {
      return null
    }

    // Ensure we're in playing phase
    if (this.state.gameState.phase === 'revealing') {
      this.state.gameState.phase = 'playing'
    }

    this.state.currentQuestionIndex = nextIndex
    const question = this.state.questions[nextIndex]
    const total = this.state.questions.length

    this.state.gameState.currentQuestion = createCurrentQuestionState(question, nextIndex, total)

    this.emit({
      type: 'SHOW_QUESTION',
      question,
      index: nextIndex,
      total,
    })

    return question
  }

  /**
   * Record a player's answer
   */
  recordAnswer(answer: PlayerAnswer): void {
    const currentQuestion = this.state.gameState.currentQuestion
    if (!currentQuestion) {
      console.warn('No current question to record answer for')
      return
    }

    currentQuestion.answers.set(answer.playerId, answer)
    this.emit({ type: 'PLAYER_ANSWER', playerId: answer.playerId, answer })
  }

  /**
   * End the current question
   */
  endQuestion(): void {
    if (this.state.gameState.phase !== 'playing') {
      return
    }

    this.emit({ type: 'END_QUESTION' })
  }

  /**
   * Reveal the answer (transition to revealing phase)
   */
  revealAnswer(): void {
    if (this.state.gameState.phase !== 'playing') {
      return
    }

    const currentQuestion = this.state.gameState.currentQuestion
    if (currentQuestion) {
      this.state.gameState.questionHistory.push(currentQuestion.question)
    }

    this.transitionTo('revealing')
    this.emit({ type: 'REVEAL_ANSWER' })
  }

  /**
   * Update player score
   */
  updatePlayerScore(playerId: string, score: number, streak: number): void {
    const player = this.state.gameState.players.get(playerId)
    if (player) {
      player.score = score
      player.streak = streak
      this.emit({ type: 'UPDATE_PLAYER_SCORE', playerId, score, streak })
    }
  }

  /**
   * Adjust player score manually
   */
  adjustScore(playerId: string, points: number): void {
    const player = this.state.gameState.players.get(playerId)
    if (player) {
      player.score += points
      this.emit({ type: 'ADJUST_SCORE', playerId, points })
    }
  }

  /**
   * End the game
   */
  endGame(): ScoreboardEntry[] {
    this.state.gameState.finishedAt = Date.now()
    this.state.gameState.phase = 'finished'

    const scoreboard = calculateScoreboard(
      this.state.gameState.players,
      this.state.gameState.currentQuestion?.answers,
    )

    this.emit({ type: 'END_GAME' })
    return scoreboard
  }

  /**
   * Start a rematch (reset scores, keep players)
   */
  rematch(): void {
    this.state.gameState = resetForRematch(this.state.gameState)
    this.state.currentQuestionIndex = -1
    this.emit({ type: 'REMATCH' })
  }

  /**
   * Replace current question with a new one
   */
  replaceQuestion(newQuestion: Question): void {
    if (!this.state.gameState.currentQuestion) {
      return
    }

    const index = this.state.currentQuestionIndex
    this.state.questions[index] = newQuestion

    this.state.gameState.currentQuestion = createCurrentQuestionState(
      newQuestion,
      index,
      this.state.questions.length,
    )

    this.emit({
      type: 'SHOW_QUESTION',
      question: newQuestion,
      index,
      total: this.state.questions.length,
    })
  }

  /**
   * Get current question
   */
  getCurrentQuestion(): CurrentQuestionState | null {
    return this.state.gameState.currentQuestion
  }

  /**
   * Get all players
   */
  getPlayers(): Player[] {
    return Array.from(this.state.gameState.players.values())
  }

  /**
   * Get player by ID
   */
  getPlayer(playerId: string): Player | undefined {
    return this.state.gameState.players.get(playerId)
  }

  /**
   * Get current scoreboard
   */
  getScoreboard(): ScoreboardEntry[] {
    return calculateScoreboard(
      this.state.gameState.players,
      this.state.gameState.currentQuestion?.answers,
    )
  }

  /**
   * Check if game has more questions
   */
  hasMoreQuestions(): boolean {
    return this.state.currentQuestionIndex < this.state.questions.length - 1
  }

  /**
   * Get progress info
   */
  getProgress(): { current: number; total: number } {
    return {
      current: this.state.currentQuestionIndex + 1,
      total: this.state.questions.length,
    }
  }

  /**
   * Get config
   */
  getConfig(): QuizGameConfig {
    return this.state.gameState.config
  }
}

/**
 * Create a new game machine
 */
export function createGameMachine(config: QuizGameConfig): GameMachine {
  return new GameMachine(config)
}
