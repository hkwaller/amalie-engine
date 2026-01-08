/**
 * Player presence tracking via Supabase Realtime
 */

import type { SupabaseClientType } from "../types";

export interface PresenceState {
  playerId: string;
  playerName: string;
  isHost?: boolean;
  joinedAt: number;
  lastSeen?: number;
}

export type PresenceCallback = (presences: PresenceState[]) => void;
export type PresenceJoinCallback = (presence: PresenceState) => void;
export type PresenceLeaveCallback = (presence: PresenceState) => void;

/**
 * Presence manager for tracking connected players
 */
export class PresenceManager {
  private channel: ReturnType<SupabaseClientType["channel"]> | null = null;
  private presences: Map<string, PresenceState> = new Map();
  private callbacks: {
    sync: Set<PresenceCallback>;
    join: Set<PresenceJoinCallback>;
    leave: Set<PresenceLeaveCallback>;
  } = {
    sync: new Set(),
    join: new Set(),
    leave: new Set(),
  };

  /**
   * Initialize presence tracking on a channel
   */
  attach(channel: ReturnType<SupabaseClientType["channel"]>): void {
    this.channel = channel;

    // Set up presence handlers
    channel.on("presence", { event: "sync" }, () => {
      this.handleSync();
    });

    channel.on("presence", { event: "join" }, ({ newPresences }: { newPresences: PresenceState[] }) => {
      this.handleJoin(newPresences);
    });

    channel.on("presence", { event: "leave" }, ({ leftPresences }: { leftPresences: PresenceState[] }) => {
      this.handleLeave(leftPresences);
    });
  }

  /**
   * Track this client's presence
   */
  async track(state: PresenceState): Promise<void> {
    if (!this.channel) {
      throw new Error("Presence manager not attached to channel");
    }

    await this.channel.track(state);
  }

  /**
   * Untrack this client's presence
   */
  async untrack(): Promise<void> {
    if (!this.channel) return;
    await this.channel.untrack();
  }

  /**
   * Get current presences
   */
  getPresences(): PresenceState[] {
    return Array.from(this.presences.values());
  }

  /**
   * Get presence by player ID
   */
  getPresence(playerId: string): PresenceState | undefined {
    return this.presences.get(playerId);
  }

  /**
   * Check if player is present
   */
  isPresent(playerId: string): boolean {
    return this.presences.has(playerId);
  }

  /**
   * Subscribe to presence sync events
   */
  onSync(callback: PresenceCallback): () => void {
    this.callbacks.sync.add(callback);
    return () => this.callbacks.sync.delete(callback);
  }

  /**
   * Subscribe to presence join events
   */
  onJoin(callback: PresenceJoinCallback): () => void {
    this.callbacks.join.add(callback);
    return () => this.callbacks.join.delete(callback);
  }

  /**
   * Subscribe to presence leave events
   */
  onLeave(callback: PresenceLeaveCallback): () => void {
    this.callbacks.leave.add(callback);
    return () => this.callbacks.leave.delete(callback);
  }

  /**
   * Handle presence sync
   */
  private handleSync(): void {
    if (!this.channel) return;

    const presenceState = this.channel.presenceState();
    this.presences.clear();

    // Flatten presence state (Supabase groups by key)
    Object.values(presenceState).forEach((presences) => {
      if (Array.isArray(presences)) {
        presences.forEach((p: PresenceState) => {
          if (p.playerId) {
            this.presences.set(p.playerId, p);
          }
        });
      }
    });

    // Notify listeners
    const allPresences = this.getPresences();
    this.callbacks.sync.forEach((cb) => cb(allPresences));
  }

  /**
   * Handle presence join
   */
  private handleJoin(newPresences: PresenceState[]): void {
    newPresences.forEach((presence) => {
      if (presence.playerId) {
        this.presences.set(presence.playerId, presence);
        this.callbacks.join.forEach((cb) => cb(presence));
      }
    });
  }

  /**
   * Handle presence leave
   */
  private handleLeave(leftPresences: PresenceState[]): void {
    leftPresences.forEach((presence) => {
      if (presence.playerId) {
        this.presences.delete(presence.playerId);
        this.callbacks.leave.forEach((cb) => cb(presence));
      }
    });
  }

  /**
   * Clean up
   */
  destroy(): void {
    this.presences.clear();
    this.callbacks.sync.clear();
    this.callbacks.join.clear();
    this.callbacks.leave.clear();
    this.channel = null;
  }
}

/**
 * Create a presence manager
 */
export function createPresenceManager(): PresenceManager {
  return new PresenceManager();
}
