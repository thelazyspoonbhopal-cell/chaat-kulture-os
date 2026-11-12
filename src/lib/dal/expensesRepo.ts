import { db } from '../db';
import type { Expense, ExpensePayment, ExpenseCategory } from '../../types';

export const expensesRepo = {
  async getCategories(): Promise<ExpenseCategory[]> {
    return await db.expense_categories.toArray();
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
    return newCat;
  },

  async getExpenses(filters?: { location_id?: string; category_id?: string; payment_status?: string; date?: string }): Promise<Expense[]> {
    let list = await db.expenses.toArray();

    if (filters?.location_id) {
      list = list.filter(e => e.location_id === filters.location_id);
    }
    if (filters?.category_id) {
      list = list.filter(e => e.category_id === filters.category_id);
    }
    if (filters?.payment_status) {
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
  },
};
