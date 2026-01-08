/**
 * JSON/Array-based question provider
 */

import type { Question, QuestionFilter, QuestionProvider } from '../types'
import { BaseQuestionProvider, filterQuestions, extractCategories } from './provider'

/**
 * Question provider that loads from a static array
 */
export class ArrayQuestionProvider<T extends Question = Question>
  extends BaseQuestionProvider<T>
  implements QuestionProvider<T>
{
  constructor(questions: T[]) {
    super()
    this.questions = [...questions]
  }

  async loadQuestions(): Promise<void> {
    // Already loaded in constructor
  }

  /**
   * Add questions to the pool
   */
  addQuestions(questions: T[]): void {
    this.questions.push(...questions)
  }

  /**
   * Replace all questions
   */
  setQuestions(questions: T[]): void {
    this.questions = [...questions]
  }

  /**
   * Remove a question by ID
   */
  removeQuestion(id: string): boolean {
    const index = this.questions.findIndex((q) => q.id === id)
    if (index !== -1) {
      this.questions.splice(index, 1)
      return true
    }
    return false
  }

  /**
   * Get total question count
   */
  getCount(): number {
    return this.questions.length
  }
}

/**
 * Question provider that loads from a JSON URL
 */
export class JsonUrlQuestionProvider<T extends Question = Question>
  extends BaseQuestionProvider<T>
  implements QuestionProvider<T>
{
  private url: string
  private loaded: boolean = false

  constructor(url: string) {
    super()
    this.url = url
  }

  async loadQuestions(): Promise<void> {
    if (this.loaded) return

    const response = await fetch(this.url)
    if (!response.ok) {
      throw new Error(`Failed to load questions from ${this.url}: ${response.statusText}`)
    }

    const data = await response.json()

    // Handle both array and { questions: [] } formats
    if (Array.isArray(data)) {
      this.questions = data
    } else if (data.questions && Array.isArray(data.questions)) {
      this.questions = data.questions
    } else {
      throw new Error('Invalid JSON format: expected array or { questions: [] }')
    }

    this.loaded = true
  }

  /**
   * Force reload from URL
   */
  async reload(): Promise<void> {
    this.loaded = false
    await this.loadQuestions()
  }
}

/**
 * Create a question provider from an array
 */
export function createArrayProvider<T extends Question = Question>(
  questions: T[],
): ArrayQuestionProvider<T> {
  return new ArrayQuestionProvider(questions)
}

/**
 * Create a question provider from a JSON URL
 */
export function createJsonUrlProvider<T extends Question = Question>(
  url: string,
): JsonUrlQuestionProvider<T> {
  return new JsonUrlQuestionProvider(url)
}

/**
 * Simple function to get filtered questions from an array
 */
export function getQuestions<T extends Question = Question>(
  questions: T[],
  filter?: QuestionFilter,
): T[] {
  return filterQuestions(questions, filter)
}

/**
 * Simple function to get categories from an array
 */
export function getCategories(questions: Question[]): string[] {
  return extractCategories(questions)
}
