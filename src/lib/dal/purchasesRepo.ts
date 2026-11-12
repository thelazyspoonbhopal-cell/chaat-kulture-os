import { db } from '../db';
import type { Purchase, PurchaseItem, SupplierPayment, InventoryMovement, InventoryBalance, Supplier } from '../../types';

export const purchasesRepo = {
  async getPurchases(filters?: { supplier_id?: string; receiving_location_id?: string; payment_status?: string }): Promise<Purchase[]> {
    let list = await db.purchases.toArray();

    if (filters?.supplier_id) {
      list = list.filter(p => p.supplier_id === filters.supplier_id);
    }
    if (filters?.receiving_location_id) {
      list = list.filter(p => p.receiving_location_id === filters.receiving_location_id);
    }
    if (filters?.payment_status) {
      list = list.filter(p => p.payment_status === filters.payment_status);
    }

    return list.sort((a, b) => (b.invoice_date || b.created_at || '').localeCompare(a.invoice_date || a.created_at || ''));
  },

  async createPurchase(data: {
    business_id: string;
    supplier_id: string;
    receiving_location_id: string;
    invoice_number: string;
    invoice_date: string;
    items: Omit<PurchaseItem, 'id' | 'purchase_id'>[];
    discount_amount?: number;
    paid_amount?: number;
    payment_method?: 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'other';
    notes?: string;
    created_by?: string;
    is_demo?: boolean;
  }): Promise<Purchase> {
    const now = new Date().toISOString();
    const purchaseId = 'pur_' + Date.now();
    const clientTxId = 'tx_pur_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

    let grossAmount = 0;
    let totalTax = 0;

    const purchaseItems: PurchaseItem[] = data.items.map((item, index) => {
      grossAmount += item.total_amount;
      totalTax += item.tax_amount;
      return {
        ...item,
        id: `pitem_${Date.now()}_${index}`,
        purchase_id: purchaseId,
      };
    });

    const discountAmount = data.discount_amount || 0;
    const totalAmount = Math.max(0, grossAmount + totalTax - discountAmount);
    const paidAmount = Math.min(totalAmount, data.paid_amount || 0);
    const outstandingBalance = Math.max(0, totalAmount - paidAmount);

    const paymentStatus: 'paid' | 'partially_paid' | 'unpaid' =
      outstandingBalance === 0 ? 'paid' : paidAmount > 0 ? 'partially_paid' : 'unpaid';

    const newPurchase: Purchase = {
      id: purchaseId,
      client_tx_id: clientTxId,
      business_id: data.business_id,
      supplier_id: data.supplier_id,
      receiving_location_id: data.receiving_location_id,
      invoice_number: data.invoice_number,
      invoice_date: data.invoice_date,
      total_amount: totalAmount,
      tax_amount: totalTax,
      discount_amount: discountAmount,
      paid_amount: paidAmount,
      outstanding_balance: outstandingBalance,
      payment_status: paymentStatus,
      notes: data.notes,
      created_by: data.created_by,
      created_at: now,
      items: purchaseItems,
      is_demo: data.is_demo,
    };

    await db.transaction(
      'rw',
      [
        db.purchases,
        db.supplier_payments,
        db.suppliers,
        db.inventory_balances,
        db.inventory_movements,
        db.audit_logs,
      ],
      async () => {
        // 1. Save purchase invoice
        await db.purchases.put(newPurchase);

        // 2. If upfront payment made, log in supplier_payments
        if (paidAmount > 0) {
          const payment: SupplierPayment = {
            id: 'spay_' + Date.now(),
            business_id: data.business_id,
            purchase_id: purchaseId,
            supplier_id: data.supplier_id,
            amount: paidAmount,
            payment_method: data.payment_method || 'bank_transfer',
            payment_date: data.invoice_date,
            notes: `Upfront payment against Invoice #${data.invoice_number}`,
            created_by: data.created_by,
            created_at: now,
            is_demo: data.is_demo,
          };
          await db.supplier_payments.put(payment);
        }

        // 3. Update supplier's outstanding balance
        const supplier = await db.suppliers.get(data.supplier_id);
        if (supplier) {
          const newOutstanding = (supplier.current_outstanding || 0) + outstandingBalance;
          await db.suppliers.update(data.supplier_id, {
            current_outstanding: newOutstanding,
          });
        }

        // 4. Auto-inward items into receiving location (Central Store Room or specified location)
        for (const item of purchaseItems) {
          const balKey = `bal_${data.receiving_location_id}_${item.inventory_item_id}`;
          const existingBal = await db.inventory_balances.get(balKey);
          const currentQty = existingBal ? existingBal.available_quantity : 0;
          const newQty = currentQty + item.quantity;

          await db.inventory_balances.put({
            id: balKey,
            business_id: data.business_id,
            location_id: data.receiving_location_id,
            inventory_item_id: item.inventory_item_id,
            available_quantity: newQty,
            in_transit_quantity: existingBal ? existingBal.in_transit_quantity : 0,
            last_updated: now,
            last_updated_by: data.created_by,
          });

          // 5. Append purchase_receipt to immutable movement ledger
          await db.inventory_movements.put({
            id: 'mov_' + Date.now() + Math.random().toString(36).substr(2, 3),
            client_tx_id: clientTxId,
            business_id: data.business_id,
            location_id: data.receiving_location_id,
            inventory_item_id: item.inventory_item_id,
            movement_type: 'purchase_receipt',
            quantity_change: item.quantity,
            balance_after: newQty,
            unit: item.unit,
            batch_reference: data.invoice_number,
            notes: `Purchase Receipt from ${supplier?.name || 'Vendor'} via Invoice #${data.invoice_number}`,
            reference_id: purchaseId,
            created_by: data.created_by,
            created_at: now,
            is_demo: data.is_demo,
          });
        }

        // 6. Audit
        await db.audit_logs.put({
          id: 'audit_' + Date.now(),
          business_id: data.business_id,
          action: 'CREATE_PURCHASE_INVOICE',
          entity: 'purchases',
          entity_id: purchaseId,
          location_id: data.receiving_location_id,
          new_data: { invoice_number: data.invoice_number, total_amount: totalAmount, paid_amount: paidAmount },
          created_at: now,
        });
      }
    );

    return newPurchase;
  },

  async recordSupplierPayment(data: {
    business_id: string;
    supplier_id: string;
    purchase_id?: string;
    amount: number;
    payment_method: 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'other';
    payment_date: string;
    reference_id?: string;
    notes?: string;
    created_by?: string;
  }): Promise<SupplierPayment> {
    const now = new Date().toISOString();
    const paymentId = 'spay_' + Date.now();

    const payment: SupplierPayment = {
      id: paymentId,
      business_id: data.business_id,
      supplier_id: data.supplier_id,
      purchase_id: data.purchase_id,
      amount: data.amount,
      payment_method: data.payment_method,
      payment_date: data.payment_date,
      reference_id: data.reference_id,
      notes: data.notes,
      created_by: data.created_by,
      created_at: now,
    };

    await db.transaction('rw', [db.supplier_payments, db.suppliers, db.purchases, db.audit_logs], async () => {
      // 1. Record payment
      await db.supplier_payments.put(payment);

      // 2. Reduce supplier outstanding balance
      const supplier = await db.suppliers.get(data.supplier_id);
      if (supplier) {
        const newOutstanding = Math.max(0, (supplier.current_outstanding || 0) - data.amount);
        await db.suppliers.update(data.supplier_id, {
          current_outstanding: newOutstanding,
        });
      }

      // 3. If tied to a specific purchase, adjust its paid amount
      if (data.purchase_id) {
        const purchase = await db.purchases.get(data.purchase_id);
        if (purchase) {
          const newPaid = (purchase.paid_amount || 0) + data.amount;
          const newBalance = Math.max(0, purchase.total_amount - newPaid);
          const newStatus = newBalance === 0 ? 'paid' : 'partially_paid';

          await db.purchases.update(data.purchase_id, {
            paid_amount: newPaid,
            outstanding_balance: newBalance,
            payment_status: newStatus,
          });
        }
      }

      // 4. Audit
      await db.audit_logs.put({
        id: 'audit_' + Date.now(),
        business_id: data.business_id,
        action: 'RECORD_SUPPLIER_PAYMENT',
        entity: 'supplier_payments',
        entity_id: paymentId,
        new_data: { supplier_id: data.supplier_id, amount: data.amount, method: data.payment_method },
        created_at: now,
      });
    });

    return payment;
  },

  async getSupplierLedger(supplierId: string) {
    const [supplier, purchases, payments] = await Promise.all([
      db.suppliers.get(supplierId),
      db.purchases.where('supplier_id').equals(supplierId).toArray(),
      db.supplier_payments.where('supplier_id').equals(supplierId).toArray(),
    ]);

    if (!supplier) throw new Error('Supplier not found');

    // Combine into chronological ledger
    interface LedgerEntry {
      date: string;
      type: 'purchase' | 'payment';
      ref: string;
      description: string;
      debit: number; // Purchase bill amount added to dues
      credit: number; // Payment reducing dues
      runningBalance: number;
    }

    const entries: { date: string; type: 'purchase' | 'payment'; ref: string; desc: string; debit: number; credit: number }[] = [];

    purchases.forEach(p => {
      entries.push({
        date: p.invoice_date,
        type: 'purchase',
        ref: p.invoice_number,
        desc: `Purchase Invoice #${p.invoice_number}`,
        debit: p.total_amount,
        credit: 0,
      });
    });

    payments.forEach(pay => {
      entries.push({
        date: pay.payment_date,
        type: 'payment',
        ref: pay.reference_id || 'PAY',
        desc: `Payment via ${pay.payment_method.toUpperCase()} ${pay.notes ? `(${pay.notes})` : ''}`,
        debit: 0,
        credit: pay.amount,
      });
    });

    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let running = supplier.opening_balance || 0;
    const fullLedger: LedgerEntry[] = entries.map(e => {
      running += e.debit - e.credit;
      return {
        date: e.date,
        type: e.type,
        ref: e.ref,
        description: e.desc,
        debit: e.debit,
        credit: e.credit,
        runningBalance: running,
      };
    });

    return {
      supplier,
      openingBalance: supplier.opening_balance || 0,
      currentOutstanding: supplier.current_outstanding || 0,
      ledger: fullLedger,
    };
  },

  async updatePurchase(
    id: string,
    updates: {
      invoice_number?: string;
      invoice_date?: string;
      notes?: string;
    },
    updatedBy?: string
  ): Promise<Purchase> {
    const existing = await db.purchases.get(id);
    if (!existing) throw new Error('Purchase invoice not found');

    const now = new Date().toISOString();
    const updated: Purchase = {
      ...existing,
      ...updates,
    };

    await db.purchases.put(updated);
    await db.audit_logs.put({
      id: 'audit_' + Date.now(),
      business_id: existing.business_id,
      action: 'UPDATE_PURCHASE_INVOICE',
      entity: 'purchases',
      entity_id: id,
      location_id: existing.receiving_location_id,
      new_data: { updates, updatedBy },
      created_at: now,
    });
    return updated;
  },

  async deletePurchase(id: string, reason: string, deletedBy?: string): Promise<void> {
    const purchase = await db.purchases.get(id);
    if (!purchase) throw new Error('Purchase invoice not found');

    const now = new Date().toISOString();
    const clientTxId = 'tx_del_pur_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

    await db.transaction(
      'rw',
      [
        db.purchases,
        db.suppliers,
        db.supplier_payments,
        db.inventory_balances,
        db.inventory_movements,
        db.audit_logs,
      ],
      async () => {
        // 1. Deduct inwarded quantities from receiving location balance
        for (const item of purchase.items || []) {
          const balKey = `bal_${purchase.receiving_location_id}_${item.inventory_item_id}`;
          const existingBal = await db.inventory_balances.get(balKey);
          const currentQty = existingBal ? existingBal.available_quantity : 0;
          const newQty = currentQty - item.quantity;

          await db.inventory_balances.put({
            id: balKey,
            business_id: purchase.business_id,
            location_id: purchase.receiving_location_id,
            inventory_item_id: item.inventory_item_id,
            available_quantity: newQty,
            in_transit_quantity: existingBal ? existingBal.in_transit_quantity : 0,
            last_updated: now,
            last_updated_by: deletedBy,
          });

          // Movement reversal entry
          await db.inventory_movements.put({
            id: 'mov_pur_void_' + Date.now() + Math.random().toString(36).substr(2, 3),
            client_tx_id: clientTxId,
            business_id: purchase.business_id,
            location_id: purchase.receiving_location_id,
            inventory_item_id: item.inventory_item_id,
            movement_type: 'purchase_receipt',
            quantity_change: -item.quantity,
            balance_after: newQty,
            unit: item.unit,
            batch_reference: purchase.invoice_number,
            notes: `PURCHASE VOID REVERSAL: Cancelled Invoice #${purchase.invoice_number}. Reason: ${reason}`,
            reference_id: purchase.id,
            created_by: deletedBy,
            created_at: now,
          });
        }

        // 2. Reduce supplier outstanding balance by the unpaid amount
        if (purchase.outstanding_balance > 0) {
          const supplier = await db.suppliers.get(purchase.supplier_id);
          if (supplier) {
            const newOutstanding = Math.max(0, (supplier.current_outstanding || 0) - purchase.outstanding_balance);
            await db.suppliers.update(purchase.supplier_id, {
              current_outstanding: newOutstanding,
            });
          }
        }

        // 3. Delete payments linked directly to this purchase
        const linkedPayments = await db.supplier_payments.where('purchase_id').equals(id).toArray();
        for (const p of linkedPayments) {
          await db.supplier_payments.delete(p.id);
        }

        // 4. Delete purchase invoice
        await db.purchases.delete(id);

        // 5. Audit
        await db.audit_logs.put({
          id: 'audit_' + Date.now(),
          business_id: purchase.business_id,
          action: 'DELETE_PURCHASE_INVOICE',
          entity: 'purchases',
          entity_id: id,
          location_id: purchase.receiving_location_id,
          new_data: { invoice_number: purchase.invoice_number, reason, deletedBy },
          created_at: now,
        });
      }
    );
  },
};
