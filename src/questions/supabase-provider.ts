/**
 * Supabase-based question provider
 */

import type {
  Question,
  QuestionFilter,
  QuestionProvider,
  SupabaseClientType,
} from "../types";
import { BaseQuestionProvider, extractCategories, shuffleArray } from "./provider";

export interface SupabaseProviderConfig {
  tableName: string;
  categoryColumn?: string;
  difficultyColumn?: string;
  orderBy?: string;
  orderAscending?: boolean;
}

const DEFAULT_CONFIG: SupabaseProviderConfig = {
  tableName: "questions",
  categoryColumn: "category",
  difficultyColumn: "difficulty",
};

/**
 * Question provider that loads from Supabase
 */
export class SupabaseQuestionProvider<T extends Question = Question>
  extends BaseQuestionProvider<T>
  implements QuestionProvider<T>
{
  private client: SupabaseClientType;
  private config: SupabaseProviderConfig;
  private loaded: boolean = false;

  constructor(client: SupabaseClientType, config?: Partial<SupabaseProviderConfig>) {
    super();
    this.client = client;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async loadQuestions(): Promise<void> {
    if (this.loaded) return;

    let query = this.client.from(this.config.tableName).select("*");

    if (this.config.orderBy) {
      query = query.order(this.config.orderBy, {
        ascending: this.config.orderAscending ?? true,
      });
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to load questions: ${error.message}`);
    }

    this.questions = data as T[];
    this.loaded = true;
  }

  /**
   * Override getQuestions to use Supabase filtering when possible
   */
  async getQuestions(filter?: QuestionFilter): Promise<T[]> {
    // For complex filters with shuffle or excludeIds, load all and filter in memory
    if (filter?.shuffle || filter?.excludeIds?.length) {
      await this.loadQuestions();
      return this.filterInMemory(filter);
    }

    // Build Supabase query for server-side filtering
    let query = this.client.from(this.config.tableName).select("*");

    // Filter by categories
    if (filter?.categories && filter.categories.length > 0) {
      query = query.in(this.config.categoryColumn!, filter.categories);
    }

    // Filter by difficulties
    if (filter?.difficulties && filter.difficulties.length > 0) {
      query = query.in(this.config.difficultyColumn!, filter.difficulties);
    }

    // Limit count
    if (filter?.count && filter.count > 0) {
      query = query.limit(filter.count);
    }

    // Apply ordering
    if (this.config.orderBy) {
      query = query.order(this.config.orderBy, {
        ascending: this.config.orderAscending ?? true,
      });
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to load questions: ${error.message}`);
    }

    return data as T[];
  }

  /**
   * Filter questions in memory (after loading all)
   */
  private filterInMemory(filter?: QuestionFilter): T[] {
    if (!filter) return this.questions;

    let filtered = [...this.questions];

    // Filter by categories
    if (filter.categories && filter.categories.length > 0) {
      filtered = filtered.filter((q) => filter.categories!.includes(q.category));
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
   * Get categories directly from Supabase (distinct query)
   */
  async getCategories(): Promise<string[]> {
    const { data, error } = await this.client
      .from(this.config.tableName)
      .select(this.config.categoryColumn!)
      .order(this.config.categoryColumn!);

    if (error) {
      // Fallback to in-memory extraction
      await this.loadQuestions();
      return extractCategories(this.questions);
    }

    // Extract unique categories
    const categories = new Set<string>();
    data?.forEach((row: Record<string, string>) => {
      const category = row[this.config.categoryColumn!];
      if (category) categories.add(category);
    });

    return Array.from(categories).sort();
  }

  /**
   * Get a single question by ID from Supabase
   */
  async getQuestionById(id: string): Promise<T | null> {
    const { data, error } = await this.client
      .from(this.config.tableName)
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return null;
    }

    return data as T;
  }

  /**
   * Force reload from Supabase
   */
  async reload(): Promise<void> {
    this.loaded = false;
    await this.loadQuestions();
  }
}

/**
 * Create a Supabase question provider
 */
export function createSupabaseProvider<T extends Question = Question>(
  client: SupabaseClientType,
  config?: Partial<SupabaseProviderConfig>
): SupabaseQuestionProvider<T> {
  return new SupabaseQuestionProvider(client, config);
}
