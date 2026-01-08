/**
 * Scoring strategies for different bonus types
 */

import type {
  TimeBonusConfig,
  StreakBonusConfig,
  DifficultyMultipliers,
  Difficulty,
} from "../types";

/**
 * Calculate time bonus based on how quickly the answer was submitted
 */
export function calculateTimeBonus(
  config: TimeBonusConfig,
  answeredAtMs: number,
  timeLimitSeconds: number
): number {
  if (!config.enabled) return 0;

  // Convert to seconds
  const answeredAtSeconds = answeredAtMs / 1000;
  
  // No bonus if answered after time limit
  if (answeredAtSeconds >= timeLimitSeconds) return 0;

  // Calculate decay based on time taken
  const decay = answeredAtSeconds * config.decayPerSecond;
  const bonus = Math.max(0, config.maxBonus - decay);

  return Math.round(bonus);
}

/**
 * Calculate streak multiplier
 */
export function calculateStreakMultiplier(
  config: StreakBonusConfig,
  currentStreak: number
): number {
  if (!config.enabled) return 1;

  const bonus = currentStreak * config.multiplierPerStreak;
  const multiplier = 1 + Math.min(bonus, config.maxMultiplier - 1);

  return multiplier;
}

/**
 * Get difficulty multiplier
 */
export function getDifficultyMultiplier(
  multipliers: DifficultyMultipliers | undefined,
  difficulty: Difficulty | undefined
): number {
  if (!multipliers || !difficulty) return 1;
  return multipliers[difficulty] ?? 1;
}

/**
 * Calculate estimation score (golf-style: lower is better)
 */
export function calculateEstimationScore(
  guess: number,
  correctAnswer: number,
  lowerBound: number,
  upperBound: number,
  config: {
    exactMatchBonus: number;
    minScore: number;
    maxScore: number;
    capAtMax: boolean;
  }
): number {
  // Exact match gets special bonus
  if (guess === correctAnswer) {
    return config.exactMatchBonus;
  }

  // Calculate normalized difference
  const range = upperBound - lowerBound;
  if (range <= 0) return config.maxScore;

  const difference = Math.abs(guess - correctAnswer);
  const normalizedDifference = difference / range;

  // Scale to score range
  const scoreRange = config.maxScore - config.minScore;
  let score = config.minScore + normalizedDifference * scoreRange * 100;

  // Cap at max if configured
  if (config.capAtMax) {
    score = Math.min(score, config.maxScore);
  }

  return Math.round(score);
}
