/**
 * Text answer validation with aliases and fuzzy matching
 */

import type { Question } from "../types";

export interface TextMatchOptions {
  caseSensitive?: boolean;
  trimWhitespace?: boolean;
  normalizeAccents?: boolean;
  allowPartialMatch?: boolean;
  minMatchScore?: number; // For fuzzy matching, 0-1
}

const DEFAULT_OPTIONS: TextMatchOptions = {
  caseSensitive: false,
  trimWhitespace: true,
  normalizeAccents: true,
  allowPartialMatch: false,
  minMatchScore: 0.8,
};

/**
 * Normalize text for comparison
 */
export function normalizeText(
  text: string,
  options: TextMatchOptions = DEFAULT_OPTIONS
): string {
  let normalized = text;

  if (options.trimWhitespace !== false) {
    normalized = normalized.trim().replace(/\s+/g, " ");
  }

  if (!options.caseSensitive) {
    normalized = normalized.toLowerCase();
  }

  if (options.normalizeAccents !== false) {
    normalized = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  return normalized;
}

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score (0-1) between two strings
 */
export function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  
  return 1 - distance / maxLength;
}

/**
 * Check if answer matches exactly (with normalization)
 */
export function exactMatch(
  answer: string,
  correct: string,
  options: TextMatchOptions = DEFAULT_OPTIONS
): boolean {
  const normalizedAnswer = normalizeText(answer, options);
  const normalizedCorrect = normalizeText(correct, options);
  
  return normalizedAnswer === normalizedCorrect;
}

/**
 * Check if answer matches any of the accepted answers
 */
export function matchesAnyAnswer(
  answer: string,
  acceptedAnswers: string[],
  options: TextMatchOptions = DEFAULT_OPTIONS
): { matches: boolean; matchedAnswer?: string } {
  const normalizedAnswer = normalizeText(answer, options);

  for (const accepted of acceptedAnswers) {
    const normalizedAccepted = normalizeText(accepted, options);
    
    if (normalizedAnswer === normalizedAccepted) {
      return { matches: true, matchedAnswer: accepted };
    }
  }

  return { matches: false };
}

/**
 * Fuzzy match with similarity scoring
 */
export function fuzzyMatch(
  answer: string,
  correct: string,
  options: TextMatchOptions = DEFAULT_OPTIONS
): { matches: boolean; similarity: number } {
  const normalizedAnswer = normalizeText(answer, options);
  const normalizedCorrect = normalizeText(correct, options);
  
  const similarity = calculateSimilarity(normalizedAnswer, normalizedCorrect);
  const minScore = options.minMatchScore ?? 0.8;
  
  return {
    matches: similarity >= minScore,
    similarity,
  };
}

/**
 * Find best fuzzy match from accepted answers
 */
export function findBestMatch(
  answer: string,
  acceptedAnswers: string[],
  options: TextMatchOptions = DEFAULT_OPTIONS
): { matches: boolean; bestMatch?: string; similarity: number } {
  const normalizedAnswer = normalizeText(answer, options);
  let bestSimilarity = 0;
  let bestMatch: string | undefined;

  for (const accepted of acceptedAnswers) {
    const normalizedAccepted = normalizeText(accepted, options);
    const similarity = calculateSimilarity(normalizedAnswer, normalizedAccepted);
    
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = accepted;
    }
  }

  const minScore = options.minMatchScore ?? 0.8;
  
  return {
    matches: bestSimilarity >= minScore,
    bestMatch,
    similarity: bestSimilarity,
  };
}

export interface ValidationResult {
  isCorrect: boolean;
  matchedAnswer?: string;
  similarity?: number;
  reason?: "exact" | "alias" | "fuzzy" | "numeric" | "wrong";
}

/**
 * Validate a text answer against a question
 */
export function validateTextAnswer(
  answer: string,
  question: Question,
  options?: TextMatchOptions
): ValidationResult {
  const opts = { ...DEFAULT_OPTIONS, caseSensitive: question.caseSensitive, ...options };

  // Build list of accepted answers
  const acceptedAnswers: string[] = [];
  
  if (question.correctText) {
    acceptedAnswers.push(question.correctText);
  }
  
  if (question.acceptedAnswers) {
    acceptedAnswers.push(...question.acceptedAnswers);
  }

  if (acceptedAnswers.length === 0) {
    return { isCorrect: false, reason: "wrong" };
  }

  // Try exact match first
  const exactResult = matchesAnyAnswer(answer, acceptedAnswers, opts);
  if (exactResult.matches) {
    return {
      isCorrect: true,
      matchedAnswer: exactResult.matchedAnswer,
      reason: exactResult.matchedAnswer === question.correctText ? "exact" : "alias",
    };
  }

  // Try fuzzy match if enabled
  if (opts.allowPartialMatch || opts.minMatchScore) {
    const fuzzyResult = findBestMatch(answer, acceptedAnswers, opts);
    if (fuzzyResult.matches) {
      return {
        isCorrect: true,
        matchedAnswer: fuzzyResult.bestMatch,
        similarity: fuzzyResult.similarity,
        reason: "fuzzy",
      };
    }
  }

  return { isCorrect: false, reason: "wrong" };
}

/**
 * Validate a multiple-choice answer
 */
export function validateMultipleChoiceAnswer(
  answer: number,
  question: Question
): ValidationResult {
  if (question.correctOptionIndex === undefined) {
    return { isCorrect: false, reason: "wrong" };
  }

  const isCorrect = answer === question.correctOptionIndex;
  
  return {
    isCorrect,
    reason: isCorrect ? "exact" : "wrong",
  };
}

/**
 * Validate a numeric answer (for estimation questions)
 */
export function validateNumericAnswer(
  answer: number,
  question: Question
): ValidationResult {
  if (question.correctNumber === undefined) {
    return { isCorrect: false, reason: "wrong" };
  }

  const isCorrect = answer === question.correctNumber;
  
  return {
    isCorrect,
    reason: "numeric",
    // For estimation, we don't mark wrong since scoring is based on distance
  };
}

/**
 * Validate any answer type
 */
export function validateAnswer(
  answer: string | number,
  question: Question,
  options?: TextMatchOptions
): ValidationResult {
  switch (question.answerType) {
    case "multiple-choice":
      return validateMultipleChoiceAnswer(answer as number, question);
    
    case "text":
      return validateTextAnswer(answer as string, question, options);
    
    case "numeric":
      return validateNumericAnswer(
        typeof answer === "string" ? parseFloat(answer) : answer,
        question
      );
    
    default:
      return { isCorrect: false, reason: "wrong" };
  }
}
