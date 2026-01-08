/**
 * useQuizPlayer - React hook for playing in a quiz game
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  UseQuizPlayerOptions,
  UseQuizPlayerReturn,
  GamePhase,
  Question,
  PowerupDefinition,
  ScoreboardEntry,
  GameMessage,
  QuizGameConfig,
} from "../types";
import { createRealtimeAdapter, RealtimeAdapter } from "../realtime/adapter";
import {
  createPlayerJoinMessage,
  createPlayerRejoinMessage,
  createPlayerAnswerMessage,
  createPlayerPowerupMessage,
} from "../realtime/messages";
import {
  getOrCreatePlayerIdentity,
  getStoredPlayerIdentity,
} from "../storage/local-backup";

// Stripped question type (without answer data)
type SafeQuestion = Omit<Question, "correctOptionIndex" | "correctText" | "correctNumber" | "acceptedAnswers">;

/**
 * Hook for playing in a quiz game
 */
export function useQuizPlayer(options: UseQuizPlayerOptions): UseQuizPlayerReturn {
  const { supabaseClient, roomCode, playerName } = options;

  // Player identity
  const playerIdentityRef = useRef(
    getOrCreatePlayerIdentity(roomCode, playerName)
  );
  const playerId = playerIdentityRef.current.playerId;

  // Realtime ref
  const realtimeRef = useRef<RealtimeAdapter | null>(null);

  // Game state
  const [gameState, setGameState] = useState<GamePhase>("lobby");
  const [currentQuestion, setCurrentQuestion] = useState<SafeQuestion | null>(null);
  const [questionStartedAt, setQuestionStartedAt] = useState<number>(0);
  const [timeLimit, setTimeLimit] = useState<number | null>(null);
  const [questionTimeRemaining, setQuestionTimeRemaining] = useState<number | null>(null);

  // Player state
  const [myScore, setMyScore] = useState(0);
  const [myRank, setMyRank] = useState(0);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [answerRejected, setAnswerRejected] = useState(false);

  // Power-ups
  const [availablePowerups, setAvailablePowerups] = useState<PowerupDefinition[]>([]);
  const [activePowerup, setActivePowerup] = useState<PowerupDefinition | null>(null);

  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<Error | null>(null);

  // Game config (received from host)
  const [gameConfig, setGameConfig] = useState<QuizGameConfig | null>(null);

  // Handle incoming messages from host
  const handleMessage = useCallback((message: GameMessage, targetPlayerId?: string) => {
    // Ignore direct messages not meant for this player
    if (targetPlayerId && targetPlayerId !== playerId) {
      return;
    }

    switch (message.type) {
      case "game:start": {
        setGameState("playing");
        setGameConfig(message.payload.config);
        // Initialize power-ups if available
        if (message.payload.config.powerups) {
          setAvailablePowerups([...message.payload.config.powerups]);
        }
        break;
      }

      case "question:show":
      case "question:replaced": {
        const { question, timeLimit: qTimeLimit, startedAt } = message.payload;
        setCurrentQuestion(question);
        setQuestionStartedAt(startedAt);
        setTimeLimit(qTimeLimit ?? null);
        setQuestionTimeRemaining(qTimeLimit ? qTimeLimit * 1000 : null);
        setHasAnswered(false);
        setAnswerRejected(false);
        setActivePowerup(null);
        setGameState("playing");
        break;
      }

      case "question:end": {
        // Question time is over
        break;
      }

      case "answer:reveal": {
        const { scoreboard } = message.payload;
        setGameState("revealing");
        updateMyScoreFromScoreboard(scoreboard);
        break;
      }

      case "scoreboard:update": {
        const { scoreboard } = message.payload;
        updateMyScoreFromScoreboard(scoreboard);
        break;
      }

      case "game:end": {
        const { finalScoreboard } = message.payload;
        setGameState("finished");
        updateMyScoreFromScoreboard(finalScoreboard);
        break;
      }

      case "game:rematch": {
        setGameState("lobby");
        setMyScore(0);
        setMyRank(0);
        setCurrentQuestion(null);
        setHasAnswered(false);
        setAnswerRejected(false);
        // Reset power-ups from config
        if (gameConfig?.powerups) {
          setAvailablePowerups([...gameConfig.powerups]);
        }
        setActivePowerup(null);
        break;
      }

      case "player:state": {
        // Received state sync on rejoin
        const { player, currentQuestion: currQ, gamePhase } = message.payload;
        setMyScore(player.score);
        setMyRank(player.rank ?? 0);
        setAvailablePowerups(player.powerups.available);
        setActivePowerup(player.powerups.active);
        setGameState(gamePhase);
        if (currQ) {
          setCurrentQuestion({
            ...currQ.question,
            // Strip answer data if somehow included
            correctOptionIndex: undefined,
            correctText: undefined,
            correctNumber: undefined,
            acceptedAnswers: undefined,
          } as SafeQuestion);
          setQuestionStartedAt(currQ.startedAt);
        }
        break;
      }

      case "player:kicked": {
        setConnectionError(new Error("You have been removed from the game"));
        realtimeRef.current?.disconnect();
        break;
      }

      case "answer:rejected": {
        if (message.payload.playerId === playerId) {
          setAnswerRejected(true);
          setHasAnswered(false);
        }
        break;
      }
    }
  }, [playerId, gameConfig]);

  // Update my score from scoreboard
  const updateMyScoreFromScoreboard = (scoreboard: ScoreboardEntry[]) => {
    const myEntry = scoreboard.find((e) => e.playerId === playerId);
    if (myEntry) {
      setMyScore(myEntry.score);
      setMyRank(myEntry.rank);
    }
  };

  // Initialize realtime connection
  useEffect(() => {
    const adapter = createRealtimeAdapter(supabaseClient, {
      roomCode,
      isHost: false,
    });
    realtimeRef.current = adapter;

    // Handle messages
    adapter.onMessage(handleMessage);

    // Handle connection changes
    adapter.onConnectionChange((connected) => {
      setIsConnected(connected);
      if (connected) {
        setIsReconnecting(false);
      }
    });

    // Handle errors
    adapter.onError((err) => {
      setConnectionError(err);
    });

    // Connect and join
    const connect = async () => {
      try {
        await adapter.connect();

        // Track presence
        await adapter.trackPresence({
          playerId,
          playerName,
          joinedAt: Date.now(),
        });

        // Check if this is a rejoin
        const storedIdentity = getStoredPlayerIdentity(roomCode);
        if (storedIdentity && storedIdentity.playerId === playerId) {
          // Rejoin - send rejoin message
          await adapter.broadcast(createPlayerRejoinMessage(playerId));
        } else {
          // New join
          await adapter.broadcast(createPlayerJoinMessage(playerId, playerName));
        }
      } catch (err) {
        setConnectionError(err as Error);
      }
    };

    connect();

    return () => {
      adapter.disconnect();
    };
  }, [supabaseClient, roomCode, playerId, playerName, handleMessage]);

  // Timer countdown
  useEffect(() => {
    if (!timeLimit || gameState !== "playing" || hasAnswered) {
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - questionStartedAt;
      const remaining = Math.max(0, timeLimit * 1000 - elapsed);
      setQuestionTimeRemaining(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [timeLimit, questionStartedAt, gameState, hasAnswered]);

  // Actions
  const submitAnswer = useCallback((answer: string | number) => {
    const realtime = realtimeRef.current;
    if (!realtime || !currentQuestion || hasAnswered) return;

    setHasAnswered(true);
    setAnswerRejected(false);

    const timestamp = Date.now();
    const answeredAt = timestamp - questionStartedAt;

    realtime.broadcast(
      createPlayerAnswerMessage({
        playerId,
        questionId: currentQuestion.id,
        answer,
        timestamp,
        answeredAt,
      })
    );
  }, [currentQuestion, hasAnswered, questionStartedAt, playerId]);

  const activatePowerup = useCallback((powerupId: string) => {
    const realtime = realtimeRef.current;
    if (!realtime || activePowerup) return;

    const powerup = availablePowerups.find((p) => p.id === powerupId);
    if (!powerup) return;

    // Optimistically update local state
    setActivePowerup(powerup);
    setAvailablePowerups((prev) => prev.filter((p) => p.id !== powerupId));

    // Notify host
    realtime.broadcast(createPlayerPowerupMessage(playerId, powerupId));
  }, [availablePowerups, activePowerup, playerId]);

  const reconnect = useCallback(async () => {
    setIsReconnecting(true);
    setConnectionError(null);

    const realtime = realtimeRef.current;
    if (!realtime) return;

    try {
      await realtime.disconnect();
      await realtime.connect();
      
      await realtime.trackPresence({
        playerId,
        playerName,
        joinedAt: Date.now(),
      });

      await realtime.broadcast(createPlayerRejoinMessage(playerId));
    } catch (err) {
      setConnectionError(err as Error);
      setIsReconnecting(false);
    }
  }, [playerId, playerName]);

  // Derived values
  const currentCategory = currentQuestion?.category ?? null;

  return {
    // State
    gameState,
    currentQuestion,
    currentCategory,
    myScore,
    myRank,
    availablePowerups,
    activePowerup,
    hasAnswered,
    answerRejected,
    questionTimeRemaining,

    // Actions
    submitAnswer,
    activatePowerup,

    // Connection
    isConnected,
    isReconnecting,
    connectionError,
    reconnect,
  };
}
