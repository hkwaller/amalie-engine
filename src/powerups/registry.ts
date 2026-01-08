/**
 * Built-in power-up definitions
 */

import type { PowerupDefinition } from "../types";

/**
 * Double Points - doubles the score for the next question
 */
export const DOUBLE_POINTS: PowerupDefinition = {
  id: "double-points",
  name: "Double Points",
  description: "Double your score for the next correct answer",
  duration: "single-question",
  effect: "double-points",
  value: 2,
};

/**
 * Fifty-Fifty - removes two incorrect options in multiple choice
 */
export const FIFTY_FIFTY: PowerupDefinition = {
  id: "fifty-fifty",
  name: "50/50",
  description: "Remove two incorrect answer options",
  duration: "single-question",
  effect: "remove-two-wrong",
};

/**
 * Extra Time - adds extra seconds to answer
 */
export const EXTRA_TIME: PowerupDefinition = {
  id: "extra-time",
  name: "Extra Time",
  description: "Get 10 extra seconds to answer",
  duration: "single-question",
  effect: "extra-time",
  value: 10,
};

/**
 * Skip Question - skip without penalty
 */
export const SKIP_QUESTION: PowerupDefinition = {
  id: "skip-question",
  name: "Skip",
  description: "Skip this question without losing your streak",
  duration: "single-question",
  effect: "skip-question",
};

/**
 * Shield - protects streak on wrong answer
 */
export const SHIELD: PowerupDefinition = {
  id: "shield",
  name: "Shield",
  description: "Protect your streak if you answer wrong",
  duration: "single-question",
  effect: "shield",
};

/**
 * Steal Points - steal points from the leader
 */
export const STEAL_POINTS: PowerupDefinition = {
  id: "steal-points",
  name: "Steal Points",
  description: "Steal 50 points from the current leader",
  duration: "single-question",
  effect: "steal-points",
  value: 50,
};

/**
 * All built-in power-ups
 */
export const BUILT_IN_POWERUPS: PowerupDefinition[] = [
  DOUBLE_POINTS,
  FIFTY_FIFTY,
  EXTRA_TIME,
  SKIP_QUESTION,
  SHIELD,
  STEAL_POINTS,
];

/**
 * Get a power-up by ID
 */
export function getPowerupById(id: string): PowerupDefinition | undefined {
  return BUILT_IN_POWERUPS.find((p) => p.id === id);
}

/**
 * Create a custom power-up
 */
export function createCustomPowerup(
  partial: Partial<PowerupDefinition> & { id: string; name: string }
): PowerupDefinition {
  return {
    duration: "single-question",
    effect: "custom",
    ...partial,
  };
}
