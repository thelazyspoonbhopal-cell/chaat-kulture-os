import { db } from '../db';
import type { ProductionRecord, InventoryMovement, InventoryBalance } from '../../types';

export const productionRepo = {
  async getRecords(locationId?: string): Promise<ProductionRecord[]> {
    let list = await db.production_records.toArray();
    if (locationId) {
      list = list.filter(r => r.location_id === locationId);
    }
    return list.sort((a, b) => (b.production_date || b.created_at || '').localeCompare(a.production_date || a.created_at || ''));
  },

  async recordProduction(data: {
    business_id: string;
    location_id: string;
    inventory_item_id: string;
    item_name?: string;
    quantity_produced: number;
    unit: string;
    notes?: string;
    created_by?: string;
    is_demo?: boolean;
  }): Promise<ProductionRecord> {
    const now = new Date().toISOString();
    const clientTxId = 'tx_prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

    // Batch Number generation: BATCH-YYYYMMDD-COUNT
    const dateCode = now.split('T')[0].replace(/-/g, '');
    const todayCount = await db.production_records
      .filter(r => r.production_date.startsWith(now.split('T')[0]))
      .count();
    const batchNumber = `BATCH-${dateCode}-${todayCount + 101}`;

    const record: ProductionRecord = {
      id: 'prod_' + Date.now(),
      client_tx_id: clientTxId,
      business_id: data.business_id,
      location_id: data.location_id,
      batch_number: batchNumber,
      inventory_item_id: data.inventory_item_id,
      item_name: data.item_name,
      quantity_produced: data.quantity_produced,
      unit: data.unit,
      production_date: now,
      notes: data.notes,
      created_by: data.created_by,
      created_at: now,
      is_demo: data.is_demo,
    };

    await db.transaction('rw', [db.production_records, db.inventory_balances, db.inventory_movements, db.audit_logs], async () => {
      // 1. Save production record
      await db.production_records.put(record);

      // 2. Fetch or initialize balance at production location
      const balanceKey = `bal_${data.location_id}_${data.inventory_item_id}`;
      const existingBalance = await db.inventory_balances.get(balanceKey);
      const currentQty = existingBalance ? existingBalance.available_quantity : 0;
      const newQty = currentQty + data.quantity_produced;

      await db.inventory_balances.put({
        id: balanceKey,
        business_id: data.business_id,
        location_id: data.location_id,
        inventory_item_id: data.inventory_item_id,
        available_quantity: newQty,
        in_transit_quantity: existingBalance ? existingBalance.in_transit_quantity : 0,
        last_updated: now,
        last_updated_by: data.created_by,
      });

      // 3. Append strictly to movement ledger
      const movement: InventoryMovement = {
        id: 'mov_' + Date.now(),
        client_tx_id: clientTxId,
        business_id: data.business_id,
        location_id: data.location_id,
        inventory_item_id: data.inventory_item_id,
        movement_type: 'production_output',
        quantity_change: data.quantity_produced,
        balance_after: newQty,
        unit: data.unit,
        batch_reference: batchNumber,
        notes: data.notes || `Kitchen batch production of ${data.quantity_produced} ${data.unit}`,
        reference_id: record.id,
        created_by: data.created_by,
        created_at: now,
        is_demo: data.is_demo,
      };
      await db.inventory_movements.put(movement);

      // 4. Audit
      await db.audit_logs.put({
        id: 'audit_' + Date.now(),
        business_id: data.business_id,
        action: 'RECORD_PRODUCTION',
        entity: 'production_records',
        entity_id: record.id,
        location_id: data.location_id,
        new_data: { batch_number: batchNumber, qty: data.quantity_produced, unit: data.unit },
        created_at: now,
      });
    });

    return record;
  },

  async updateProductionRecord(
    id: string,
    updates: { quantity_produced?: number; notes?: string },
    updatedBy?: string
  ): Promise<ProductionRecord> {
    const existing = await db.production_records.get(id);
    if (!existing) throw new Error('Production batch not found');

    const now = new Date().toISOString();
    const clientTxId = 'tx_upd_prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

    await db.transaction('rw', [db.production_records, db.inventory_balances, db.inventory_movements, db.audit_logs], async () => {
      let newQty = existing.quantity_produced;
      if (updates.quantity_produced !== undefined && updates.quantity_produced !== existing.quantity_produced) {
        const delta = updates.quantity_produced - existing.quantity_produced;
        newQty = updates.quantity_produced;

        // Adjust balance
        const balanceKey = `bal_${existing.location_id}_${existing.inventory_item_id}`;
        const bal = await db.inventory_balances.get(balanceKey);
        const currentBalQty = bal ? bal.available_quantity : 0;
        const adjustedBalQty = currentBalQty + delta;

        await db.inventory_balances.put({
          id: balanceKey,
          business_id: existing.business_id,
          location_id: existing.location_id,
          inventory_item_id: existing.inventory_item_id,
          available_quantity: adjustedBalQty,
          in_transit_quantity: bal ? bal.in_transit_quantity : 0,
          last_updated: now,
          last_updated_by: updatedBy,
        });

        // Movement ledger entry for adjustment
        await db.inventory_movements.put({
          id: 'mov_adj_' + Date.now(),
          client_tx_id: clientTxId,
          business_id: existing.business_id,
          location_id: existing.location_id,
          inventory_item_id: existing.inventory_item_id,
          movement_type: 'production_output',
          quantity_change: delta,
          balance_after: adjustedBalQty,
          unit: existing.unit,
          batch_reference: existing.batch_number,
          notes: `BATCH ADJUSTMENT: Yield corrected from ${existing.quantity_produced} to ${newQty} ${existing.unit}`,
          reference_id: existing.id,
          created_by: updatedBy,
          created_at: now,
        });
      }

      const updatedRecord: ProductionRecord = {
        ...existing,
        quantity_produced: newQty,
        notes: updates.notes !== undefined ? updates.notes : existing.notes,
      };

      await db.production_records.put(updatedRecord);

      await db.audit_logs.put({
        id: 'audit_' + Date.now(),
        business_id: existing.business_id,
        action: 'UPDATE_PRODUCTION_RECORD',
        entity: 'production_records',
        entity_id: existing.id,
        location_id: existing.location_id,
        new_data: { batch_number: existing.batch_number, updates, updatedBy },
        created_at: now,
      });
    });

    const refreshed = await db.production_records.get(id);
    return refreshed!;
  },

  async deleteProductionRecord(id: string, reason: string, deletedBy?: string): Promise<void> {
    const existing = await db.production_records.get(id);
    if (!existing) throw new Error('Production batch not found');

    const now = new Date().toISOString();
    const clientTxId = 'tx_del_prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

    await db.transaction('rw', [db.production_records, db.inventory_balances, db.inventory_movements, db.audit_logs], async () => {
      // 1. Deduct produced quantity from location balance
      const balanceKey = `bal_${existing.location_id}_${existing.inventory_item_id}`;
      const bal = await db.inventory_balances.get(balanceKey);
      const currentBalQty = bal ? bal.available_quantity : 0;
      const newBalQty = currentBalQty - existing.quantity_produced;

      await db.inventory_balances.put({
        id: balanceKey,
        business_id: existing.business_id,
        location_id: existing.location_id,
        inventory_item_id: existing.inventory_item_id,
        available_quantity: newBalQty,
        in_transit_quantity: bal ? bal.in_transit_quantity : 0,
        last_updated: now,
        last_updated_by: deletedBy,
      });

      // 2. Append movement reversal
      await db.inventory_movements.put({
        id: 'mov_rev_' + Date.now(),
        client_tx_id: clientTxId,
        business_id: existing.business_id,
        location_id: existing.location_id,
        inventory_item_id: existing.inventory_item_id,
        movement_type: 'production_output',
        quantity_change: -existing.quantity_produced,
        balance_after: newBalQty,
        unit: existing.unit,
        batch_reference: existing.batch_number,
        notes: `BATCH VOID REVERSAL: Cancelled Batch #${existing.batch_number}. Reason: ${reason}`,
        reference_id: existing.id,
        created_by: deletedBy,
        created_at: now,
      });

      // 3. Delete record
      await db.production_records.delete(id);

      // 4. Audit
      await db.audit_logs.put({
        id: 'audit_' + Date.now(),
        business_id: existing.business_id,
        action: 'DELETE_PRODUCTION_RECORD',
        entity: 'production_records',
        entity_id: existing.id,
        location_id: existing.location_id,
        new_data: { batch_number: existing.batch_number, reason, deletedBy },
        created_at: now,
      });
    });
  },
};
