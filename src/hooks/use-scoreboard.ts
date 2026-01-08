/**
 * useScoreboard - Hook for accessing and formatting scoreboard data
 */

import { useMemo } from "react";
import type { ScoreboardEntry, Player } from "../types";

export interface UseScoreboardOptions {
  players?: Player[];
  scoreboard?: ScoreboardEntry[];
  limit?: number;
}

export interface FormattedScoreboardEntry extends ScoreboardEntry {
  formattedScore: string;
  isTopThree: boolean;
  percentile: number;
}

export interface UseScoreboardReturn {
  entries: FormattedScoreboardEntry[];
  topThree: FormattedScoreboardEntry[];
  winner: FormattedScoreboardEntry | null;
  totalPlayers: number;
  highestScore: number;
  averageScore: number;
}

/**
 * Format a score for display
 */
function formatScore(score: number): string {
  if (score >= 1000000) {
    return `${(score / 1000000).toFixed(1)}M`;
  }
  if (score >= 1000) {
    return `${(score / 1000).toFixed(1)}K`;
  }
  return score.toString();
}

/**
 * Hook for scoreboard data and utilities
 */
export function useScoreboard(options: UseScoreboardOptions): UseScoreboardReturn {
  const { players, scoreboard, limit } = options;

  return useMemo(() => {
    // Use provided scoreboard or calculate from players
    let entries: ScoreboardEntry[] = scoreboard ?? [];

    if (!scoreboard && players) {
      entries = players
        .map((player, index) => ({
          playerId: player.id,
          playerName: player.name,
          score: player.score,
          rank: player.rank ?? index + 1,
          streak: player.streak,
        }))
        .sort((a, b) => b.score - a.score);

      // Assign ranks
      let currentRank = 1;
      entries = entries.map((entry, i) => ({
        ...entry,
        rank: i > 0 && entry.score < entries[i - 1].score ? ++currentRank : currentRank,
      }));
    }

    // Apply limit
    if (limit && limit > 0) {
      entries = entries.slice(0, limit);
    }

    // Calculate stats
    const totalPlayers = entries.length;
    const highestScore = entries.length > 0 ? Math.max(...entries.map((e) => e.score)) : 0;
    const averageScore = entries.length > 0
      ? entries.reduce((sum, e) => sum + e.score, 0) / entries.length
      : 0;

    // Format entries
    const formattedEntries: FormattedScoreboardEntry[] = entries.map((entry) => ({
      ...entry,
      formattedScore: formatScore(entry.score),
      isTopThree: entry.rank <= 3,
      percentile: highestScore > 0 ? (entry.score / highestScore) * 100 : 0,
    }));

    const topThree = formattedEntries.filter((e) => e.isTopThree);
    const winner = formattedEntries.find((e) => e.rank === 1) ?? null;

    return {
      entries: formattedEntries,
      topThree,
      winner,
      totalPlayers,
      highestScore,
      averageScore: Math.round(averageScore),
    };
  }, [players, scoreboard, limit]);
}

/**
 * Get rank suffix (1st, 2nd, 3rd, etc.)
 */
export function getRankSuffix(rank: number): string {
  if (rank >= 11 && rank <= 13) {
    return "th";
  }
  switch (rank % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

/**
 * Format rank with suffix
 */
export function formatRank(rank: number): string {
  return `${rank}${getRankSuffix(rank)}`;
}
