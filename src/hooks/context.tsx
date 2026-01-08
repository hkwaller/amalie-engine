/**
 * QuizProvider - React context provider for quiz game state
 */

import { createContext, useContext, ReactNode } from "react";
import type { SupabaseClientType } from "../types";

// Context for Supabase client
interface QuizContextValue {
  supabaseClient: SupabaseClientType;
}

const QuizContext = createContext<QuizContextValue | null>(null);

export interface QuizProviderProps {
  children: ReactNode;
  supabaseClient: SupabaseClientType;
}

/**
 * Provider component that makes Supabase client available to all quiz hooks
 */
export function QuizProvider({ children, supabaseClient }: QuizProviderProps) {
  return (
    <QuizContext.Provider value={{ supabaseClient }}>
      {children}
    </QuizContext.Provider>
  );
}

/**
 * Hook to access the quiz context
 */
export function useQuizContext(): QuizContextValue {
  const context = useContext(QuizContext);
  if (!context) {
    throw new Error("useQuizContext must be used within a QuizProvider");
  }
  return context;
}

/**
 * Hook to access the Supabase client from context
 */
export function useSupabaseClient(): SupabaseClientType {
  const { supabaseClient } = useQuizContext();
  return supabaseClient;
}
