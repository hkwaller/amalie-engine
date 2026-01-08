/**
 * Answer timing system with late rejection and first-to-answer ordering
 */

import type { PlayerAnswer, AnswerMode } from '../types'

export interface AnswerTrackerConfig {
  answerMode: AnswerMode
  allowLateAnswers: boolean
  timeLimit?: number // seconds
}

export interface AnswerSubmission {
  playerId: string
  questionId: string
  answer: string | number
  submittedAt: number // Unix timestamp
}

export interface AnswerResult {
  accepted: boolean
  rejected: boolean
  rejectReason?: 'late' | 'already-answered' | 'invalid'
  playerAnswer?: PlayerAnswer
  answerOrder?: number // 1-based position for first-to-answer mode
}

export class AnswerTracker {
  private config: AnswerTrackerConfig
  private questionStartTime: number = 0
  private answers: Map<string, PlayerAnswer> = new Map()
  private answerOrder: string[] = [] // Player IDs in order of submission

  constructor(config: AnswerTrackerConfig) {
    this.config = config
  }

  /**
   * Start tracking answers for a new question
   */
  startQuestion(startTime: number = Date.now()): void {
    this.questionStartTime = startTime
    this.answers.clear()
    this.answerOrder = []
  }

  /**
   * Submit an answer and get result
   */
  submitAnswer(submission: AnswerSubmission): AnswerResult {
    const { playerId, questionId, answer, submittedAt } = submission

    // Check if player already answered
    if (this.answers.has(playerId)) {
      return {
        accepted: false,
        rejected: true,
        rejectReason: 'already-answered',
      }
    }

    // Calculate time since question started
    const answeredAt = submittedAt - this.questionStartTime

    // Check for late submission
    if (this.config.timeLimit && !this.config.allowLateAnswers) {
      const timeLimitMs = this.config.timeLimit * 1000
      if (answeredAt > timeLimitMs) {
        return {
          accepted: false,
          rejected: true,
          rejectReason: 'late',
        }
      }
    }

    // Track answer order
    this.answerOrder.push(playerId)
    const answerOrder = this.answerOrder.length

    // Create player answer
    const playerAnswer: PlayerAnswer = {
      playerId,
      questionId,
      answer,
      timestamp: submittedAt,
      answeredAt,
    }

    this.answers.set(playerId, playerAnswer)

    return {
      accepted: true,
      rejected: false,
      playerAnswer,
      answerOrder,
    }
  }

  /**
   * Get all submitted answers
   */
  getAnswers(): Map<string, PlayerAnswer> {
    return new Map(this.answers)
  }

  /**
   * Get answers in submission order
   */
  getAnswersInOrder(): PlayerAnswer[] {
    return this.answerOrder
      .map((playerId) => this.answers.get(playerId))
      .filter((answer): answer is PlayerAnswer => answer !== undefined)
  }

  /**
   * Get answer by player ID
   */
  getAnswer(playerId: string): PlayerAnswer | undefined {
    return this.answers.get(playerId)
  }

  /**
   * Check if player has answered
   */
  hasAnswered(playerId: string): boolean {
    return this.answers.has(playerId)
  }

  /**
   * Get the first answer (for first-to-answer mode)
   */
  getFirstAnswer(): PlayerAnswer | undefined {
    const firstPlayerId = this.answerOrder[0]
    return firstPlayerId ? this.answers.get(firstPlayerId) : undefined
  }

  /**
   * Get answer position (1-based)
   */
  getAnswerPosition(playerId: string): number {
    const index = this.answerOrder.indexOf(playerId)
    return index === -1 ? -1 : index + 1
  }

  /**
   * Get remaining time in milliseconds
   */
  getRemainingTime(): number | null {
    if (!this.config.timeLimit) return null

    const elapsed = Date.now() - this.questionStartTime
    const remaining = this.config.timeLimit * 1000 - elapsed
    return Math.max(0, remaining)
  }

  /**
   * Check if time has expired
   */
  isTimeExpired(): boolean {
    if (!this.config.timeLimit) return false

    const elapsed = Date.now() - this.questionStartTime
    return elapsed >= this.config.timeLimit * 1000
  }

  /**
   * Get time elapsed since question started (in milliseconds)
   */
  getElapsedTime(): number {
    return Date.now() - this.questionStartTime
  }

  /**
   * Get number of answers received
   */
  getAnswerCount(): number {
    return this.answers.size
  }

  /**
   * Update answer with validation results
   */
  updateAnswer(
    playerId: string,
    updates: Partial<Pick<PlayerAnswer, 'isCorrect' | 'pointsAwarded'>>,
  ): void {
    const answer = this.answers.get(playerId)
    if (answer) {
      this.answers.set(playerId, { ...answer, ...updates })
    }
  }

  /**
   * Get configuration
   */
  getConfig(): AnswerTrackerConfig {
    return { ...this.config }
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<AnswerTrackerConfig>): void {
    this.config = { ...this.config, ...updates }
  }
}

/**
 * Create an answer tracker with default configuration
 */
export function createAnswerTracker(config: Partial<AnswerTrackerConfig> = {}): AnswerTracker {
  return new AnswerTracker({
    answerMode: config.answerMode ?? 'all-players',
    allowLateAnswers: config.allowLateAnswers ?? false,
    timeLimit: config.timeLimit,
  })
}
