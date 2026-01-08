/**
 * localStorage backup and player identity management
 */

import type {
  StoredPlayerIdentity,
  StoredGameBackup,
  GameState,
  Question,
} from "../types";
import { serializeGameState, deserializeGameState } from "../core/game-state";

const STORAGE_PREFIX = "quiz-engine";
const PLAYER_IDENTITY_KEY = `${STORAGE_PREFIX}:player`;
const GAME_BACKUP_KEY = `${STORAGE_PREFIX}:game-backup`;

/**
 * Check if localStorage is available
 */
export function isStorageAvailable(): boolean {
  try {
    const test = "__storage_test__";
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// Player Identity Management
// ============================================================

/**
 * Generate a unique player ID
 */
export function generatePlayerId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `player-${timestamp}-${random}`;
}

/**
 * Get stored player identity
 */
export function getStoredPlayerIdentity(
  roomCode?: string
): StoredPlayerIdentity | null {
  if (!isStorageAvailable()) return null;

  try {
    const key = roomCode ? `${PLAYER_IDENTITY_KEY}:${roomCode}` : PLAYER_IDENTITY_KEY;
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    const identity: StoredPlayerIdentity = JSON.parse(stored);
    
    // Validate identity
    if (!identity.playerId || !identity.playerName) {
      return null;
    }

    return identity;
  } catch {
    return null;
  }
}

/**
 * Store player identity
 */
export function storePlayerIdentity(identity: StoredPlayerIdentity): void {
  if (!isStorageAvailable()) return;

  try {
    // Store both global and room-specific
    localStorage.setItem(PLAYER_IDENTITY_KEY, JSON.stringify(identity));
    localStorage.setItem(
      `${PLAYER_IDENTITY_KEY}:${identity.roomCode}`,
      JSON.stringify(identity)
    );
  } catch {
    console.warn("Failed to store player identity");
  }
}

/**
 * Clear player identity
 */
export function clearPlayerIdentity(roomCode?: string): void {
  if (!isStorageAvailable()) return;

  try {
    if (roomCode) {
      localStorage.removeItem(`${PLAYER_IDENTITY_KEY}:${roomCode}`);
    } else {
      localStorage.removeItem(PLAYER_IDENTITY_KEY);
    }
  } catch {
    // Ignore
  }
}

/**
 * Get or create player identity
 */
export function getOrCreatePlayerIdentity(
  roomCode: string,
  playerName: string
): StoredPlayerIdentity {
  // Try to get existing identity for this room
  const existing = getStoredPlayerIdentity(roomCode);
  
  if (existing && existing.roomCode === roomCode) {
    // Update name if changed
    if (existing.playerName !== playerName) {
      const updated = { ...existing, playerName };
      storePlayerIdentity(updated);
      return updated;
    }
    return existing;
  }

  // Create new identity
  const identity: StoredPlayerIdentity = {
    playerId: generatePlayerId(),
    playerName,
    roomCode,
    createdAt: Date.now(),
  };

  storePlayerIdentity(identity);
  return identity;
}

// ============================================================
// Game Backup Management (for host)
// ============================================================

/**
 * Get stored game backup
 */
export function getStoredGameBackup(roomCode: string): StoredGameBackup | null {
  if (!isStorageAvailable()) return null;

  try {
    const key = `${GAME_BACKUP_KEY}:${roomCode}`;
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    const backup = JSON.parse(stored);
    
    // Deserialize game state
    if (backup.gameStateJson) {
      backup.gameState = deserializeGameState(backup.gameStateJson);
      delete backup.gameStateJson;
    }

    return backup as StoredGameBackup;
  } catch (error) {
    console.warn("Failed to load game backup:", error);
    return null;
  }
}

/**
 * Store game backup
 */
export function storeGameBackup(
  roomCode: string,
  gameState: GameState,
  questions: Question[],
  currentQuestionIndex: number
): void {
  if (!isStorageAvailable()) return;

  try {
    const key = `${GAME_BACKUP_KEY}:${roomCode}`;
    const backup = {
      gameStateJson: serializeGameState(gameState),
      questions,
      currentQuestionIndex,
      savedAt: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(backup));
  } catch (error) {
    console.warn("Failed to store game backup:", error);
  }
}

/**
 * Clear game backup
 */
export function clearGameBackup(roomCode: string): void {
  if (!isStorageAvailable()) return;

  try {
    localStorage.removeItem(`${GAME_BACKUP_KEY}:${roomCode}`);
  } catch {
    // Ignore
  }
}

/**
 * Throttled backup function (for periodic saves)
 */
export function createThrottledBackup(
  roomCode: string,
  intervalMs: number = 5000
): {
  backup: (gameState: GameState, questions: Question[], index: number) => void;
  cancel: () => void;
} {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingBackup: {
    gameState: GameState;
    questions: Question[];
    currentQuestionIndex: number;
  } | null = null;

  const doBackup = () => {
    if (pendingBackup) {
      storeGameBackup(
        roomCode,
        pendingBackup.gameState,
        pendingBackup.questions,
        pendingBackup.currentQuestionIndex
      );
      pendingBackup = null;
    }
  };

  const backup = (
    gameState: GameState,
    questions: Question[],
    currentQuestionIndex: number
  ) => {
    pendingBackup = { gameState, questions, currentQuestionIndex };

    if (!timeoutId) {
      timeoutId = setTimeout(() => {
        doBackup();
        timeoutId = null;
      }, intervalMs);
    }
  };

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    // Do final backup before cancel
    doBackup();
  };

  return { backup, cancel };
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Clear all quiz engine data from localStorage
 */
export function clearAllStoredData(): void {
  if (!isStorageAvailable()) return;

  try {
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Ignore
  }
}

/**
 * Get all stored room codes
 */
export function getStoredRoomCodes(): string[] {
  if (!isStorageAvailable()) return [];

  const roomCodes: string[] = [];
  const playerKeyPrefix = `${PLAYER_IDENTITY_KEY}:`;
  const backupKeyPrefix = `${GAME_BACKUP_KEY}:`;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(playerKeyPrefix)) {
        roomCodes.push(key.replace(playerKeyPrefix, ""));
      } else if (key?.startsWith(backupKeyPrefix)) {
        const roomCode = key.replace(backupKeyPrefix, "");
        if (!roomCodes.includes(roomCode)) {
          roomCodes.push(roomCode);
        }
      }
    }
  } catch {
    // Ignore
  }

  return roomCodes;
}
