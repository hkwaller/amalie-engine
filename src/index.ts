/**
 * Amalie Engine - Quiz Game Engine
 *
 * A TypeScript npm package that provides a complete quiz game engine
 * with Supabase Realtime integration, React hooks for Next.js apps,
 * configurable scoring systems, and power-up support.
 */

// Types
export type {
  // Question types
  Question,
  AnswerType,
  Difficulty,
  MediaType,
  MediaShowDuring,
  QuestionMedia,

  // Scoring types
  ScoringConfig,
  TimeBonusConfig,
  StreakBonusConfig,
  DifficultyMultipliers,
  EstimationScoringConfig,

  // Power-up types
  PowerupDefinition,
  PowerupDuration,
  PowerupEffect,
  PlayerPowerupState,

  // Game configuration
  QuizGameConfig,
  AnswerMode,

  // Player types
  Player,
  PlayerAnswer,

  // Game state
  GameState,
  GamePhase,
  CurrentQuestionState,
  ScoreboardEntry,

  // Message protocol
  GameMessage,
  HostBroadcastMessage,
  PlayerMessage,
  HostDirectMessage,
  GameStartMessage,
  QuestionShowMessage,
  AnswerRevealMessage,
  ScoreboardUpdateMessage,
  GameEndMessage,
  GameRematchMessage,
  PlayerJoinMessage,
  PlayerAnswerMessage,
  PlayerStateMessage,

  // Question provider
  QuestionFilter,
  QuestionProvider,

  // Hook types
  UseQuizHostOptions,
  UseQuizHostReturn,
  UseQuizPlayerOptions,
  UseQuizPlayerReturn,

  // Storage types
  StoredPlayerIdentity,
  StoredGameBackup,
  GameResults,
} from "./types";

// Core utilities
export {
  // Room code utilities
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  generateJoinUrl,
  extractRoomCodeFromUrl,
} from "./core/room";

export {
  // Game state utilities
  createInitialGameState,
  createPlayer,
  createCurrentQuestionState,
  calculateScoreboard,
  resetForRematch,
  serializeGameState,
  deserializeGameState,
} from "./core/game-state";

export {
  // Game machine
  GameMachine,
  createGameMachine,
} from "./core/game-machine";

export {
  // Answer tracker
  AnswerTracker,
  createAnswerTracker,
} from "./core/answer-tracker";

// Scoring
export {
  ScoringEngine,
  createScoringEngine,
  quickScore,
} from "./scoring/engine";

export {
  calculateTimeBonus,
  calculateStreakMultiplier,
  getDifficultyMultiplier,
  calculateEstimationScore,
} from "./scoring/strategies";

// Validation
export {
  validateAnswer,
  validateTextAnswer,
  validateMultipleChoiceAnswer,
  validateNumericAnswer,
  normalizeText,
  exactMatch,
  matchesAnyAnswer,
  fuzzyMatch,
  findBestMatch,
  levenshteinDistance,
  calculateSimilarity,
} from "./validation/text-matcher";

// Power-ups
export {
  // Built-in power-ups
  DOUBLE_POINTS,
  FIFTY_FIFTY,
  EXTRA_TIME,
  SKIP_QUESTION,
  SHIELD,
  STEAL_POINTS,
  BUILT_IN_POWERUPS,
  getPowerupById,
  createCustomPowerup,
} from "./powerups/registry";

export {
  PowerupManager,
  createPowerupManager,
  createPowerupState,
  grantPowerup,
  activatePowerup,
  consumeActivePowerup,
  hasPowerup,
  hasActivePowerup,
  applyPowerupToScore,
  shouldProtectStreak,
  getExtraTime,
} from "./powerups/manager";

// Questions
export {
  ArrayQuestionProvider,
  JsonUrlQuestionProvider,
  createArrayProvider,
  createJsonUrlProvider,
  getQuestions,
  getCategories,
} from "./questions/json-provider";

export {
  SupabaseQuestionProvider,
  createSupabaseProvider,
} from "./questions/supabase-provider";

export {
  shuffleArray,
  filterQuestions,
  extractCategories,
} from "./questions/provider";

// Realtime
export {
  RealtimeAdapter,
  createRealtimeAdapter,
} from "./realtime/adapter";

export {
  PresenceManager,
  createPresenceManager,
} from "./realtime/presence";

export {
  // Message creators
  createGameStartMessage,
  createQuestionShowMessage,
  createQuestionReplacedMessage,
  createQuestionEndMessage,
  createAnswerRevealMessage,
  createScoreboardUpdateMessage,
  createGameEndMessage,
  createGameRematchMessage,
  createPlayerJoinMessage,
  createPlayerRejoinMessage,
  createPlayerAnswerMessage,
  createPlayerPowerupMessage,
  createPlayerStateMessage,
  createPlayerKickedMessage,
  createAnswerRejectedMessage,
  // Message type guards
  isHostBroadcastMessage,
  isPlayerMessage,
  isHostDirectMessage,
  stripAnswerData,
} from "./realtime/messages";

// Storage
export {
  // Player identity
  generatePlayerId,
  getStoredPlayerIdentity,
  storePlayerIdentity,
  clearPlayerIdentity,
  getOrCreatePlayerIdentity,
  // Game backup
  getStoredGameBackup,
  storeGameBackup,
  clearGameBackup,
  createThrottledBackup,
  // Utilities
  isStorageAvailable,
  clearAllStoredData,
  getStoredRoomCodes,
} from "./storage/local-backup";

// React Hooks
export { useQuizHost } from "./hooks/use-quiz-host";
export { useQuizPlayer } from "./hooks/use-quiz-player";
export { useScoreboard, getRankSuffix, formatRank } from "./hooks/use-scoreboard";
export { QuizProvider, useQuizContext, useSupabaseClient } from "./hooks/context";

// React Components
export { RoomQRCode, useJoinUrl } from "./components/room-qr-code";
