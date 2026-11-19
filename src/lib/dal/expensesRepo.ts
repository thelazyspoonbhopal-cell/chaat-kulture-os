import { db } from '../db';
import type { Expense, ExpensePayment, ExpenseCategory } from '../../types';
import { fetchGistFile, updateGistFiles } from '../sync/cloudRegistry';
import { compressBase64Image } from '../utils/imageCompressor';

export const EXPENSES_GIST_FILE = 'chaat_kulture_expenses.json';

export interface CloudExpensesPayload {
  expenses: Expense[];
  payments?: ExpensePayment[];
  categories?: ExpenseCategory[];
  deleted_ids?: string[];
  updated_at: string;
}

const STORAGE_KEY_DELETED_EXPENSES = 'ck_deleted_expense_ids';

function loadDeletedExpenseIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELETED_EXPENSES);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function persistDeletedExpenseId(id: string) {
  try {
    const set = loadDeletedExpenseIds();
    set.add(id);
    localStorage.setItem(STORAGE_KEY_DELETED_EXPENSES, JSON.stringify(Array.from(set)));
  } catch (e) {
    console.warn('[ExpensesRepo] Failed to persist deleted expense ID:', e);
  }
}

let isExpensesSyncing = false;
let expensesSyncTimeout: any = null;
let lastExpensesSyncTimestamp = 0;

export const expensesRepo = {
  // ---------------- CLOUD REGISTRY SYNC ----------------
  async fetchCloudExpenses(): Promise<CloudExpensesPayload | null> {
    try {
      const data = await fetchGistFile<CloudExpensesPayload>(EXPENSES_GIST_FILE);
      if (data && Array.isArray(data.expenses)) {
        return data;
      }
    } catch (err) {
      console.warn('[ExpensesRepo] Failed to fetch cloud expenses:', err);
    }
    return null;
  },

  async syncExpensesToCloud(): Promise<boolean> {
    try {
      const deletedIds = loadDeletedExpenseIds();

      // 1. Fetch current cloud expenses to avoid overwriting expenses uploaded across other devices
      const [cloudData, localExpenses, localPayments, localCats] = await Promise.all([
        this.fetchCloudExpenses(),
        db.expenses.toArray(),
        db.expense_payments.toArray(),
        db.expense_categories.toArray(),
      ]);

      if (cloudData?.deleted_ids && Array.isArray(cloudData.deleted_ids)) {
        cloudData.deleted_ids.forEach(id => deletedIds.add(id));
      }

      const expMap = new Map<string, Expense>();
      const payMap = new Map<string, ExpensePayment>();
      const catMap = new Map<string, ExpenseCategory>();

      // First add cloud records (excluding tombstoned deleted IDs)
      if (cloudData && Array.isArray(cloudData.expenses)) {
        cloudData.expenses.forEach(e => {
          if (!deletedIds.has(e.id)) {
            expMap.set(e.id, e);
          }
        });
      }
      if (cloudData && Array.isArray(cloudData.payments)) {
        cloudData.payments.forEach(p => {
          if (!deletedIds.has(p.id) && !deletedIds.has(p.expense_id)) {
            payMap.set(p.id, p);
          }
        });
      }
      if (cloudData && Array.isArray(cloudData.categories)) {
        cloudData.categories.forEach(c => catMap.set(c.id, c));
      }

      // Merge local records (local state takes precedence for updated items)
      localExpenses.forEach(e => {
        if (!deletedIds.has(e.id)) {
          expMap.set(e.id, e);
        }
      });
      localPayments.forEach(p => {
        if (!deletedIds.has(p.id) && !deletedIds.has(p.expense_id)) {
          payMap.set(p.id, p);
        }
      });
      localCats.forEach(c => catMap.set(c.id, c));

      // Save any missing cloud records into local Dexie store
      if (cloudData && Array.isArray(cloudData.expenses)) {
        for (const e of cloudData.expenses) {
          if (!deletedIds.has(e.id) && !localExpenses.some(le => le.id === e.id)) {
            await db.expenses.put(e);
          }
        }
      }
      if (cloudData && Array.isArray(cloudData.payments)) {
        for (const p of cloudData.payments) {
          if (!deletedIds.has(p.id) && !deletedIds.has(p.expense_id) && !localPayments.some(lp => lp.id === p.id)) {
            await db.expense_payments.put(p);
          }
        }
      }
      if (cloudData && Array.isArray(cloudData.categories)) {
        for (const c of cloudData.categories) {
          if (!localCats.some(lc => lc.id === c.id)) {
            await db.expense_categories.put(c);
          }
        }
      }

      // Optimize receipt images if any oversized uncompressed images exist
      const mergedExpenses = await Promise.all(
        Array.from(expMap.values()).map(async exp => {
          if (!exp.receipt_images || exp.receipt_images.length === 0) return exp;
          const hasOversized = exp.receipt_images.some(img => img.length > 250000);
          if (!hasOversized) return exp;
          try {
            const compressed = await Promise.all(
              exp.receipt_images.map(img => compressBase64Image(img, 1200, 0.72))
            );
            return {
              ...exp,
              receipt_images: compressed,
              receipt_url: compressed[0] || exp.receipt_url,
            };
          } catch {
            return exp;
          }
        })
      );

      const mergedPayments = Array.from(payMap.values());
      const mergedCategories = Array.from(catMap.values());

      const payload: CloudExpensesPayload = {
        expenses: mergedExpenses,
        payments: mergedPayments,
        categories: mergedCategories,
        deleted_ids: Array.from(deletedIds),
        updated_at: new Date().toISOString(),
      };

      const success = await updateGistFiles({
        [EXPENSES_GIST_FILE]: payload,
      });

      if (success) {
        lastExpensesSyncTimestamp = Date.now();
      }
      return success;
    } catch (err) {
      console.error('[ExpensesRepo] Failed to sync expenses to cloud:', err);
      return false;
    }
  },

  debouncedSyncToCloud() {
    if (expensesSyncTimeout) clearTimeout(expensesSyncTimeout);
    expensesSyncTimeout = setTimeout(() => {
      this.syncExpensesToCloud().catch(e => console.warn('[ExpensesRepo] Background sync failed:', e));
    }, 2000);
  },

  async syncFromCloud(force = false): Promise<void> {
    if (isExpensesSyncing && !force) return;
    isExpensesSyncing = true;
    try {
      const [cloudData, localExpenses, localPayments, localCats] = await Promise.all([
        this.fetchCloudExpenses(),
        db.expenses.toArray(),
        db.expense_payments.toArray(),
        db.expense_categories.toArray(),
      ]);

      const deletedIds = loadDeletedExpenseIds();

      if (cloudData) {
        if (Array.isArray(cloudData.deleted_ids)) {
          cloudData.deleted_ids.forEach(id => persistDeletedExpenseId(id));
        }
        const allDeleted = loadDeletedExpenseIds();

        // 1. Remove deleted records from local Dexie
        for (const delId of allDeleted) {
          await db.expenses.delete(delId).catch(() => {});
          await db.expense_payments.where('expense_id').equals(delId).delete().catch(() => {});
        }

        // 2. Put non-deleted cloud expenses
        if (Array.isArray(cloudData.expenses)) {
          for (const e of cloudData.expenses) {
            if (!allDeleted.has(e.id)) {
              await db.expenses.put(e);
            }
          }
        }

        // 3. Put payments
        if (Array.isArray(cloudData.payments)) {
          for (const p of cloudData.payments) {
            if (!allDeleted.has(p.id) && !allDeleted.has(p.expense_id)) {
              await db.expense_payments.put(p);
            }
          }
        }

        // 4. Put categories
        if (Array.isArray(cloudData.categories)) {
          for (const c of cloudData.categories) {
            await db.expense_categories.put(c);
          }
        }

        // 5. If local has expenses not yet in cloud, push union back to cloud
        const cloudExpIds = new Set(Array.isArray(cloudData.expenses) ? cloudData.expenses.map(e => e.id) : []);
        const hasExtra = localExpenses.some(e => !cloudExpIds.has(e.id) && !allDeleted.has(e.id));
        if (hasExtra) {
          await this.syncExpensesToCloud();
        }
      } else if (localExpenses.length > 0) {
        // First-time seeding from local to cloud
        await this.syncExpensesToCloud();
      }

      lastExpensesSyncTimestamp = Date.now();
    } catch (err) {
      console.error('[ExpensesRepo] Sync from cloud failed:', err);
    } finally {
      isExpensesSyncing = false;
    }
  },

  // ---------------- LOCAL CRUD & QUERIES ----------------
  async getCategories(forceSync = false): Promise<ExpenseCategory[]> {
    let cats = await db.expense_categories.toArray();
    if (forceSync || cats.length === 0) {
      await this.syncFromCloud().catch(() => {});
      cats = await db.expense_categories.toArray();
    }
    return cats;
  },

  async addCategory(name: string): Promise<ExpenseCategory> {
    const newCat: ExpenseCategory = {
      id: 'expcat_' + Date.now(),
      business_id: 'biz_chaatkulture_01',
      name: name.trim(),
      is_active: true,
      created_at: new Date().toISOString(),
    };
    await db.expense_categories.put(newCat);
    this.debouncedSyncToCloud();
    return newCat;
  },

  async getExpenses(
    filters?: { location_id?: string; category_id?: string; payment_status?: string; date?: string },
    forceSync = false
  ): Promise<Expense[]> {
    let list = await db.expenses.toArray();

    // If empty or older than 15s or explicitly requested, sync from cloud
    if (forceSync || list.length === 0 || Date.now() - lastExpensesSyncTimestamp > 15000) {
      await this.syncFromCloud(forceSync).catch(() => {});
      list = await db.expenses.toArray();
    }

    const deletedIds = loadDeletedExpenseIds();
    list = list.filter(e => !deletedIds.has(e.id));

    if (filters?.location_id && filters.location_id !== 'all') {
      list = list.filter(e => e.location_id === filters.location_id);
    }
    if (filters?.category_id && filters.category_id !== 'all') {
      list = list.filter(e => e.category_id === filters.category_id);
    }
    if (filters?.payment_status && filters.payment_status !== 'all') {
      list = list.filter(e => e.payment_status === filters.payment_status);
    }
    if (filters?.date) {
      list = list.filter(e => e.expense_date === filters.date);
    }

    return list.sort((a, b) => (b.expense_date || b.created_at || '').localeCompare(a.expense_date || a.created_at || ''));
  },

  async createExpense(data: {
    business_id: string;
    location_id: string;
    category_id: string;
    description: string;
    amount: number;
    payment_method: 'cash' | 'upi' | 'bank_transfer' | 'other';
    payment_status: 'paid' | 'unpaid' | 'partially_paid';
    amount_paid?: number;
    due_date?: string;
    supplier_payee?: string;
    vendor_name?: string;
    receipt_url?: string;
    receipt_images?: string[];
    is_handwritten?: boolean;
    created_by_role?: import('../../types').UserRole;
    expense_date: string;
    paid_by?: string;
    notes?: string;
    is_demo?: boolean;
  }): Promise<Expense> {
    const now = new Date().toISOString();
    const expenseId = 'exp_' + Date.now();
    const clientTxId = 'tx_exp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

    const isPaid = data.payment_status === 'paid';
    const amountPaid = isPaid ? data.amount : Math.min(data.amount, data.amount_paid || 0);
    const outstanding = Math.max(0, data.amount - amountPaid);
    const finalStatus: 'paid' | 'unpaid' | 'partially_paid' =
      outstanding === 0 ? 'paid' : amountPaid > 0 ? 'partially_paid' : 'unpaid';

    const newExpense: Expense = {
      id: expenseId,
      client_tx_id: clientTxId,
      business_id: data.business_id,
      location_id: data.location_id,
      category_id: data.category_id,
      description: data.description,
      amount: data.amount,
      payment_method: data.payment_method,
      payment_status: finalStatus,
      amount_paid: amountPaid,
      outstanding_balance: outstanding,
      due_date: data.due_date,
      supplier_payee: data.supplier_payee || data.vendor_name,
      vendor_name: data.vendor_name || data.supplier_payee,
      receipt_url: data.receipt_url || (data.receipt_images?.[0] || undefined),
      receipt_images: data.receipt_images,
      is_handwritten: data.is_handwritten,
      created_by_role: data.created_by_role,
      expense_date: data.expense_date,
      paid_by: data.paid_by,
      notes: data.notes,
      created_at: now,
      is_demo: data.is_demo,
    };

    await db.transaction('rw', [db.expenses, db.expense_payments, db.audit_logs], async () => {
      // 1. Save expense
      await db.expenses.put(newExpense);

      // 2. If upfront payment made, save in expense_payments
      if (amountPaid > 0) {
        const payment: ExpensePayment = {
          id: 'exp_pay_' + Date.now(),
          expense_id: expenseId,
          amount: amountPaid,
          payment_method: data.payment_method,
          payment_date: data.expense_date,
          reference_number: 'INITIAL',
          notes: 'Immediate initial payment on expense creation',
          paid_by: data.paid_by,
          created_at: now,
          is_demo: data.is_demo,
        };
        await db.expense_payments.put(payment);
      }

      // 3. Audit
      await db.audit_logs.put({
        id: 'audit_' + Date.now(),
        business_id: data.business_id,
        action: 'CREATE_EXPENSE',
        entity: 'expenses',
        entity_id: expenseId,
        location_id: data.location_id,
        new_data: { desc: data.description, amount: data.amount, status: finalStatus },
        created_at: now,
      });
    });

    // Immediate cloud synchronization across all devices and browsers
    this.syncExpensesToCloud().catch(e => console.warn('[ExpensesRepo] Cloud push failed:', e));

    return newExpense;
  },

  // Record settlement payment against credit expense (PRD Section 13 Accounting Rule: does not create second expense)
  async recordExpensePayment(
    expenseId: string,
    data: {
      amount: number;
      payment_method: 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'other';
      payment_date: string;
      reference_number?: string;
      paid_by?: string;
      notes?: string;
    }
  ): Promise<ExpensePayment> {
    const expense = await db.expenses.get(expenseId);
    if (!expense) throw new Error('Expense not found');

    const now = new Date().toISOString();
    const paymentId = 'exp_pay_' + Date.now();

    const payment: ExpensePayment = {
      id: paymentId,
      expense_id: expenseId,
      amount: data.amount,
      payment_method: data.payment_method,
      payment_date: data.payment_date,
      reference_number: data.reference_number,
      paid_by: data.paid_by,
      notes: data.notes,
      created_at: now,
    };

    await db.transaction('rw', [db.expenses, db.expense_payments, db.audit_logs], async () => {
      // 1. Record payment in expense_payments
      await db.expense_payments.put(payment);

      // 2. Reduce outstanding on expense record (NO second expense created!)
      const newAmountPaid = (expense.amount_paid || 0) + data.amount;
      const newOutstanding = Math.max(0, expense.amount - newAmountPaid);
      const newStatus = newOutstanding === 0 ? 'paid' : 'partially_paid';

      await db.expenses.update(expenseId, {
        amount_paid: newAmountPaid,
        outstanding_balance: newOutstanding,
        payment_status: newStatus,
      });

      // 3. Audit
      await db.audit_logs.put({
        id: 'audit_' + Date.now(),
        business_id: expense.business_id,
        action: 'SETTLE_CREDIT_EXPENSE_PAYMENT',
        entity: 'expense_payments',
        entity_id: paymentId,
        location_id: expense.location_id,
        new_data: { expense_id: expenseId, amount_settled: data.amount, remaining_outstanding: newOutstanding },
        created_at: now,
      });
    });

    // Immediate cloud synchronization
    this.syncExpensesToCloud().catch(e => console.warn('[ExpensesRepo] Cloud push failed:', e));

    return payment;
  },

  async getExpensePayments(expenseId: string): Promise<ExpensePayment[]> {
    return await db.expense_payments.where('expense_id').equals(expenseId).toArray();
  },

  async updateExpense(
    id: string,
    updates: {
      description?: string;
      notes?: string;
      category_id?: string;
      supplier_payee?: string;
      due_date?: string;
      receipt_images?: string[];
      is_handwritten?: boolean;
    },
    updatedBy?: string
  ): Promise<Expense> {
    const existing = await db.expenses.get(id);
    if (!existing) throw new Error('Expense record not found');

    const now = new Date().toISOString();
    const updated: Expense = {
      ...existing,
      ...updates,
      receipt_url: updates.receipt_images?.[0] || existing.receipt_url,
      vendor_name: updates.supplier_payee || existing.vendor_name,
    };

    await db.expenses.put(updated);
    await db.audit_logs.put({
      id: 'audit_' + Date.now(),
      business_id: existing.business_id,
      action: 'UPDATE_EXPENSE',
      entity: 'expenses',
      entity_id: id,
      location_id: existing.location_id,
      new_data: { updates, updatedBy },
      created_at: now,
    });

    // Immediate cloud synchronization
    this.syncExpensesToCloud().catch(e => console.warn('[ExpensesRepo] Cloud push failed:', e));

    return updated;
  },

  async deleteExpense(id: string, reason: string, deletedBy?: string): Promise<void> {
    const existing = await db.expenses.get(id);
    if (!existing) throw new Error('Expense record not found');

    const now = new Date().toISOString();

    await db.transaction('rw', [db.expenses, db.expense_payments, db.audit_logs], async () => {
      // 1. Delete linked settlement payments
      const payments = await db.expense_payments.where('expense_id').equals(id).toArray();
      for (const p of payments) {
        await db.expense_payments.delete(p.id);
      }

      // 2. Delete expense
      await db.expenses.delete(id);

      // 3. Audit
      await db.audit_logs.put({
        id: 'audit_' + Date.now(),
        business_id: existing.business_id,
        action: 'DELETE_EXPENSE',
        entity: 'expenses',
        entity_id: id,
        location_id: existing.location_id,
        new_data: { description: existing.description, amount: existing.amount, reason, deletedBy },
        created_at: now,
      });
    });

    // Mark as deleted in tombstone storage and sync deletion to cloud immediately
    persistDeletedExpenseId(id);
    this.syncExpensesToCloud().catch(e => console.warn('[ExpensesRepo] Cloud delete push failed:', e));
  },
};
