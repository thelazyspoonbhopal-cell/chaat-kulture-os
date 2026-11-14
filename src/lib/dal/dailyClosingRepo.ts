import { db } from '../db';
import { DailyClosing, CashClosing, StockCount, RecordRevision, SectionStatus } from '../../types';
import { cashTransfersRepo } from './cashTransfersRepo';
import { fetchGistFile, updateGistFiles } from '../sync/cloudRegistry';
import { salesRepo } from './salesRepo';

export const CLOSINGS_GIST_FILE = 'chaat_kulture_closings.json';

export interface CloudClosingsPayload {
  daily_closings: DailyClosing[];
  cash_closings: CashClosing[];
  stock_counts: StockCount[];
  revisions: RecordRevision[];
  updated_at: string;
}

let isClosingSyncing = false;
let closingSyncTimeout: any = null;

export interface DayClosingLiveStats {
  sales: {
    totalOrders: number;
    grossSales: number;
    discountTotal: number;
    netSales: number;
    refundsTotal: number;
    complimentaryCount: number;
    cashSales: number;
    upiSales: number;
    cardSales: number;
    channelBreakdown: {
      walk_in: number;
      zomato: number;
      swiggy: number;
      other: number;
    };
  };
  expenses: {
    totalCashExpenses: number;
    totalDigitalExpenses: number;
    totalExpenses: number;
    count: number;
  };
  cashTransfers: {
    totalTransferredToOwner: number;
    count: number;
  };
  wastage: {
    totalItemsWasted: number;
    count: number;
  };
  transfersIn: {
    receivedChallansCount: number;
  };
  transfersOut: {
    dispatchedChallansCount: number;
  };
}

export const dailyClosingRepo = {
  // ---------------- CLOUD REGISTRY SYNC ----------------
  async fetchCloudClosings(): Promise<CloudClosingsPayload | null> {
    try {
      const data = await fetchGistFile<CloudClosingsPayload>(CLOSINGS_GIST_FILE);
      if (data && (Array.isArray(data.daily_closings) || Array.isArray(data.cash_closings))) {
        return data;
      }
    } catch (err) {
      console.warn('[DailyClosingRepo] Failed to fetch cloud closings:', err);
    }
    return null;
  },

  async syncClosingsToCloud(): Promise<boolean> {
    try {
      const [closings, cash, stock, revisions] = await Promise.all([
        db.daily_closings.toArray(),
        db.cash_closings.toArray(),
        db.stock_counts.toArray(),
        db.record_revisions.toArray(),
      ]);

      const payload: CloudClosingsPayload = {
        daily_closings: closings,
        cash_closings: cash,
        stock_counts: stock,
        revisions: revisions,
        updated_at: new Date().toISOString(),
      };

      return await updateGistFiles({
        [CLOSINGS_GIST_FILE]: payload,
      });
    } catch (err) {
      console.error('[DailyClosingRepo] Failed to sync closings to cloud:', err);
      return false;
    }
  },

  debouncedSyncToCloud() {
    if (closingSyncTimeout) clearTimeout(closingSyncTimeout);
    closingSyncTimeout = setTimeout(() => {
      this.syncClosingsToCloud().catch(e => console.warn('[DailyClosingRepo] Background sync failed:', e));
    }, 2000);
  },

  async syncFromCloud(force = false): Promise<void> {
    if (isClosingSyncing && !force) return;
    isClosingSyncing = true;
    try {
      const [cloudData, localClosings, localCash] = await Promise.all([
        this.fetchCloudClosings(),
        db.daily_closings.toArray(),
        db.cash_closings.toArray(),
      ]);

      if (cloudData) {
        if (Array.isArray(cloudData.daily_closings)) {
          for (const item of cloudData.daily_closings) {
            await db.daily_closings.put(item);
          }
        }
        if (Array.isArray(cloudData.cash_closings)) {
          for (const item of cloudData.cash_closings) {
            await db.cash_closings.put(item);
          }
        }
        if (Array.isArray(cloudData.stock_counts)) {
          for (const item of cloudData.stock_counts) {
            await db.stock_counts.put(item);
          }
        }
        if (Array.isArray(cloudData.revisions)) {
          for (const item of cloudData.revisions) {
            await db.record_revisions.put(item);
          }
        }

        // Push local union if local has records missing in cloud
        const cloudClosingIds = new Set((cloudData.daily_closings || []).map(c => c.id));
        const hasExtra = localClosings.some(c => !cloudClosingIds.has(c.id));
        if (hasExtra) {
          await this.syncClosingsToCloud();
        }
      } else if (localClosings.length > 0 || localCash.length > 0) {
        await this.syncClosingsToCloud();
      }
    } catch (err) {
      console.error('[DailyClosingRepo] Sync from cloud failed:', err);
    } finally {
      isClosingSyncing = false;
    }
  },

  async getOrCreateDailyClosing(locationId: string, closingDate: string): Promise<DailyClosing> {
    let existing = await db.daily_closings
      .where('location_id')
      .equals(locationId)
      .and(dc => dc.closing_date === closingDate)
      .first();

    if (!existing) {
      await this.syncFromCloud();
      existing = await db.daily_closings
        .where('location_id')
        .equals(locationId)
        .and(dc => dc.closing_date === closingDate)
        .first();
    }

    if (existing) {
      return existing;
    }

    const business = await db.businesses.toCollection().first();
    const businessId = business?.id || 'biz_ck_01';
    const now = new Date().toISOString();

    const newClosing: DailyClosing = {
      id: `dc_${locationId}_${closingDate}`,
      business_id: businessId,
      location_id: locationId,
      closing_date: closingDate,
      status: 'not_started',
      sales_status: 'not_started',
      cash_status: 'not_started',
      upi_status: 'not_started',
      zomato_status: 'not_started',
      swiggy_status: 'not_started',
      expenses_status: 'not_started',
      stock_status: 'not_started',
      wastage_status: 'not_started',
      receiving_status: 'not_started',
      dispatch_status: 'not_started',
      notes_status: 'not_started',
      final_submission_status: 'not_started',
      completed_sections_count: 0,
      created_at: now,
      updated_at: now,
    };

    await db.daily_closings.put(newClosing);
    this.debouncedSyncToCloud();
    return newClosing;
  },

  async calculateLiveStats(locationId: string, dateStr: string): Promise<DayClosingLiveStats> {
    // 1. Sales for date
    let allSales = await db.sales.where('location_id').equals(locationId).toArray();
    if (allSales.length === 0) {
      await salesRepo.syncFromCloud();
      allSales = await db.sales.where('location_id').equals(locationId).toArray();
    }
    const daySales = allSales.filter(s => s.created_at.startsWith(dateStr));

    let grossSales = 0;
    let discountTotal = 0;
    let netSales = 0;
    let refundsTotal = 0;
    let complimentaryCount = 0;
    let cashSales = 0;
    let upiSales = 0;
    let cardSales = 0;

    const channelBreakdown = {
      walk_in: 0,
      zomato: 0,
      swiggy: 0,
      other: 0,
    };

    for (const sale of daySales) {
      grossSales += sale.gross_amount || 0;
      discountTotal += sale.discount_amount || 0;
      netSales += sale.net_amount || 0;

      if (sale.payment_status === 'partially_refunded' || sale.payment_status === 'fully_refunded') {
        refundsTotal += (sale.discount_amount || 0); // or refund tracker
      }

      if (sale.channel in channelBreakdown) {
        channelBreakdown[sale.channel as keyof typeof channelBreakdown] += sale.net_amount || 0;
      }

      if (sale.payments && sale.payments.length > 0) {
        for (const p of sale.payments) {
          if (p.payment_method === 'cash') cashSales += p.amount;
          else if (p.payment_method === 'upi') upiSales += p.amount;
          else if (p.payment_method === 'card') cardSales += p.amount;
        }
      }

      if (sale.items) {
        for (const itm of sale.items) {
          if (itm.is_complimentary) complimentaryCount += 1;
        }
      }
    }

    // 2. Expenses for date
    const allExpenses = await db.expenses.where('location_id').equals(locationId).toArray();
    const dayExpenses = allExpenses.filter(e => e.expense_date === dateStr || e.created_at.startsWith(dateStr));

    let totalCashExpenses = 0;
    let totalDigitalExpenses = 0;

    for (const exp of dayExpenses) {
      if (exp.payment_status === 'paid' || exp.payment_status === 'partially_paid') {
        const paid = exp.amount_paid || exp.amount || 0;
        if (exp.payment_method === 'cash') {
          totalCashExpenses += paid;
        } else {
          totalDigitalExpenses += paid;
        }
      }
    }

    // 3. Cash transfers to owner
    const totalTransferredToOwner = await cashTransfersRepo.getTotalTransferredForDate(locationId, dateStr);
    const transfersList = await cashTransfersRepo.getTransfersForDate(locationId, dateStr);

    // 4. Wastage
    const allWastage = await db.wastage_records.where('location_id').equals(locationId).toArray();
    const dayWastage = allWastage.filter(w => w.created_at.startsWith(dateStr));
    const totalItemsWasted = dayWastage.reduce((sum, w) => sum + (w.quantity || 0), 0);

    // 5. Inward transfers / Receiving
    const dispatchesIn = await db.dispatches
      .where('to_location_id')
      .equals(locationId)
      .filter(d => (d.received_date ? d.received_date.startsWith(dateStr) : d.created_at.startsWith(dateStr)))
      .toArray();

    // 6. Outward transfers / Dispatches
    const dispatchesOut = await db.dispatches
      .where('from_location_id')
      .equals(locationId)
      .filter(d => d.dispatch_date.startsWith(dateStr) || d.created_at.startsWith(dateStr))
      .toArray();

    return {
      sales: {
        totalOrders: daySales.length,
        grossSales,
        discountTotal,
        netSales,
        refundsTotal,
        complimentaryCount,
        cashSales,
        upiSales,
        cardSales,
        channelBreakdown,
      },
      expenses: {
        totalCashExpenses,
        totalDigitalExpenses,
        totalExpenses: totalCashExpenses + totalDigitalExpenses,
        count: dayExpenses.length,
      },
      cashTransfers: {
        totalTransferredToOwner,
        count: transfersList.length,
      },
      wastage: {
        totalItemsWasted,
        count: dayWastage.length,
      },
      transfersIn: {
        receivedChallansCount: dispatchesIn.length,
      },
      transfersOut: {
        dispatchedChallansCount: dispatchesOut.length,
      },
    };
  },

  async getCashClosing(locationId: string, closingDate: string): Promise<CashClosing | undefined> {
    let record = await db.cash_closings
      .where('location_id')
      .equals(locationId)
      .and(c => c.closing_date === closingDate)
      .first();

    if (!record) {
      await this.syncFromCloud();
      record = await db.cash_closings
        .where('location_id')
        .equals(locationId)
        .and(c => c.closing_date === closingDate)
        .first();
    }

    return record;
  },

  async saveCashClosing(data: Omit<CashClosing, 'id' | 'business_id' | 'created_at'>): Promise<CashClosing> {
    const business = await db.businesses.toCollection().first();
    const businessId = business?.id || 'biz_ck_01';
    const now = new Date().toISOString();

    const existing = await this.getCashClosing(data.location_id, data.closing_date);
    const id = existing?.id || `cc_${data.location_id}_${data.closing_date}`;

    const record: CashClosing = {
      id,
      business_id: businessId,
      created_at: existing?.created_at || now,
      ...data,
    };

    await db.cash_closings.put(record);
    this.debouncedSyncToCloud();
    return record;
  },

  async getStockCounts(locationId: string, closingDate: string): Promise<StockCount[]> {
    let counts = await db.stock_counts
      .where('location_id')
      .equals(locationId)
      .filter(sc => sc.count_date === closingDate)
      .toArray();

    if (counts.length === 0) {
      await this.syncFromCloud();
      counts = await db.stock_counts
        .where('location_id')
        .equals(locationId)
        .filter(sc => sc.count_date === closingDate)
        .toArray();
    }

    return counts;
  },

  async saveStockCount(item: Omit<StockCount, 'id' | 'business_id' | 'created_at'>): Promise<StockCount> {
    const business = await db.businesses.toCollection().first();
    const businessId = business?.id || 'biz_ck_01';
    const now = new Date().toISOString();

    const id = `sc_${item.location_id}_${item.inventory_item_id}_${item.count_date}`;
    const record: StockCount = {
      id,
      business_id: businessId,
      created_at: now,
      ...item,
    };

    await db.stock_counts.put(record);
    this.debouncedSyncToCloud();
    return record;
  },

  async updateSectionStatus(
    dailyClosingId: string,
    sectionKey: keyof DailyClosing,
    status: SectionStatus
  ): Promise<DailyClosing | undefined> {
    const closing = await db.daily_closings.get(dailyClosingId);
    if (!closing) return undefined;

    const updates: Partial<DailyClosing> = {
      [sectionKey]: status,
      updated_at: new Date().toISOString(),
    };

    // Calculate completed count
    const sections: (keyof DailyClosing)[] = [
      'sales_status',
      'cash_status',
      'upi_status',
      'zomato_status',
      'swiggy_status',
      'expenses_status',
      'stock_status',
      'wastage_status',
      'receiving_status',
      'dispatch_status',
      'notes_status',
      'final_submission_status',
    ];

    let count = 0;
    for (const s of sections) {
      const val = (s === sectionKey ? status : closing[s]) as SectionStatus;
      if (val === 'completed') count++;
    }

    updates.completed_sections_count = count;
    if (closing.status === 'not_started' && count > 0) {
      updates.status = 'in_progress';
    }

    await db.daily_closings.update(dailyClosingId, updates);
    this.debouncedSyncToCloud();
    return await db.daily_closings.get(dailyClosingId);
  },

  async finalizeDailyClosing(
    dailyClosingId: string,
    submittedBy: string,
    notes?: string
  ): Promise<DailyClosing> {
    const now = new Date().toISOString();
    await db.daily_closings.update(dailyClosingId, {
      status: 'finalised',
      final_submission_status: 'completed',
      submitted_by: submittedBy,
      submitted_at: now,
      notes: notes || '',
      updated_at: now,
    });

    // Create audit log
    await db.audit_logs.put({
      id: `aud_${Date.now()}`,
      business_id: 'biz_ck_01',
      action: 'FINALIZE_DAILY_CLOSING',
      entity: 'daily_closing',
      entity_id: dailyClosingId,
      user_name: submittedBy,
      created_at: now,
    });

    this.debouncedSyncToCloud();

    const updated = await db.daily_closings.get(dailyClosingId);
    return updated!;
  },

  async reopenDailyClosing(
    dailyClosingId: string,
    reopenedBy: string,
    reopenReason: string
  ): Promise<DailyClosing> {
    if (!reopenReason || reopenReason.trim().length === 0) {
      throw new Error('Mandatory reopening reason required by PRD Section 14');
    }

    const previousClosing = await db.daily_closings.get(dailyClosingId);
    if (!previousClosing) throw new Error('Daily closing not found');

    const now = new Date().toISOString();

    // 1. Immutable Record Revision log
    const prevRevisions = await db.record_revisions
      .where('entity_id')
      .equals(dailyClosingId)
      .toArray();

    const revisionNumber = prevRevisions.length + 1;

    const revision: RecordRevision = {
      id: `rev_${dailyClosingId}_${revisionNumber}`,
      business_id: previousClosing.business_id,
      entity_type: 'daily_closing',
      entity_id: dailyClosingId,
      revision_number: revisionNumber,
      previous_state: previousClosing,
      new_state: {
        ...previousClosing,
        status: 'reopened',
        reopened_by: reopenedBy,
        reopened_at: now,
        reopen_reason: reopenReason,
      },
      change_reason: reopenReason,
      modified_by: reopenedBy,
      created_at: now,
    };

    await db.record_revisions.put(revision);

    // 2. Update daily closing record
    await db.daily_closings.update(dailyClosingId, {
      status: 'reopened',
      final_submission_status: 'attention_required',
      reopened_by: reopenedBy,
      reopened_at: now,
      reopen_reason: reopenReason,
      updated_at: now,
    });

    // 3. Log audit event
    await db.audit_logs.put({
      id: `aud_${Date.now()}`,
      business_id: previousClosing.business_id,
      action: 'REOPEN_DAILY_CLOSING',
      entity: 'daily_closing',
      entity_id: dailyClosingId,
      user_name: reopenedBy,
      reason: reopenReason,
      created_at: now,
    });

    this.debouncedSyncToCloud();

    const updated = await db.daily_closings.get(dailyClosingId);
    return updated!;
  },

  async getRevisions(dailyClosingId: string): Promise<RecordRevision[]> {
    return await db.record_revisions
      .where('entity_id')
      .equals(dailyClosingId)
      .toArray();
  }
};
