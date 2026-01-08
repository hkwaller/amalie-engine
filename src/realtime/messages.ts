/**
 * Message types and helpers for Realtime communication
 */

import type {
  HostBroadcastMessage,
  PlayerMessage,
  HostDirectMessage,
  GameMessage,
  QuizGameConfig,
  Question,
  ScoreboardEntry,
  PlayerAnswer,
  Player,
  GamePhase,
  CurrentQuestionState,
} from "../types";

/**
 * Strip sensitive answer data from question for players
 */
export function stripAnswerData<T extends Question>(
  question: T
): Omit<T, "correctOptionIndex" | "correctText" | "correctNumber" | "acceptedAnswers"> {
  const {
    correctOptionIndex: _c1,
    correctText: _c2,
    correctNumber: _c3,
    acceptedAnswers: _c4,
    ...safeQuestion
  } = question;
  return safeQuestion as Omit<T, "correctOptionIndex" | "correctText" | "correctNumber" | "acceptedAnswers">;
}

// Message creators for Host -> Players broadcasts

export function createGameStartMessage(
  roomCode: string,
  config: QuizGameConfig,
  totalQuestions: number
): HostBroadcastMessage {
  return {
    type: "game:start",
    payload: { roomCode, config, totalQuestions },
  };
}

export function createQuestionShowMessage(
  question: Question,
  questionIndex: number,
  totalQuestions: number,
  timeLimit?: number
): HostBroadcastMessage {
  return {
    type: "question:show",
    payload: {
      question: stripAnswerData(question),
      questionIndex,
      totalQuestions,
      timeLimit,
      startedAt: Date.now(),
    },
  };
}

export function createQuestionReplacedMessage(
  question: Question,
  questionIndex: number,
  totalQuestions: number,
  timeLimit?: number
): HostBroadcastMessage {
  return {
    type: "question:replaced",
    payload: {
      question: stripAnswerData(question),
      questionIndex,
      totalQuestions,
      timeLimit,
      startedAt: Date.now(),
    },
  };
}

export function createQuestionEndMessage(questionId: string): HostBroadcastMessage {
  return {
    type: "question:end",
    payload: { questionId },
  };
}

export function createAnswerRevealMessage(
  question: Question,
  answers: PlayerAnswer[],
  scoreboard: ScoreboardEntry[]
): HostBroadcastMessage {
  return {
    type: "answer:reveal",
    payload: { question, answers, scoreboard },
  };
}

export function createScoreboardUpdateMessage(
  scoreboard: ScoreboardEntry[]
): HostBroadcastMessage {
  return {
    type: "scoreboard:update",
    payload: { scoreboard },
  };
}

export function createGameEndMessage(
  finalScoreboard: ScoreboardEntry[],
  totalQuestions: number,
  duration: number
): HostBroadcastMessage {
  return {
    type: "game:end",
    payload: { finalScoreboard, totalQuestions, duration },
  };
}

export function createGameRematchMessage(
  previousResults: ScoreboardEntry[]
): HostBroadcastMessage {
  return {
    type: "game:rematch",
    payload: { previousResults },
  };
}

// Message creators for Player -> Host

export function createPlayerJoinMessage(
  playerId: string,
  playerName: string
): PlayerMessage {
  return {
    type: "player:join",
    payload: { playerId, playerName },
  };
}

export function createPlayerRejoinMessage(playerId: string): PlayerMessage {
  return {
    type: "player:rejoin",
    payload: { playerId },
  };
}

export function createPlayerAnswerMessage(answer: PlayerAnswer): PlayerMessage {
  return {
    type: "player:answer",
    payload: answer,
  };
}

export function createPlayerPowerupMessage(
  playerId: string,
  powerupId: string
): PlayerMessage {
  return {
    type: "player:powerup",
    payload: { playerId, powerupId },
  };
}

// Message creators for Host -> Specific Player

export function createPlayerStateMessage(
  player: Player,
  currentQuestion: CurrentQuestionState | null,
  gamePhase: GamePhase
): HostDirectMessage {
  return {
    type: "player:state",
    payload: { player, currentQuestion, gamePhase },
  };
}

export function createPlayerKickedMessage(
  playerId: string,
  reason?: string
): HostDirectMessage {
  return {
    type: "player:kicked",
    payload: { playerId, reason },
  };
}

export function createAnswerRejectedMessage(
  playerId: string,
  questionId: string,
  reason: "late" | "already-answered" | "invalid"
): HostDirectMessage {
  return {
    type: "answer:rejected",
    payload: { playerId, questionId, reason },
  };
}

/**
 * Type guard for host broadcast messages
 */
export function isHostBroadcastMessage(msg: GameMessage): msg is HostBroadcastMessage {
  return [
    "game:start",
    "question:show",
    "question:replaced",
    "question:end",
    "answer:reveal",
    "scoreboard:update",
    "game:end",
    "game:rematch",
  ].includes(msg.type);
}

/**
 * Type guard for player messages
 */
export function isPlayerMessage(msg: GameMessage): msg is PlayerMessage {
  return [
    "player:join",
    "player:rejoin",
    "player:answer",
    "player:powerup",
  ].includes(msg.type);
}

/**
 * Type guard for host direct messages
 */
export function isHostDirectMessage(msg: GameMessage): msg is HostDirectMessage {
  return ["player:state", "player:kicked", "answer:rejected"].includes(msg.type);
}
