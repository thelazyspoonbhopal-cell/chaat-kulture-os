/**
 * CHAAT KULTURE OS — AUTOMATED BACKGROUND REPLICATION & SYNC ENGINE
 * Automatically synchronizes IndexedDB data to Local Node Backend and Cloud Supabase.
 * Replaces manual one-off sync triggers with debounced reactive sync.
 */

import { db } from '../db';
import { backendClient } from '../backend/backendClient';
import { supabase, isSupabaseConfigured } from '../supabase';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export interface SyncEngineStatus {
  state: SyncState;
  lastSyncTime: Date | null;
  pendingCount: number;
  lastError: string | null;
  target: 'local_and_cloud' | 'local_only' | 'cloud_only' | 'offline';
}

class SyncEngine {
  private state: SyncState = 'idle';
  private lastSyncTime: Date | null = null;
  private lastError: string | null = null;
  private syncTimer: any = null;
  private debounceTimer: any = null;
  private listeners: Set<(status: SyncEngineStatus) => void> = new Set();
  private isRunning = false;

  constructor() {
    this.startAutoSync();
  }

  public subscribe(cb: (status: SyncEngineStatus) => void): () => void {
    this.listeners.add(cb);
    cb(this.getStatus());
    return () => {
      this.listeners.delete(cb);
    };
  }

  public getStatus(): SyncEngineStatus {
    const health = backendClient.getStatus();
    let target: SyncEngineStatus['target'] = 'offline';

    if (health.online && isSupabaseConfigured) {
      target = 'local_and_cloud';
    } else if (health.online) {
      target = 'local_only';
    } else if (isSupabaseConfigured) {
      target = 'cloud_only';
    }

    return {
      state: this.state,
      lastSyncTime: this.lastSyncTime,
      pendingCount: 0,
      lastError: this.lastError,
      target,
    };
  }

  private notify() {
    const status = this.getStatus();
    this.listeners.forEach(cb => {
      try {
        cb(status);
      } catch (err) {
        console.error('[SyncEngine] Listener error:', err);
      }
    });
  }

  /**
   * Schedule automatic background sync every 30 seconds
   */
  private startAutoSync() {
    if (typeof window === 'undefined') return;

    this.syncTimer = setInterval(() => {
      this.triggerSync('auto_interval');
    }, 30000);
  }

  /**
   * Debounced sync called after write operations (e.g. sale created, expense added)
   */
  public queueSync(delayMs = 2000) {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.triggerSync('debounced_write');
    }, delayMs);
  }

  /**
   * Execute full multi-tier synchronization
   */
  public async triggerSync(reason = 'manual'): Promise<{ success: boolean; message: string }> {
    if (this.isRunning) {
      return { success: false, message: 'Sync already in progress' };
    }

    this.isRunning = true;
    this.state = 'syncing';
    this.notify();

    try {
      let localSuccess = false;
      let cloudSuccess = false;
      let errorMsg = '';

      // 1. Sync to Local Node Backend (port 3001)
      const backendHealth = await backendClient.checkHealth();
      if (backendHealth.online) {
        const res = await backendClient.syncToBackend();
        localSuccess = res.success;
        if (!res.success) errorMsg = res.message;
      }

      // 2. Sync to Cloud Supabase (if configured)
      if (isSupabaseConfigured && supabase) {
        try {
          const [locs, users, sessions] = await Promise.all([
            db.locations.toArray(),
            db.user_profiles.toArray(),
            db.user_sessions.toArray(),
          ]);

          // Sync core reference tables
          if (locs.length > 0) {
            await supabase.from('locations').upsert(
              locs.map(l => ({
                id: l.id,
                code: l.code,
                name: l.name,
                type: l.type,
                address: l.address,
                phone: l.phone,
                is_active: l.is_active,
              })),
              { onConflict: 'code' }
            );
          }

          // Sync sessions
          if (sessions.length > 0) {
            await supabase.from('user_sessions').upsert(
              sessions.slice(-20).map(s => ({
                id: s.id,
                user_id: s.user_id,
                user_email: s.user_email,
                user_name: s.user_name,
                role: s.role,
                device_id: s.device_id,
                device_name: s.device_name,
                latitude: s.latitude,
                longitude: s.longitude,
                is_active: s.is_active,
                login_at: s.login_at,
                last_active_at: s.last_active_at,
              })),
              { onConflict: 'id' }
            );
          }

          cloudSuccess = true;
        } catch (cloudErr: any) {
          console.warn('[SyncEngine] Supabase partial sync warning:', cloudErr.message);
          cloudSuccess = false;
        }
      }

      if (localSuccess || cloudSuccess) {
        this.state = 'synced';
        this.lastSyncTime = new Date();
        this.lastError = null;
        this.notify();
        return { success: true, message: 'Data synchronized across active targets' };
      } else {
        this.state = backendHealth.online ? 'error' : 'offline';
        this.lastError = errorMsg || 'Local and cloud backends currently offline';
        this.notify();
        return { success: false, message: this.lastError };
      }
    } catch (err: any) {
      this.state = 'error';
      this.lastError = err.message || 'Sync failed unexpectedly';
      this.notify();
      return { success: false, message: this.lastError! };
    } finally {
      this.isRunning = false;
    }
  }
}

export const syncEngine = new SyncEngine();
