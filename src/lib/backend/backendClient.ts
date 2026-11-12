/**
 * CHAAT KULTURE OS — LOCAL BACKEND API & SYNC CLIENT
 * Connects the local-first Dexie.js frontend to the local Node.js backend server (port 3001).
 */

import { db } from '../db';

export interface BackendStatus {
  online: boolean;
  version?: string;
  databaseFile?: string;
  lastChecked: Date;
  counts?: {
    locations: number;
    menu_items: number;
    inventory_items: number;
    sales_recorded: number;
    daily_closings: number;
  };
}

class BackendClient {
  private isOnline = false;
  private statusListeners: ((status: BackendStatus) => void)[] = [];
  private lastStatus: BackendStatus = {
    online: false,
    lastChecked: new Date()
  };

  constructor() {
    this.checkHealth();
    // Poll backend health every 10 seconds
    setInterval(() => {
      this.checkHealth();
    }, 10000);
  }

  public onStatusChange(callback: (status: BackendStatus) => void) {
    this.statusListeners.push(callback);
    callback(this.lastStatus);
    return () => {
      this.statusListeners = this.statusListeners.filter(cb => cb !== callback);
    };
  }

  private notifyListeners() {
    for (const listener of this.statusListeners) {
      listener(this.lastStatus);
    }
  }

  public async checkHealth(): Promise<BackendStatus> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const res = await fetch('/api/health', { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        this.isOnline = true;
        this.lastStatus = {
          online: true,
          version: data.version,
          databaseFile: data.database?.file || 'data/local_db.json',
          lastChecked: new Date(),
          counts: data.database
        };
      } else {
        this.isOnline = false;
        this.lastStatus = { online: false, lastChecked: new Date() };
      }
    } catch {
      this.isOnline = false;
      this.lastStatus = { online: false, lastChecked: new Date() };
    }

    this.notifyListeners();
    return this.lastStatus;
  }

  public getStatus(): BackendStatus {
    return this.lastStatus;
  }

  /**
   * Sync all local Dexie tables to the local backend server
   */
  public async syncToBackend(): Promise<{ success: boolean; message: string; summary?: any }> {
    try {
      const health = await this.checkHealth();
      if (!health.online) {
        return { success: false, message: 'Local backend server is offline (port 3001 not reachable)' };
      }

      // Collect data from Dexie tables
      const tablesPayload: Record<string, any[]> = {
        locations: await db.locations.toArray(),
        menu_items: await db.menu_items.toArray(),
        menu_categories: await db.menu_categories.toArray(),
        inventory_items: await db.inventory_items.toArray(),
        inventory_categories: await db.inventory_categories.toArray(),
        inventory_balances: await db.inventory_balances.toArray(),
        inventory_movements: await db.inventory_movements.toArray(),
        suppliers: await db.suppliers.toArray(),
        purchases: await db.purchases.toArray(),
        sales: await db.sales.toArray(),
        expenses: await db.expenses.toArray(),
        stock_requests: await db.stock_requests.toArray(),
        production_records: await db.production_records.toArray(),
        dispatches: await db.dispatches.toArray(),
        wastage_records: await db.wastage_records.toArray(),
        daily_closings: await db.daily_closings.toArray(),
        cash_transfers_to_owner: await db.cash_transfers_to_owner.toArray(),
        user_profiles: await db.user_profiles.toArray(),
        user_sessions: await db.user_sessions.toArray(),
        login_audit_logs: await db.login_audit_logs.toArray(),
        login_approval_requests: await db.login_approval_requests.toArray()
      };

      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tables: tablesPayload })
      });

      if (!res.ok) {
        throw new Error(`Sync failed with HTTP ${res.status}`);
      }

      const resData = await res.json();
      return {
        success: true,
        message: 'Synchronized IndexedDB with local backend database successfully',
        summary: resData.summary
      };
    } catch (err: any) {
      return { success: false, message: `Sync failed: ${err.message}` };
    }
  }

  /**
   * Safe Sandbox Purge on Backend
   */
  public async purgeBackendSandbox(): Promise<{ success: boolean; purgedCount?: number }> {
    try {
      if (!this.isOnline) return { success: false };
      const res = await fetch('/api/sandbox/purge', { method: 'POST' });
      if (res.ok) {
        return await res.json();
      }
      return { success: false };
    } catch {
      return { success: false };
    }
  }
}

export const backendClient = new BackendClient();
