/**
 * useQuizHost - React hook for hosting a quiz game
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type {
  UseQuizHostOptions,
  UseQuizHostReturn,
  GamePhase,
  Player,
  ScoreboardEntry,
  PlayerAnswer,
  CurrentQuestionState,
  Question,
  QuestionProvider,
  GameMessage,
} from '../types'
import { createGameMachine, GameMachine } from '../core/game-machine'
import { createAnswerTracker, AnswerTracker } from '../core/answer-tracker'
import { createScoringEngine, ScoringEngine } from '../scoring/engine'
import { validateAnswer } from '../validation/text-matcher'
import {
  createPowerupManager,
  PowerupManager,
  applyPowerupToScore,
  shouldProtectStreak,
  consumeActivePowerup,
} from '../powerups/manager'
import { createRealtimeAdapter, RealtimeAdapter } from '../realtime/adapter'
import {
  createGameStartMessage,
  createQuestionShowMessage,
  createQuestionReplacedMessage,
  createAnswerRevealMessage,
  createScoreboardUpdateMessage,
  createGameEndMessage,
  createGameRematchMessage,
  createPlayerStateMessage,
  createPlayerKickedMessage,
  createAnswerRejectedMessage,
} from '../realtime/messages'
import { generateJoinUrl, generateRoomCode } from '../core/room'
import { createThrottledBackup, clearGameBackup } from '../storage/local-backup'
import { filterQuestions, extractCategories } from '../questions/provider'

/**
 * Hook for hosting a quiz game
 */
export function useQuizHost(options: UseQuizHostOptions): UseQuizHostReturn {
  const {
    supabaseClient,
    config,
    questions: questionSource,
    baseUrl = '',
    onGameEnd,
    onRematch,
  } = options

  // Generate room code once
  const roomCodeRef = useRef(config.roomCode || generateRoomCode())
  const roomCode = roomCodeRef.current

  // Core engine refs
  const gameMachineRef = useRef<GameMachine | null>(null)
  const answerTrackerRef = useRef<AnswerTracker | null>(null)
  const scoringEngineRef = useRef<ScoringEngine | null>(null)
  const powerupManagerRef = useRef<PowerupManager | null>(null)
  const realtimeRef = useRef<RealtimeAdapter | null>(null)
  const backupRef = useRef<ReturnType<typeof createThrottledBackup> | null>(null)

  // Questions state
  const [allQuestions, setAllQuestions] = useState<Question[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [availableCategories, setAvailableCategories] = useState<string[]>([])

  // Game state
  const [gameState, setGameState] = useState<GamePhase>('lobby')
  const [currentQuestion, setCurrentQuestion] = useState<CurrentQuestionState | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [scoreboard, setScoreboard] = useState<ScoreboardEntry[]>([])
  const [answers, setAnswers] = useState<PlayerAnswer[]>([])

  // Round state
  const [allPlayersAnswered, setAllPlayersAnswered] = useState(false)

  // Connection state
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Initialize engines
  useEffect(() => {
    gameMachineRef.current = createGameMachine({ ...config, roomCode })
    answerTrackerRef.current = createAnswerTracker({
      answerMode: config.answerMode ?? 'all-players',
      allowLateAnswers: config.allowLateAnswers ?? false,
      timeLimit: config.questionTimeLimit,
    })
    scoringEngineRef.current = createScoringEngine(config.scoring)
    powerupManagerRef.current = createPowerupManager(config.powerups ?? [])
    backupRef.current = createThrottledBackup(roomCode)

    return () => {
      backupRef.current?.cancel()
    }
  }, [config, roomCode])

  // Load questions
  useEffect(() => {
    async function loadQuestions() {
      let questions: Question[]

      if (Array.isArray(questionSource)) {
        questions = questionSource
      } else {
        // It's a QuestionProvider
        const provider = questionSource as QuestionProvider
        questions = await provider.getQuestions()
      }

      setAllQuestions(questions)
      setAvailableCategories(extractCategories(questions))
    }

    loadQuestions().catch((err) => {
      setError(new Error(`Failed to load questions: ${err.message}`))
    })
  }, [questionSource])

  // Initialize realtime
  useEffect(() => {
    const adapter = createRealtimeAdapter(supabaseClient, {
      roomCode,
      isHost: true,
    })
    realtimeRef.current = adapter

    // Handle messages
    adapter.onMessage((message: GameMessage) => {
      handlePlayerMessage(message)
    })

    // Handle connection changes
    adapter.onConnectionChange((connected) => {
      setIsConnected(connected)
    })

    // Handle errors
    adapter.onError((err) => {
      setError(err)
    })

    // Connect
    adapter
      .connect()
      .then(() => {
        // Track host presence
        adapter.trackPresence({
          playerId: 'host',
          playerName: 'Host',
          joinedAt: Date.now(),
        })
      })
      .catch((err) => {
        setError(err)
      })

    return () => {
      adapter.disconnect()
    }
  }, [supabaseClient, roomCode])

  // Handle incoming player messages
  const handlePlayerMessage = useCallback(
    (message: GameMessage) => {
      const gameMachine = gameMachineRef.current
      const answerTracker = answerTrackerRef.current
      const scoringEngine = scoringEngineRef.current
      const powerupManager = powerupManagerRef.current
      const realtime = realtimeRef.current

      if (!gameMachine || !realtime) return

      switch (message.type) {
        case 'player:join': {
          const { playerId, playerName } = message.payload
          const player = gameMachine.addPlayer(playerId, playerName)
          if (player) {
            powerupManager?.initPlayer(playerId)
            setPlayers(gameMachine.getPlayers())
            setScoreboard(gameMachine.getScoreboard())
          }
          break
        }

        case 'player:rejoin': {
          const { playerId } = message.payload
          const player = gameMachine.getPlayer(playerId)
          if (player) {
            player.isConnected = true
            // Send current state to rejoining player
            realtime.sendDirect(
              playerId,
              createPlayerStateMessage(
                player,
                gameMachine.getCurrentQuestion(),
                gameMachine.getPhase(),
              ),
            )
            setPlayers(gameMachine.getPlayers())
          }
          break
        }

        case 'player:answer': {
          if (!answerTracker || !scoringEngine) break

          const answer = message.payload
          const result = answerTracker.submitAnswer({
            playerId: answer.playerId,
            questionId: answer.questionId,
            answer: answer.answer,
            submittedAt: answer.timestamp,
          })

          if (result.rejected) {
            // Notify player of rejection
            realtime.sendDirect(
              answer.playerId,
              createAnswerRejectedMessage(answer.playerId, answer.questionId, result.rejectReason!),
            )
          } else if (result.playerAnswer) {
            // Validate and score the answer
            const currentQ = gameMachine.getCurrentQuestion()
            if (currentQ) {
              const validation = validateAnswer(result.playerAnswer.answer, currentQ.question)
              const player = gameMachine.getPlayer(answer.playerId)

              if (player) {
                const powerupState = powerupManager?.getPlayerState(answer.playerId)
                let pointsAwarded = 0
                let newStreak = player.streak

                if (validation.isCorrect) {
                  const scoreResult = scoringEngine.calculateScore({
                    question: currentQ.question,
                    answer: result.playerAnswer,
                    isCorrect: true,
                    currentStreak: player.streak,
                    timeLimit: config.questionTimeLimit,
                  })

                  pointsAwarded = powerupState
                    ? applyPowerupToScore(powerupState, scoreResult.totalPoints)
                    : scoreResult.totalPoints

                  newStreak = player.streak + 1
                } else {
                  // Wrong answer - check for shield
                  if (powerupState && shouldProtectStreak(powerupState)) {
                    newStreak = player.streak // Keep streak
                  } else {
                    newStreak = 0 // Reset streak
                  }
                }

                // Update answer with results
                answerTracker.updateAnswer(answer.playerId, {
                  isCorrect: validation.isCorrect,
                  pointsAwarded,
                })

                // Update player score
                gameMachine.updatePlayerScore(
                  answer.playerId,
                  player.score + pointsAwarded,
                  newStreak,
                )

                // Consume active power-up
                if (powerupState && powerupManager) {
                  // Consume the power-up (manager handles state updates)
                  consumeActivePowerup(powerupState)
                }
              }
            }

            const updatedAnswers = answerTracker.getAnswersInOrder()
            setAnswers(updatedAnswers)

            // Check if all connected players have answered
            const connectedPlayers = gameMachine.getPlayers().filter((p) => p.isConnected)
            const allAnswered = connectedPlayers.every((p) =>
              updatedAnswers.some((a) => a.playerId === p.id),
            )

            if (allAnswered) {
              setAllPlayersAnswered(true)

              // Auto-advance to reveal if configured
              if (config.autoAdvanceOnAllAnswered) {
                // Use setTimeout to avoid state update conflicts
                setTimeout(() => {
                  performRevealAnswer()
                }, 0)
              }
            }
          }
          break
        }

        case 'player:powerup': {
          const { playerId, powerupId } = message.payload
          powerupManager?.activateForPlayer(playerId, powerupId)
          break
        }
      }
    },
    [config.questionTimeLimit],
  )

  // Actions
  const startGame = useCallback(async () => {
    const gameMachine = gameMachineRef.current
    const realtime = realtimeRef.current
    if (!gameMachine || !realtime) return

    // Get filtered questions
    let gameQuestions =
      selectedCategories.length > 0
        ? filterQuestions(allQuestions, { categories: selectedCategories })
        : allQuestions

    // Apply shuffle if configured
    if (config.shuffleQuestions) {
      gameQuestions = filterQuestions(gameQuestions, { shuffle: true })
    }

    // Limit questions if configured
    if (config.questionsPerGame) {
      gameQuestions = gameQuestions.slice(0, config.questionsPerGame)
    }

    if (gameMachine.startGame(gameQuestions)) {
      setGameState('playing')

      // Broadcast game start
      await realtime.broadcast(createGameStartMessage(roomCode, config, gameQuestions.length))

      // Show first question
      await nextQuestion()
    }
  }, [allQuestions, selectedCategories, config, roomCode])

  const nextQuestion = useCallback(async () => {
    const gameMachine = gameMachineRef.current
    const answerTracker = answerTrackerRef.current
    const realtime = realtimeRef.current
    if (!gameMachine || !answerTracker || !realtime) return

    const question = gameMachine.nextQuestion()
    if (!question) {
      // No more questions - end game
      await endGame()
      return
    }

    // Start answer tracking
    answerTracker.startQuestion()
    setAnswers([])
    setAllPlayersAnswered(false)

    const current = gameMachine.getCurrentQuestion()
    setCurrentQuestion(current)

    // Broadcast question
    await realtime.broadcast(
      createQuestionShowMessage(
        question,
        current!.questionIndex,
        current!.totalQuestions,
        question.timeLimit ?? config.questionTimeLimit,
      ),
    )

    // Save backup
    const state = gameMachine.getState()
    backupRef.current?.backup(state.gameState, state.questions, state.currentQuestionIndex)
  }, [config.questionTimeLimit])

  const replaceQuestion = useCallback(async () => {
    const gameMachine = gameMachineRef.current
    const answerTracker = answerTrackerRef.current
    const realtime = realtimeRef.current
    if (!gameMachine || !answerTracker || !realtime) return

    const current = gameMachine.getCurrentQuestion()
    if (!current) return

    // Find a replacement question (not used yet)
    const usedIds = gameMachine.getState().gameState.questionHistory.map((q: Question) => q.id)
    usedIds.push(current.question.id)

    const available = allQuestions.filter((q) => !usedIds.includes(q.id))
    if (available.length === 0) return

    // Pick random replacement
    const replacement = available[Math.floor(Math.random() * available.length)]
    gameMachine.replaceQuestion(replacement)

    // Reset answer tracking
    answerTracker.startQuestion()
    setAnswers([])
    setAllPlayersAnswered(false)

    const newCurrent = gameMachine.getCurrentQuestion()
    setCurrentQuestion(newCurrent)

    // Broadcast replacement
    await realtime.broadcast(
      createQuestionReplacedMessage(
        replacement,
        newCurrent!.questionIndex,
        newCurrent!.totalQuestions,
        replacement.timeLimit ?? config.questionTimeLimit,
      ),
    )
  }, [allQuestions, config.questionTimeLimit])

  // Internal reveal function that can be called from message handler
  const performRevealAnswer = useCallback(() => {
    const gameMachine = gameMachineRef.current
    const answerTracker = answerTrackerRef.current
    const realtime = realtimeRef.current
    if (!gameMachine || !answerTracker || !realtime) return

    gameMachine.revealAnswer()
    const current = gameMachine.getCurrentQuestion()
    const board = gameMachine.getScoreboard()

    setGameState('revealing')
    setScoreboard(board)
    setPlayers(gameMachine.getPlayers())
    setAllPlayersAnswered(false) // Reset for next round

    // Broadcast answer reveal
    if (current) {
      realtime.broadcast(
        createAnswerRevealMessage(current.question, answerTracker.getAnswersInOrder(), board),
      )
    }

    // Consume all active power-ups
    powerupManagerRef.current?.consumeAllActive()
  }, [])

  // Public reveal function
  const revealAnswer = useCallback(() => {
    performRevealAnswer()
  }, [performRevealAnswer])

  // End current round early (force reveal)
  const endRound = useCallback(() => {
    performRevealAnswer()
  }, [performRevealAnswer])

  const endGame = useCallback(async () => {
    const gameMachine = gameMachineRef.current
    const realtime = realtimeRef.current
    if (!gameMachine || !realtime) return

    const finalScoreboard = gameMachine.endGame()
    const state = gameMachine.getState()
    const duration = (state.gameState.finishedAt ?? Date.now()) - (state.gameState.startedAt ?? 0)

    setGameState('finished')
    setScoreboard(finalScoreboard)

    // Broadcast game end
    await realtime.broadcast(
      createGameEndMessage(finalScoreboard, state.questions.length, duration),
    )

    // Clear backup
    clearGameBackup(roomCode)

    // Notify callback
    onGameEnd?.(finalScoreboard)
  }, [roomCode, onGameEnd])

  const rematch = useCallback(async () => {
    const gameMachine = gameMachineRef.current
    const realtime = realtimeRef.current
    if (!gameMachine || !realtime) return

    const previousResults = gameMachine.getScoreboard()

    // Notify callback before reset
    onRematch?.(previousResults)

    // Reset game
    gameMachine.rematch()
    powerupManagerRef.current?.reset()

    setGameState('lobby')
    setCurrentQuestion(null)
    setAnswers([])
    setScoreboard([])
    setAllPlayersAnswered(false)
    setPlayers(gameMachine.getPlayers())

    // Broadcast rematch
    await realtime.broadcast(createGameRematchMessage(previousResults))
  }, [onRematch])

  const kickPlayer = useCallback((playerId: string) => {
    const gameMachine = gameMachineRef.current
    const realtime = realtimeRef.current
    if (!gameMachine || !realtime) return

    // Send kick notification
    realtime.sendDirect(playerId, createPlayerKickedMessage(playerId))

    // Remove from game
    gameMachine.kickPlayer(playerId)
    powerupManagerRef.current?.removePlayer(playerId)

    setPlayers(gameMachine.getPlayers())
    setScoreboard(gameMachine.getScoreboard())
  }, [])

  const adjustScore = useCallback((playerId: string, points: number) => {
    const gameMachine = gameMachineRef.current
    if (!gameMachine) return

    gameMachine.adjustScore(playerId, points)
    setPlayers(gameMachine.getPlayers())
    setScoreboard(gameMachine.getScoreboard())

    // Broadcast updated scoreboard
    realtimeRef.current?.broadcast(createScoreboardUpdateMessage(gameMachine.getScoreboard()))
  }, [])

  const addPlayer = useCallback((name: string) => {
    const gameMachine = gameMachineRef.current
    if (!gameMachine) return

    const playerId = `manual-${Date.now()}`
    gameMachine.addPlayer(playerId, name)
    powerupManagerRef.current?.initPlayer(playerId)

    setPlayers(gameMachine.getPlayers())
  }, [])

  const selectCategories = useCallback((categories: string[]) => {
    setSelectedCategories(categories)
  }, [])

  // Derived values
  const joinUrl = baseUrl ? generateJoinUrl(baseUrl, roomCode) : ''
  const currentCategory = currentQuestion?.question.category ?? null

  return {
    // State
    gameState,
    currentQuestion,
    currentCategory,
    players,
    scoreboard,
    answers,

    // Round state
    allPlayersAnswered,

    // Actions
    startGame,
    nextQuestion,
    replaceQuestion,
    revealAnswer,
    endRound,
    endGame,
    rematch,

    // Player management
    kickPlayer,
    adjustScore,
    addPlayer,

    // Room
    roomCode,
    joinUrl,

    // Categories
    availableCategories,
    selectCategories,

    // Connection
    isConnected,
    error,
  }
}
