/**
 * Question provider interface and utilities
 */

import type { Question, QuestionFilter, QuestionProvider } from "../types";

/**
 * Shuffle an array using Fisher-Yates algorithm
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Filter questions based on criteria
 */
export function filterQuestions<T extends Question>(
  questions: T[],
  filter?: QuestionFilter
): T[] {
  if (!filter) return questions;

  let filtered = [...questions];

  // Filter by categories
  if (filter.categories && filter.categories.length > 0) {
    filtered = filtered.filter((q) =>
      filter.categories!.includes(q.category)
    );
  }

  // Filter by difficulties
  if (filter.difficulties && filter.difficulties.length > 0) {
    filtered = filtered.filter(
      (q) => q.difficulty && filter.difficulties!.includes(q.difficulty)
    );
  }

  // Exclude specific IDs
  if (filter.excludeIds && filter.excludeIds.length > 0) {
    filtered = filtered.filter((q) => !filter.excludeIds!.includes(q.id));
  }

  // Shuffle if requested
  if (filter.shuffle) {
    filtered = shuffleArray(filtered);
  }

  // Limit count
  if (filter.count && filter.count > 0) {
    filtered = filtered.slice(0, filter.count);
  }

  return filtered;
}

/**
 * Extract unique categories from questions
 */
export function extractCategories(questions: Question[]): string[] {
  const categories = new Set<string>();
  questions.forEach((q) => categories.add(q.category));
  return Array.from(categories).sort();
}

/**
 * Base question provider implementation
 */
export abstract class BaseQuestionProvider<T extends Question = Question>
  implements QuestionProvider<T>
{
  protected questions: T[] = [];

  abstract loadQuestions(): Promise<void>;

  async getQuestions(filter?: QuestionFilter): Promise<T[]> {
    if (this.questions.length === 0) {
      await this.loadQuestions();
    }
    return filterQuestions(this.questions, filter);
  }

  async getCategories(): Promise<string[]> {
    if (this.questions.length === 0) {
      await this.loadQuestions();
    }
    return extractCategories(this.questions);
  }

  async getQuestionById(id: string): Promise<T | null> {
    if (this.questions.length === 0) {
      await this.loadQuestions();
    }
    return this.questions.find((q) => q.id === id) ?? null;
  }
}
