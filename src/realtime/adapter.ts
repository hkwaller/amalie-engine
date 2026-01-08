/**
 * Supabase Realtime adapter for quiz game communication
 */

import type { SupabaseClientType, GameMessage } from "../types";
import { PresenceManager, PresenceState, createPresenceManager } from "./presence";

export type MessageHandler = (message: GameMessage, senderId?: string) => void;
export type ConnectionHandler = (isConnected: boolean) => void;
export type ErrorHandler = (error: Error) => void;

export interface RealtimeAdapterConfig {
  roomCode: string;
  isHost?: boolean;
}

/**
 * Realtime adapter for Supabase channel communication
 */
export class RealtimeAdapter {
  private client: SupabaseClientType;
  private config: RealtimeAdapterConfig;
  private channel: ReturnType<SupabaseClientType["channel"]> | null = null;
  private presenceManager: PresenceManager;
  private isConnected: boolean = false;

  private messageHandlers: Set<MessageHandler> = new Set();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private errorHandlers: Set<ErrorHandler> = new Set();

  constructor(client: SupabaseClientType, config: RealtimeAdapterConfig) {
    this.client = client;
    this.config = config;
    this.presenceManager = createPresenceManager();
  }

  /**
   * Connect to the realtime channel
   */
  async connect(): Promise<void> {
    if (this.channel) {
      await this.disconnect();
    }

    const channelName = `quiz:${this.config.roomCode}`;
    this.channel = this.client.channel(channelName, {
      config: {
        broadcast: { self: false }, // Don't receive own broadcasts
        presence: { key: "" }, // Will be set when tracking
      },
    });

    // Attach presence manager
    this.presenceManager.attach(this.channel);

    // Set up broadcast message handler
    this.channel.on("broadcast", { event: "message" }, ({ payload }: { payload: unknown }) => {
      if (payload && typeof payload === "object") {
        this.handleMessage(payload as GameMessage);
      }
    });

    // Set up direct message handler (for host -> specific player)
    this.channel.on("broadcast", { event: "direct" }, ({ payload }: { payload: unknown }) => {
      if (payload && typeof payload === "object") {
        const { targetPlayerId, message } = payload as {
          targetPlayerId: string;
          message: GameMessage;
        };
        // Only handle if this is the target player
        // (handled in hooks by checking playerId)
        this.handleMessage(message, targetPlayerId);
      }
    });

    // Subscribe to channel
    return new Promise((resolve, reject) => {
      this.channel!.subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          this.isConnected = true;
          this.notifyConnectionChange(true);
          resolve();
        } else if (status === "CHANNEL_ERROR") {
          const error = new Error("Failed to connect to channel");
          this.notifyError(error);
          reject(error);
        } else if (status === "TIMED_OUT") {
          const error = new Error("Connection timed out");
          this.notifyError(error);
          reject(error);
        } else if (status === "CLOSED") {
          this.isConnected = false;
          this.notifyConnectionChange(false);
        }
      });
    });
  }

  /**
   * Disconnect from the channel
   */
  async disconnect(): Promise<void> {
    if (this.channel) {
      await this.presenceManager.untrack();
      await this.client.removeChannel(this.channel);
      this.channel = null;
      this.isConnected = false;
      this.notifyConnectionChange(false);
    }
    this.presenceManager.destroy();
  }

  /**
   * Broadcast a message to all players
   */
  async broadcast(message: GameMessage): Promise<void> {
    if (!this.channel) {
      throw new Error("Not connected to channel");
    }

    await this.channel.send({
      type: "broadcast",
      event: "message",
      payload: message,
    });
  }

  /**
   * Send a direct message to a specific player
   */
  async sendDirect(targetPlayerId: string, message: GameMessage): Promise<void> {
    if (!this.channel) {
      throw new Error("Not connected to channel");
    }

    await this.channel.send({
      type: "broadcast",
      event: "direct",
      payload: { targetPlayerId, message },
    });
  }

  /**
   * Track presence for this client
   */
  async trackPresence(state: Omit<PresenceState, "isHost">): Promise<void> {
    await this.presenceManager.track({
      ...state,
      isHost: this.config.isHost,
    });
  }

  /**
   * Get presence manager for subscriptions
   */
  getPresenceManager(): PresenceManager {
    return this.presenceManager;
  }

  /**
   * Check if connected
   */
  getIsConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Subscribe to messages
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  /**
   * Subscribe to connection changes
   */
  onConnectionChange(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  /**
   * Subscribe to errors
   */
  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: GameMessage, targetPlayerId?: string): void {
    this.messageHandlers.forEach((handler) => handler(message, targetPlayerId));
  }

  /**
   * Notify connection change
   */
  private notifyConnectionChange(isConnected: boolean): void {
    this.connectionHandlers.forEach((handler) => handler(isConnected));
  }

  /**
   * Notify error
   */
  private notifyError(error: Error): void {
    this.errorHandlers.forEach((handler) => handler(error));
  }

  /**
   * Get room code
   */
  getRoomCode(): string {
    return this.config.roomCode;
  }
}

/**
 * Create a realtime adapter
 */
export function createRealtimeAdapter(
  client: SupabaseClientType,
  config: RealtimeAdapterConfig
): RealtimeAdapter {
  return new RealtimeAdapter(client, config);
}
