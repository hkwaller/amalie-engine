/**
 * Game state helpers and utilities
 */

import type {
  GameState,
  GamePhase,
  Player,
  PlayerAnswer,
  CurrentQuestionState,
  QuizGameConfig,
  ScoreboardEntry,
  Question,
  PlayerPowerupState,
} from '../types'

/**
 * Create initial game state
 */
export function createInitialGameState(roomCode: string, config: QuizGameConfig): GameState {
  return {
    phase: 'lobby',
    roomCode,
    config,
    players: new Map(),
    currentQuestion: null,
    questionHistory: [],
  }
}

/**
 * Create a new player
 */
export function createPlayer(id: string, name: string): Player {
  return {
    id,
    name,
    score: 0,
    streak: 0,
    isConnected: true,
    joinedAt: Date.now(),
    powerups: createInitialPowerupState(),
  }
}

/**
 * Create initial power-up state
 */
export function createInitialPowerupState(): PlayerPowerupState {
  return {
    available: [],
    active: null,
    used: [],
  }
}

/**
 * Create current question state
 */
export function createCurrentQuestionState(
  question: Question,
  questionIndex: number,
  totalQuestions: number,
): CurrentQuestionState {
  return {
    question,
    questionIndex,
    totalQuestions,
    startedAt: Date.now(),
    answers: new Map(),
  }
}

/**
 * Calculate scoreboard from players
 */
export function calculateScoreboard(
  players: Map<string, Player>,
  currentAnswers?: Map<string, PlayerAnswer>,
): ScoreboardEntry[] {
  const entries: ScoreboardEntry[] = Array.from(players.values())
    .map((player) => {
      const answer = currentAnswers?.get(player.id)
      return {
        playerId: player.id,
        playerName: player.name,
        score: player.score,
        rank: 0, // Will be calculated below
        streak: player.streak,
        lastAnswerCorrect: answer?.isCorrect,
        pointsThisRound: answer?.pointsAwarded,
      }
    })
    .sort((a, b) => b.score - a.score)

  // Assign ranks (handle ties)
  let currentRank = 1
  for (let i = 0; i < entries.length; i++) {
    if (i > 0 && entries[i].score < entries[i - 1].score) {
      currentRank = i + 1
    }
    entries[i].rank = currentRank
  }

  return entries
}

/**
 * Check if all players have answered
 */
export function allPlayersAnswered(
  players: Map<string, Player>,
  answers: Map<string, PlayerAnswer>,
): boolean {
  const connectedPlayers = Array.from(players.values()).filter((p) => p.isConnected)
  return connectedPlayers.every((player) => answers.has(player.id))
}

/**
 * Check if game phase transition is valid
 */
export function isValidPhaseTransition(from: GamePhase, to: GamePhase): boolean {
  const validTransitions: Record<GamePhase, GamePhase[]> = {
    lobby: ['playing'],
    playing: ['revealing', 'finished'],
    revealing: ['playing', 'finished'],
    finished: ['lobby'], // For rematch
  }

  return validTransitions[from]?.includes(to) ?? false
}

/**
 * Get player by ID from state
 */
export function getPlayer(state: GameState, playerId: string): Player | undefined {
  return state.players.get(playerId)
}

/**
 * Update player in state (immutable)
 */
export function updatePlayer(
  state: GameState,
  playerId: string,
  updates: Partial<Player>,
): GameState {
  const player = state.players.get(playerId)
  if (!player) return state

  const newPlayers = new Map(state.players)
  newPlayers.set(playerId, { ...player, ...updates })

  return { ...state, players: newPlayers }
}

/**
 * Add player to state (immutable)
 */
export function addPlayerToState(state: GameState, player: Player): GameState {
  const newPlayers = new Map(state.players)
  newPlayers.set(player.id, player)

  return { ...state, players: newPlayers }
}

/**
 * Remove player from state (immutable)
 */
export function removePlayerFromState(state: GameState, playerId: string): GameState {
  const newPlayers = new Map(state.players)
  newPlayers.delete(playerId)

  return { ...state, players: newPlayers }
}

/**
 * Reset game state for rematch (keeps players, resets scores)
 */
export function resetForRematch(state: GameState): GameState {
  const newPlayers = new Map<string, Player>()

  state.players.forEach((player, id) => {
    newPlayers.set(id, {
      ...player,
      score: 0,
      streak: 0,
      rank: undefined,
      powerups: createInitialPowerupState(),
    })
  })

  return {
    ...state,
    phase: 'lobby',
    players: newPlayers,
    currentQuestion: null,
    questionHistory: [],
    startedAt: undefined,
    finishedAt: undefined,
  }
}

/**
 * Serialize game state for storage (converts Maps to arrays)
 */
export function serializeGameState(state: GameState): string {
  const serializable = {
    ...state,
    players: Array.from(state.players.entries()),
    currentQuestion: state.currentQuestion
      ? {
          ...state.currentQuestion,
          answers: Array.from(state.currentQuestion.answers.entries()),
        }
      : null,
  }
  return JSON.stringify(serializable)
}

/**
 * Deserialize game state from storage
 */
export function deserializeGameState(json: string): GameState {
  const parsed = JSON.parse(json)
  return {
    ...parsed,
    players: new Map(parsed.players),
    currentQuestion: parsed.currentQuestion
      ? {
          ...parsed.currentQuestion,
          answers: new Map(parsed.currentQuestion.answers),
        }
      : null,
  }
}
