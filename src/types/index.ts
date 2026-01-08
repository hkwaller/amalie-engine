// ============================================================
// Core Types for Quiz Engine
// ============================================================

// ------------------------------------------------------------
// Question Types
// ------------------------------------------------------------

export type AnswerType = 'multiple-choice' | 'text' | 'numeric'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type MediaType = 'image' | 'audio' | 'video'
export type MediaShowDuring = 'question' | 'answer' | 'both'

export interface QuestionMedia {
  type: MediaType
  url: string
  autoplay?: boolean
  showDuring?: MediaShowDuring
}

export interface Question<TExtra = Record<string, unknown>> {
  id: string
  category: string
  difficulty?: Difficulty
  text: string

  // Answer type determines validation logic
  answerType: AnswerType

  // For multiple choice
  options?: string[]
  correctOptionIndex?: number

  // For text answers (country names, song titles, etc.)
  correctText?: string
  acceptedAnswers?: string[] // aliases: ["USA", "United States", "US"]
  caseSensitive?: boolean

  // For numeric/estimation
  correctNumber?: number
  lowerBound?: number // for normalized scoring
  upperBound?: number

  // Media attachments
  media?: QuestionMedia

  // Flexible extra data - typed per quiz!
  extraInfo?: TExtra

  // Per-question overrides
  timeLimit?: number
  points?: number
}

// ------------------------------------------------------------
// Scoring Types
// ------------------------------------------------------------

export interface TimeBonusConfig {
  enabled: boolean
  maxBonus: number
  decayPerSecond: number
}

export interface StreakBonusConfig {
  enabled: boolean
  multiplierPerStreak: number
  maxMultiplier: number
}

export interface DifficultyMultipliers {
  easy: number
  medium: number
  hard: number
}

export interface EstimationScoringConfig {
  exactMatchBonus: number // bonus for exact answer (negative = points, for golf-style)
  capAtMax: boolean
  maxScore: number // worst possible score
  minScore: number // best possible (non-exact) score
}

export interface ScoringConfig {
  // For multiple-choice and text answers
  basePoints: number
  timeBonus?: TimeBonusConfig
  streakBonus?: StreakBonusConfig
  difficultyMultipliers?: DifficultyMultipliers

  // For numeric/estimation answers (golf scoring: lower = better)
  estimation?: EstimationScoringConfig
}

// ------------------------------------------------------------
// Power-up Types
// ------------------------------------------------------------

export type PowerupDuration = 'single-question' | 'permanent' | 'timed'
export type PowerupEffect =
  | 'double-points'
  | 'remove-two-wrong'
  | 'extra-time'
  | 'skip-question'
  | 'steal-points'
  | 'shield'
  | 'custom'

export interface PowerupDefinition {
  id: string
  name: string
  description?: string
  duration?: PowerupDuration
  effect?: PowerupEffect
  value?: number // effect magnitude (e.g., seconds for extra-time)
}

export interface PlayerPowerupState {
  available: PowerupDefinition[]
  active: PowerupDefinition | null
  used: string[] // IDs of used power-ups
}

// ------------------------------------------------------------
// Game Configuration
// ------------------------------------------------------------

export type AnswerMode = 'all-players' | 'first-to-answer'

export interface QuizGameConfig {
  roomCode?: string // or auto-generated
  scoring: ScoringConfig
  powerups?: PowerupDefinition[]

  // Game flow
  questionTimeLimit?: number // seconds, or null/undefined for untimed
  showAnswerAfterQuestion?: boolean
  autoAdvance?: boolean // host manually advances if false

  // Answer timing mode
  answerMode?: AnswerMode
  allowLateAnswers?: boolean

  // Round behavior
  autoAdvanceOnAllAnswered?: boolean // auto-reveal when all players have answered

  // Question settings
  shuffleQuestions?: boolean
  questionsPerGame?: number // limit number of questions (rounds)
}

// ------------------------------------------------------------
// Player Types
// ------------------------------------------------------------

export interface Player {
  id: string
  name: string
  score: number
  streak: number
  rank?: number
  isConnected: boolean
  joinedAt: number
  powerups: PlayerPowerupState
}

export interface PlayerAnswer {
  playerId: string
  questionId: string
  answer: string | number // option index, text, or numeric value
  timestamp: number // Unix timestamp for ordering
  answeredAt: number // ms since question shown
  isCorrect?: boolean
  pointsAwarded?: number
  rejected?: boolean // late submission rejected
}

// ------------------------------------------------------------
// Game State
// ------------------------------------------------------------

export type GamePhase = 'lobby' | 'playing' | 'revealing' | 'finished'

export interface CurrentQuestionState {
  question: Question
  questionIndex: number
  totalQuestions: number
  startedAt: number
  timeRemaining?: number
  answers: Map<string, PlayerAnswer>
}

export interface GameState {
  phase: GamePhase
  roomCode: string
  config: QuizGameConfig
  players: Map<string, Player>
  currentQuestion: CurrentQuestionState | null
  questionHistory: Question[]
  startedAt?: number
  finishedAt?: number
}

// ------------------------------------------------------------
// Message Protocol Types
// ------------------------------------------------------------

// Host -> Players (broadcast)
export type HostBroadcastType =
  | 'game:start'
  | 'question:show'
  | 'question:replaced'
  | 'question:end'
  | 'answer:reveal'
  | 'scoreboard:update'
  | 'game:end'
  | 'game:rematch'

// Player -> Host
export type PlayerMessageType = 'player:join' | 'player:rejoin' | 'player:answer' | 'player:powerup'

// Host -> Specific Player
export type HostDirectType = 'player:state' | 'player:kicked' | 'answer:rejected'

export interface GameStartMessage {
  type: 'game:start'
  payload: {
    roomCode: string
    config: QuizGameConfig
    totalQuestions: number
  }
}

export interface QuestionShowMessage {
  type: 'question:show'
  payload: {
    question: Omit<
      Question,
      'correctOptionIndex' | 'correctText' | 'correctNumber' | 'acceptedAnswers'
    >
    questionIndex: number
    totalQuestions: number
    timeLimit?: number
    startedAt: number
  }
}

export interface QuestionReplacedMessage {
  type: 'question:replaced'
  payload: {
    question: Omit<
      Question,
      'correctOptionIndex' | 'correctText' | 'correctNumber' | 'acceptedAnswers'
    >
    questionIndex: number
    totalQuestions: number
    timeLimit?: number
    startedAt: number
  }
}

export interface QuestionEndMessage {
  type: 'question:end'
  payload: {
    questionId: string
  }
}

export interface AnswerRevealMessage {
  type: 'answer:reveal'
  payload: {
    question: Question // full question with answer
    answers: PlayerAnswer[]
    scoreboard: ScoreboardEntry[]
  }
}

export interface ScoreboardEntry {
  playerId: string
  playerName: string
  score: number
  rank: number
  streak: number
  lastAnswerCorrect?: boolean
  pointsThisRound?: number
}

export interface ScoreboardUpdateMessage {
  type: 'scoreboard:update'
  payload: {
    scoreboard: ScoreboardEntry[]
  }
}

export interface GameEndMessage {
  type: 'game:end'
  payload: {
    finalScoreboard: ScoreboardEntry[]
    totalQuestions: number
    duration: number // ms
  }
}

export interface GameRematchMessage {
  type: 'game:rematch'
  payload: {
    previousResults: ScoreboardEntry[]
  }
}

export interface PlayerJoinMessage {
  type: 'player:join'
  payload: {
    playerId: string
    playerName: string
  }
}

export interface PlayerRejoinMessage {
  type: 'player:rejoin'
  payload: {
    playerId: string
  }
}

export interface PlayerAnswerMessage {
  type: 'player:answer'
  payload: PlayerAnswer
}

export interface PlayerPowerupMessage {
  type: 'player:powerup'
  payload: {
    playerId: string
    powerupId: string
  }
}

export interface PlayerStateMessage {
  type: 'player:state'
  payload: {
    player: Player
    currentQuestion: CurrentQuestionState | null
    gamePhase: GamePhase
  }
}

export interface PlayerKickedMessage {
  type: 'player:kicked'
  payload: {
    playerId: string
    reason?: string
  }
}

export interface AnswerRejectedMessage {
  type: 'answer:rejected'
  payload: {
    playerId: string
    questionId: string
    reason: 'late' | 'already-answered' | 'invalid'
  }
}

export type HostBroadcastMessage =
  | GameStartMessage
  | QuestionShowMessage
  | QuestionReplacedMessage
  | QuestionEndMessage
  | AnswerRevealMessage
  | ScoreboardUpdateMessage
  | GameEndMessage
  | GameRematchMessage

export type PlayerMessage =
  | PlayerJoinMessage
  | PlayerRejoinMessage
  | PlayerAnswerMessage
  | PlayerPowerupMessage

export type HostDirectMessage = PlayerStateMessage | PlayerKickedMessage | AnswerRejectedMessage

export type GameMessage = HostBroadcastMessage | PlayerMessage | HostDirectMessage

// ------------------------------------------------------------
// Question Provider Types
// ------------------------------------------------------------

export interface QuestionFilter {
  categories?: string[]
  difficulties?: Difficulty[]
  count?: number
  shuffle?: boolean
  excludeIds?: string[]
}

export interface QuestionProvider<T = Question> {
  getQuestions(filter?: QuestionFilter): Promise<T[]>
  getCategories(): Promise<string[]>
  getQuestionById(id: string): Promise<T | null>
}

// ------------------------------------------------------------
// Hook Return Types
// ------------------------------------------------------------

export interface UseQuizHostOptions {
  supabaseClient: SupabaseClientType
  config: QuizGameConfig
  questions: Question[] | QuestionProvider
  baseUrl?: string
  onGameEnd?: (results: ScoreboardEntry[]) => void
  onRematch?: (previousResults: ScoreboardEntry[]) => void
}

export interface UseQuizHostReturn {
  // State
  gameState: GamePhase
  currentQuestion: CurrentQuestionState | null
  currentCategory: string | null
  players: Player[]
  scoreboard: ScoreboardEntry[]
  answers: PlayerAnswer[]

  // Round state
  allPlayersAnswered: boolean

  // Actions
  startGame: () => Promise<void>
  nextQuestion: () => Promise<void>
  replaceQuestion: () => Promise<void>
  revealAnswer: () => void
  endRound: () => void // Force end current round (goes to reveal)
  endGame: () => void
  rematch: () => Promise<void>

  // Player management
  kickPlayer: (playerId: string) => void
  adjustScore: (playerId: string, points: number) => void
  addPlayer: (name: string) => void

  // Room
  roomCode: string
  joinUrl: string

  // Categories
  availableCategories: string[]
  selectCategories: (categories: string[]) => void

  // Connection
  isConnected: boolean
  error: Error | null
}

export interface UseQuizPlayerOptions {
  supabaseClient: SupabaseClientType
  roomCode: string
  playerName: string
}

export interface UseQuizPlayerReturn {
  // State
  gameState: GamePhase
  currentQuestion: Omit<
    Question,
    'correctOptionIndex' | 'correctText' | 'correctNumber' | 'acceptedAnswers'
  > | null
  currentCategory: string | null
  myScore: number
  myRank: number
  availablePowerups: PowerupDefinition[]
  activePowerup: PowerupDefinition | null
  hasAnswered: boolean
  answerRejected: boolean
  questionTimeRemaining: number | null

  // Actions
  submitAnswer: (answer: string | number) => void
  activatePowerup: (powerupId: string) => void

  // Connection
  isConnected: boolean
  isReconnecting: boolean
  connectionError: Error | null
  reconnect: () => void
}

// ------------------------------------------------------------
// Supabase Types (generic to avoid direct dependency)
// ------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SupabaseClientType = any

// ------------------------------------------------------------
// Storage Types
// ------------------------------------------------------------

export interface StoredPlayerIdentity {
  playerId: string
  playerName: string
  roomCode: string
  createdAt: number
}

export interface StoredGameBackup {
  gameState: GameState
  questions: Question[]
  currentQuestionIndex: number
  savedAt: number
}

// ------------------------------------------------------------
// Result Types
// ------------------------------------------------------------

export interface GameResults {
  roomCode: string
  finalScoreboard: ScoreboardEntry[]
  questions: Question[]
  playerAnswers: Map<string, PlayerAnswer[]>
  duration: number
  finishedAt: number
}
