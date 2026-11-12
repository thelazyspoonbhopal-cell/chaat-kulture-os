/**
 * CHAAT KULTURE OS — REALTIME SESSION & SINGLE-DEVICE EVICTION BUS
 * Uses BroadcastChannel for instant (<10ms) cross-tab eviction on the same device
 * and Supabase Realtime for instant cross-device revocation.
 */

import { supabase, isSupabaseConfigured } from '../supabase';

export type SessionBusMessage =
  | { type: 'CONCURRENT_LOGIN'; userId: string; newSessionId: string; deviceName: string }
  | { type: 'SESSION_REVOKED'; sessionId: string; reason: string }
  | { type: 'DATA_SYNCED'; source: string; timestamp: string };

type SessionListener = (msg: SessionBusMessage) => void;

class SessionChannelBus {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<SessionListener> = new Set();
  private supabaseSubscription: any = null;

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('chaat_kulture_session_bus');
      this.channel.onmessage = (event: MessageEvent<SessionBusMessage>) => {
        this.notify(event.data);
      };
    }
  }

  /**
   * Broadcast a session event to all other tabs on this machine
   */
  public broadcast(msg: SessionBusMessage) {
    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch (err) {
        console.warn('[SessionBus] Broadcast error:', err);
      }
    }
  }

  /**
   * Subscribe to bus messages
   */
  public subscribe(callback: SessionListener): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify(msg: SessionBusMessage) {
    this.listeners.forEach(cb => {
      try {
        cb(msg);
      } catch (err) {
        console.error('[SessionBus] Listener error:', err);
      }
    });
  }

  /**
   * Listen for cloud session revocations via Supabase Realtime
   */
  public listenToCloudRevocations(userId: string, onRevoked: (reason: string) => void) {
    if (!isSupabaseConfigured || !supabase) return () => {};

    try {
      const channel = supabase
        .channel(`user_sessions_${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'user_sessions',
            filter: `user_id=eq.${userId}`,
          },
          (payload: any) => {
            if (payload?.new && payload.new.is_active === false) {
              onRevoked(payload.new.revocation_reason || 'concurrent_login_override');
            }
          }
        )
        .subscribe();

      this.supabaseSubscription = channel;

      return () => {
        if (supabase && channel) {
          supabase.removeChannel(channel);
        }
      };
    } catch (err) {
      console.warn('[SessionBus] Realtime cloud subscription skipped:', err);
      return () => {};
    }
  }
}

export const sessionBus = new SessionChannelBus();
