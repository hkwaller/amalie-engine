/**
 * Power-up state management for players
 */

import type {
  PowerupDefinition,
  PlayerPowerupState,
} from "../types";

/**
 * Create initial power-up state for a player
 */
export function createPowerupState(
  availablePowerups: PowerupDefinition[] = []
): PlayerPowerupState {
  return {
    available: [...availablePowerups],
    active: null,
    used: [],
  };
}

/**
 * Grant a power-up to a player
 */
export function grantPowerup(
  state: PlayerPowerupState,
  powerup: PowerupDefinition
): PlayerPowerupState {
  return {
    ...state,
    available: [...state.available, powerup],
  };
}

/**
 * Activate a power-up
 */
export function activatePowerup(
  state: PlayerPowerupState,
  powerupId: string
): PlayerPowerupState | null {
  const powerupIndex = state.available.findIndex((p) => p.id === powerupId);
  
  if (powerupIndex === -1) {
    return null; // Power-up not available
  }

  if (state.active) {
    return null; // Already have an active power-up
  }

  const powerup = state.available[powerupIndex];
  const newAvailable = [...state.available];
  newAvailable.splice(powerupIndex, 1);

  return {
    available: newAvailable,
    active: powerup,
    used: state.used,
  };
}

/**
 * Consume the active power-up (after question ends)
 */
export function consumeActivePowerup(
  state: PlayerPowerupState
): PlayerPowerupState {
  if (!state.active) {
    return state;
  }

  return {
    available: state.available,
    active: null,
    used: [...state.used, state.active.id],
  };
}

/**
 * Check if player has a specific power-up available
 */
export function hasPowerup(
  state: PlayerPowerupState,
  powerupId: string
): boolean {
  return state.available.some((p) => p.id === powerupId);
}

/**
 * Check if player has a specific power-up active
 */
export function hasActivePowerup(
  state: PlayerPowerupState,
  powerupId: string
): boolean {
  return state.active?.id === powerupId;
}

/**
 * Get the active power-up effect
 */
export function getActiveEffect(
  state: PlayerPowerupState
): PowerupDefinition | null {
  return state.active;
}

/**
 * Apply power-up modifier to score
 */
export function applyPowerupToScore(
  state: PlayerPowerupState,
  baseScore: number
): number {
  if (!state.active) {
    return baseScore;
  }

  switch (state.active.effect) {
    case "double-points":
      return baseScore * (state.active.value ?? 2);
    default:
      return baseScore;
  }
}

/**
 * Check if streak should be protected
 */
export function shouldProtectStreak(state: PlayerPowerupState): boolean {
  return state.active?.effect === "shield";
}

/**
 * Calculate extra time from power-up
 */
export function getExtraTime(state: PlayerPowerupState): number {
  if (state.active?.effect === "extra-time") {
    return state.active.value ?? 0;
  }
  return 0;
}

/**
 * Power-up manager for handling multiple players
 */
export class PowerupManager {
  private playerStates: Map<string, PlayerPowerupState> = new Map();
  private defaultPowerups: PowerupDefinition[];

  constructor(defaultPowerups: PowerupDefinition[] = []) {
    this.defaultPowerups = defaultPowerups;
  }

  /**
   * Initialize power-ups for a player
   */
  initPlayer(playerId: string): void {
    this.playerStates.set(playerId, createPowerupState(this.defaultPowerups));
  }

  /**
   * Get player's power-up state
   */
  getPlayerState(playerId: string): PlayerPowerupState | undefined {
    return this.playerStates.get(playerId);
  }

  /**
   * Grant power-up to player
   */
  grantToPlayer(playerId: string, powerup: PowerupDefinition): boolean {
    const state = this.playerStates.get(playerId);
    if (!state) return false;

    this.playerStates.set(playerId, grantPowerup(state, powerup));
    return true;
  }

  /**
   * Activate power-up for player
   */
  activateForPlayer(playerId: string, powerupId: string): boolean {
    const state = this.playerStates.get(playerId);
    if (!state) return false;

    const newState = activatePowerup(state, powerupId);
    if (!newState) return false;

    this.playerStates.set(playerId, newState);
    return true;
  }

  /**
   * Consume active power-ups for all players (after question)
   */
  consumeAllActive(): void {
    this.playerStates.forEach((state, playerId) => {
      this.playerStates.set(playerId, consumeActivePowerup(state));
    });
  }

  /**
   * Reset all player power-ups
   */
  reset(): void {
    this.playerStates.forEach((_, playerId) => {
      this.playerStates.set(playerId, createPowerupState(this.defaultPowerups));
    });
  }

  /**
   * Remove player
   */
  removePlayer(playerId: string): void {
    this.playerStates.delete(playerId);
  }
}

/**
 * Create a power-up manager
 */
export function createPowerupManager(
  defaultPowerups: PowerupDefinition[] = []
): PowerupManager {
  return new PowerupManager(defaultPowerups);
}
