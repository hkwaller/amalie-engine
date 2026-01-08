/**
 * Scoring engine - calculates points based on answers and configuration
 */

import type { Question, PlayerAnswer, ScoringConfig } from '../types'
import {
  calculateTimeBonus,
  calculateStreakMultiplier,
  getDifficultyMultiplier,
  calculateEstimationScore,
} from './strategies'

export interface ScoreCalculationInput {
  question: Question
  answer: PlayerAnswer
  isCorrect: boolean
  currentStreak: number
  timeLimit?: number // seconds
}

export interface ScoreCalculationResult {
  totalPoints: number
  basePoints: number
  timeBonus: number
  streakMultiplier: number
  difficultyMultiplier: number
  breakdown: {
    base: number
    time: number
    streak: number
    difficulty: number
  }
}

export interface EstimationScoreResult {
  score: number
  isExactMatch: boolean
  difference: number
}

export class ScoringEngine {
  private config: ScoringConfig

  constructor(config: ScoringConfig) {
    this.config = config
  }

  /**
   * Calculate score for a standard answer (multiple-choice or text)
   */
  calculateScore(input: ScoreCalculationInput): ScoreCalculationResult {
    const { question, answer, isCorrect, currentStreak, timeLimit } = input

    // Wrong answers get 0 points
    if (!isCorrect) {
      return {
        totalPoints: 0,
        basePoints: 0,
        timeBonus: 0,
        streakMultiplier: 1,
        difficultyMultiplier: 1,
        breakdown: { base: 0, time: 0, streak: 0, difficulty: 0 },
      }
    }

    // Base points (can be overridden per question)
    const basePoints = question.points ?? this.config.basePoints

    // Time bonus
    const timeBonus =
      this.config.timeBonus && timeLimit
        ? calculateTimeBonus(this.config.timeBonus, answer.answeredAt, timeLimit)
        : 0

    // Streak multiplier
    const streakMultiplier = this.config.streakBonus
      ? calculateStreakMultiplier(this.config.streakBonus, currentStreak)
      : 1

    // Difficulty multiplier
    const difficultyMultiplier = getDifficultyMultiplier(
      this.config.difficultyMultipliers,
      question.difficulty,
    )

    // Calculate total
    const baseWithBonus = basePoints + timeBonus
    const withStreak = baseWithBonus * streakMultiplier
    const totalPoints = Math.round(withStreak * difficultyMultiplier)

    return {
      totalPoints,
      basePoints,
      timeBonus,
      streakMultiplier,
      difficultyMultiplier,
      breakdown: {
        base: basePoints,
        time: timeBonus,
        streak: Math.round((streakMultiplier - 1) * baseWithBonus),
        difficulty: Math.round((difficultyMultiplier - 1) * withStreak),
      },
    }
  }

  /**
   * Calculate score for an estimation answer (golf-style: lower is better)
   */
  calculateEstimationScore(guess: number, question: Question): EstimationScoreResult {
    if (!this.config.estimation) {
      throw new Error('Estimation scoring not configured')
    }

    if (question.correctNumber === undefined) {
      throw new Error('Question missing correctNumber for estimation')
    }

    const correctAnswer = question.correctNumber
    const lowerBound = question.lowerBound ?? 0
    const upperBound = question.upperBound ?? correctAnswer * 2

    const score = calculateEstimationScore(
      guess,
      correctAnswer,
      lowerBound,
      upperBound,
      this.config.estimation,
    )

    return {
      score,
      isExactMatch: guess === correctAnswer,
      difference: Math.abs(guess - correctAnswer),
    }
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ScoringConfig>): void {
    this.config = { ...this.config, ...updates }
  }

  /**
   * Get current configuration
   */
  getConfig(): ScoringConfig {
    return { ...this.config }
  }
}

/**
 * Create a scoring engine with default configuration
 */
export function createScoringEngine(config?: Partial<ScoringConfig>): ScoringEngine {
  const defaultConfig: ScoringConfig = {
    basePoints: 100,
    timeBonus: {
      enabled: true,
      maxBonus: 50,
      decayPerSecond: 5,
    },
    streakBonus: {
      enabled: true,
      multiplierPerStreak: 0.1,
      maxMultiplier: 2,
    },
    difficultyMultipliers: {
      easy: 1,
      medium: 1.5,
      hard: 2,
    },
    estimation: {
      exactMatchBonus: -10,
      capAtMax: true,
      maxScore: 25,
      minScore: 1,
    },
  }

  return new ScoringEngine({ ...defaultConfig, ...config })
}

/**
 * Calculate quick score without engine instance
 */
export function quickScore(isCorrect: boolean, basePoints: number = 100): number {
  return isCorrect ? basePoints : 0
}
