import { db } from '../db';
import type { WastageRecord, InventoryMovement } from '../../types';

export const wastageRepo = {
  async getRecords(locationId?: string): Promise<WastageRecord[]> {
    let list = await db.wastage_records.toArray();
    if (locationId) {
      list = list.filter(w => w.location_id === locationId);
    }
    return list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  },

  async recordWastage(data: {
    business_id: string;
    location_id: string;
    inventory_item_id: string;
    item_name?: string;
    quantity: number;
    unit: string;
    reason: 'spoilage' | 'preparation_wastage' | 'damage' | 'spillage' | 'staff_consumption' | 'other';
    notes?: string;
    created_by?: string;
    is_demo?: boolean;
  }): Promise<WastageRecord> {
    const now = new Date().toISOString();
    const clientTxId = 'tx_wst_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

    const record: WastageRecord = {
      id: 'wst_' + Date.now(),
      client_tx_id: clientTxId,
      business_id: data.business_id,
      location_id: data.location_id,
      inventory_item_id: data.inventory_item_id,
      item_name: data.item_name,
      quantity: data.quantity,
      unit: data.unit,
      reason: data.reason,
      status: 'approved',
      notes: data.notes,
      created_by: data.created_by,
      created_at: now,
      is_demo: data.is_demo,
    };

    await db.transaction('rw', [db.wastage_records, db.inventory_balances, db.inventory_movements, db.audit_logs], async () => {
      // 1. Save wastage record
      await db.wastage_records.put(record);

      // 2. Deduct from location balance
      const balanceKey = `bal_${data.location_id}_${data.inventory_item_id}`;
      const existing = await db.inventory_balances.get(balanceKey);
      const currentQty = existing ? existing.available_quantity : 0;
      const newQty = currentQty - data.quantity;

      await db.inventory_balances.put({
        id: balanceKey,
        business_id: data.business_id,
        location_id: data.location_id,
        inventory_item_id: data.inventory_item_id,
        available_quantity: newQty,
        in_transit_quantity: existing ? existing.in_transit_quantity : 0,
        last_updated: now,
        last_updated_by: data.created_by,
      });

      // 3. Movement ledger entry
      const movementType = data.reason === 'staff_consumption' ? 'staff_consumption' : data.reason === 'damage' ? 'damage' : 'wastage';
      await db.inventory_movements.put({
        id: 'mov_' + Date.now(),
        client_tx_id: clientTxId,
        business_id: data.business_id,
        location_id: data.location_id,
        inventory_item_id: data.inventory_item_id,
        movement_type: movementType,
        quantity_change: -data.quantity,
        balance_after: newQty,
        unit: data.unit,
        notes: `${data.reason.replace('_', ' ').toUpperCase()}: ${data.notes || ''}`.trim(),
        reference_id: record.id,
        created_by: data.created_by,
        created_at: now,
        is_demo: data.is_demo,
      });

      // 4. Audit
      await db.audit_logs.put({
        id: 'audit_' + Date.now(),
        business_id: data.business_id,
        action: 'RECORD_WASTAGE',
        entity: 'wastage_records',
        entity_id: record.id,
        location_id: data.location_id,
        new_data: { qty: data.quantity, reason: data.reason },
        created_at: now,
      });
    });

    return record;
  },

  async updateWastageRecord(
    id: string,
    updates: {
      quantity?: number;
      reason?: WastageRecord['reason'];
      notes?: string;
    },
    updatedBy?: string
  ): Promise<WastageRecord> {
    const existing = await db.wastage_records.get(id);
    if (!existing) throw new Error('Wastage record not found');

    const now = new Date().toISOString();
    const clientTxId = 'tx_upd_wst_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

    await db.transaction('rw', [db.wastage_records, db.inventory_balances, db.inventory_movements, db.audit_logs], async () => {
      let newQty = existing.quantity;
      if (updates.quantity !== undefined && updates.quantity !== existing.quantity) {
        const delta = updates.quantity - existing.quantity;
        newQty = updates.quantity;

        // Deduct additional delta from balance (or return if delta is negative)
        const balanceKey = `bal_${existing.location_id}_${existing.inventory_item_id}`;
        const bal = await db.inventory_balances.get(balanceKey);
        const currentBalQty = bal ? bal.available_quantity : 0;
        const adjustedBalQty = currentBalQty - delta;

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
          movement_type: 'wastage',
          quantity_change: -delta,
          balance_after: adjustedBalQty,
          unit: existing.unit,
          notes: `WASTAGE ADJUSTMENT: Corrected from ${existing.quantity} to ${newQty} ${existing.unit}`,
          reference_id: existing.id,
          created_by: updatedBy,
          created_at: now,
        });
      }

      const updatedRecord: WastageRecord = {
        ...existing,
        quantity: newQty,
        reason: updates.reason !== undefined ? updates.reason : existing.reason,
        notes: updates.notes !== undefined ? updates.notes : existing.notes,
      };

      await db.wastage_records.put(updatedRecord);

      await db.audit_logs.put({
        id: 'audit_' + Date.now(),
        business_id: existing.business_id,
        action: 'UPDATE_WASTAGE_RECORD',
        entity: 'wastage_records',
        entity_id: existing.id,
        location_id: existing.location_id,
        new_data: { updates, updatedBy },
        created_at: now,
      });
    });

    const refreshed = await db.wastage_records.get(id);
    return refreshed!;
  },

  async deleteWastageRecord(id: string, reason: string, deletedBy?: string): Promise<void> {
    const existing = await db.wastage_records.get(id);
    if (!existing) throw new Error('Wastage record not found');

    const now = new Date().toISOString();
    const clientTxId = 'tx_del_wst_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

    await db.transaction('rw', [db.wastage_records, db.inventory_balances, db.inventory_movements, db.audit_logs], async () => {
      // 1. Restore discarded quantity back into available stock
      const balanceKey = `bal_${existing.location_id}_${existing.inventory_item_id}`;
      const bal = await db.inventory_balances.get(balanceKey);
      const currentBalQty = bal ? bal.available_quantity : 0;
      const restoredBalQty = currentBalQty + existing.quantity;

      await db.inventory_balances.put({
        id: balanceKey,
        business_id: existing.business_id,
        location_id: existing.location_id,
        inventory_item_id: existing.inventory_item_id,
        available_quantity: restoredBalQty,
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
        movement_type: 'wastage',
        quantity_change: existing.quantity,
        balance_after: restoredBalQty,
        unit: existing.unit,
        notes: `WASTAGE VOID REVERSAL: Voided ${existing.quantity} ${existing.unit}. Reason: ${reason}`,
        reference_id: existing.id,
        created_by: deletedBy,
        created_at: now,
      });

      // 3. Delete record
      await db.wastage_records.delete(id);

      // 4. Audit
      await db.audit_logs.put({
        id: 'audit_' + Date.now(),
        business_id: existing.business_id,
        action: 'DELETE_WASTAGE_RECORD',
        entity: 'wastage_records',
        entity_id: existing.id,
        location_id: existing.location_id,
        new_data: { qty: existing.quantity, reason, deletedBy },
        created_at: now,
      });
    });
  },
};
