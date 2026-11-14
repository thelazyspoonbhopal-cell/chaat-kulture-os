import { db } from '../db';
import type { ProductionRecord, InventoryMovement, InventoryBalance, InventoryItem } from '../../types';
import { fetchGistFile, updateGistFiles } from '../sync/cloudRegistry';

export const PRODUCTION_GIST_FILE = 'chaat_kulture_production.json';

export interface CloudProductionPayload {
  records: ProductionRecord[];
  updated_at: string;
}

let isProdSyncing = false;
let prodSyncTimeout: any = null;

export interface BatchProductionItemInput {
  inventory_item_id: string;
  item_name?: string;
  quantity_produced: number;
  unit: string;
  notes?: string;
}

export interface BatchProductionInput {
  business_id: string;
  location_id: string;
  items: BatchProductionItemInput[];
  notes?: string;
  created_by?: string;
  production_date?: string;
  is_demo?: boolean;
}

export const DEFAULT_KITCHEN_PREPARED_ITEMS: Omit<InventoryItem, 'created_at'>[] = [
  {
    id: 'inv_prep_pb_01',
    business_id: 'biz_chaatkulture_01',
    category_id: 'invcat_prepared',
    category_type: 'prepared_food',
    name: 'Pav Bhaji Special Base (Cooked)',
    code: 'PR-PB-01',
    base_unit: 'kg',
    cost_per_unit: 85,
    min_stock_alert: 20,
    is_active: true,
  },
  {
    id: 'inv_prep_ch_01',
    business_id: 'biz_chaatkulture_01',
    category_id: 'invcat_prepared',
    category_type: 'prepared_food',
    name: 'Amritsari Chole Gravy (Cooked)',
    code: 'PR-CH-01',
    base_unit: 'kg',
    cost_per_unit: 95,
    min_stock_alert: 15,
    is_active: true,
  },
  {
    id: 'inv_prep_pp_01',
    business_id: 'biz_chaatkulture_01',
    category_id: 'invcat_prepared',
    category_type: 'prepared_food',
    name: 'Pani Puri Crispy Puris',
    code: 'PR-PP-01',
    base_unit: 'pc',
    cost_per_unit: 0.8,
    min_stock_alert: 500,
    is_active: true,
  },
  {
    id: 'inv_prep_pd_01',
    business_id: 'biz_chaatkulture_01',
    category_id: 'invcat_prepared',
    category_type: 'prepared_food',
    name: 'Crisp Papdi Wafers',
    code: 'PR-PD-01',
    base_unit: 'pc',
    cost_per_unit: 0.9,
    min_stock_alert: 300,
    is_active: true,
  },
  {
    id: 'inv_prep_sv_01',
    business_id: 'biz_chaatkulture_01',
    category_id: 'invcat_prepared',
    category_type: 'prepared_food',
    name: 'Nylon Sev Fresh Batch',
    code: 'PR-SV-01',
    base_unit: 'kg',
    cost_per_unit: 110,
    min_stock_alert: 10,
    is_active: true,
  },
  {
    id: 'inv_prep_tp_01',
    business_id: 'biz_chaatkulture_01',
    category_id: 'invcat_prepared',
    category_type: 'prepared_food',
    name: 'Teekha Pudina Mint Pani',
    code: 'PR-TP-01',
    base_unit: 'ltr',
    cost_per_unit: 20,
    min_stock_alert: 25,
    is_active: true,
  },
  {
    id: 'inv_prep_hp_01',
    business_id: 'biz_chaatkulture_01',
    category_id: 'invcat_prepared',
    category_type: 'prepared_food',
    name: 'Khatta Meetha Hing Pani',
    code: 'PR-HP-01',
    base_unit: 'ltr',
    cost_per_unit: 22,
    min_stock_alert: 20,
    is_active: true,
  },
  {
    id: 'inv_prep_sc_01',
    business_id: 'biz_chaatkulture_01',
    category_id: 'invcat_prepared',
    category_type: 'prepared_food',
    name: 'Sweet Tamarind Saunth Chutney',
    code: 'PR-SC-01',
    base_unit: 'ltr',
    cost_per_unit: 65,
    min_stock_alert: 15,
    is_active: true,
  },
  {
    id: 'inv_prep_gc_01',
    business_id: 'biz_chaatkulture_01',
    category_id: 'invcat_prepared',
    category_type: 'prepared_food',
    name: 'Green Coriander Mint Chutney',
    code: 'PR-GC-01',
    base_unit: 'ltr',
    cost_per_unit: 55,
    min_stock_alert: 15,
    is_active: true,
  },
  {
    id: 'inv_prep_lc_01',
    business_id: 'biz_chaatkulture_01',
    category_id: 'invcat_prepared',
    category_type: 'prepared_food',
    name: 'Garlic Red Chilli Chutney',
    code: 'PR-LC-01',
    base_unit: 'kg',
    cost_per_unit: 75,
    min_stock_alert: 10,
    is_active: true,
  },
  {
    id: 'inv_prep_al_01',
    business_id: 'biz_chaatkulture_01',
    category_id: 'invcat_semi',
    category_type: 'semi_prepared',
    name: 'Boiled & Spiced Potato Mix',
    code: 'PR-AL-01',
    base_unit: 'kg',
    cost_per_unit: 35,
    min_stock_alert: 30,
    is_active: true,
  },
  {
    id: 'inv_prep_bd_01',
    business_id: 'biz_chaatkulture_01',
    category_id: 'invcat_semi',
    category_type: 'semi_prepared',
    name: 'Bhature Leavened Dough',
    code: 'PR-BD-01',
    base_unit: 'kg',
    cost_per_unit: 45,
    min_stock_alert: 15,
    is_active: true,
  },
  {
    id: 'inv_prep_db_01',
    business_id: 'biz_chaatkulture_01',
    category_id: 'invcat_prepared',
    category_type: 'prepared_food',
    name: 'Urad Dal Vada / Bhalla',
    code: 'PR-DB-01',
    base_unit: 'pc',
    cost_per_unit: 3.5,
    min_stock_alert: 100,
    is_active: true,
  },
  {
    id: 'inv_prep_mc_01',
    business_id: 'biz_chaatkulture_01',
    category_id: 'invcat_prepared',
    category_type: 'prepared_food',
    name: 'Fresh Spiced Masala Chaas',
    code: 'PR-MC-01',
    base_unit: 'ltr',
    cost_per_unit: 20,
    min_stock_alert: 25,
    is_active: true,
  },
  {
    id: 'inv_prep_sl_01',
    business_id: 'biz_chaatkulture_01',
    category_id: 'invcat_prepared',
    category_type: 'prepared_food',
    name: 'Sweet Thick Lassi Base',
    code: 'PR-SL-01',
    base_unit: 'ltr',
    cost_per_unit: 35,
    min_stock_alert: 20,
    is_active: true,
  },
  {
    id: 'inv_prep_gj_01',
    business_id: 'biz_chaatkulture_01',
    category_id: 'invcat_prepared',
    category_type: 'prepared_food',
    name: 'Gulab Jamun (Cooked in Syrup)',
    code: 'PR-GJ-01',
    base_unit: 'pc',
    cost_per_unit: 6.0,
    min_stock_alert: 100,
    is_active: true,
  },
];

export const productionRepo = {
  // ---------------- CLOUD REGISTRY SYNC ----------------
  async fetchCloudProduction(): Promise<CloudProductionPayload | null> {
    try {
      const data = await fetchGistFile<CloudProductionPayload>(PRODUCTION_GIST_FILE);
      if (data && Array.isArray(data.records)) {
        return data;
      }
    } catch (err) {
      console.warn('[ProductionRepo] Failed to fetch cloud production:', err);
    }
    return null;
  },

  async syncProductionToCloud(): Promise<boolean> {
    try {
      const allRecords = await db.production_records.toArray();
      const payload: CloudProductionPayload = {
        records: allRecords,
        updated_at: new Date().toISOString(),
      };
      return await updateGistFiles({
        [PRODUCTION_GIST_FILE]: payload,
      });
    } catch (err) {
      console.error('[ProductionRepo] Failed to sync production to cloud:', err);
      return false;
    }
  },

  debouncedSyncToCloud() {
    if (prodSyncTimeout) clearTimeout(prodSyncTimeout);
    prodSyncTimeout = setTimeout(() => {
      this.syncProductionToCloud().catch(e => console.warn('[ProductionRepo] Background sync failed:', e));
    }, 2000);
  },

  async syncFromCloud(force = false): Promise<void> {
    if (isProdSyncing && !force) return;
    isProdSyncing = true;
    try {
      const cloudData = await this.fetchCloudProduction();
      if (cloudData && Array.isArray(cloudData.records) && cloudData.records.length > 0) {
        for (const r of cloudData.records) await db.production_records.put(r);
      }
    } catch (err) {
      console.error('[ProductionRepo] Sync from cloud failed:', err);
    } finally {
      isProdSyncing = false;
    }
  },

  /**
   * Seed standard kitchen production dishes if none exist
   */
  async ensureDefaultKitchenItems(): Promise<InventoryItem[]> {
    const allItems = await db.inventory_items.toArray();
    const preps = allItems.filter(
      i => i.category_type === 'prepared_food' || i.category_type === 'semi_prepared'
    );

    if (preps.length === 0) {
      const now = new Date().toISOString();
      const locations = await db.locations.toArray();
      const newItems: InventoryItem[] = DEFAULT_KITCHEN_PREPARED_ITEMS.map(item => ({
        ...item,
        created_at: now,
      }));

      await db.inventory_items.bulkPut(newItems);

      // Initialize zero balances for these items
      const balances: InventoryBalance[] = [];
      for (const item of newItems) {
        for (const loc of locations) {
          balances.push({
            id: `bal_${loc.id}_${item.id}`,
            business_id: 'biz_chaatkulture_01',
            location_id: loc.id,
            inventory_item_id: item.id,
            available_quantity: 0,
            in_transit_quantity: 0,
            last_updated: now,
          });
        }
      }
      if (balances.length > 0) {
        await db.inventory_balances.bulkPut(balances);
      }

      return newItems;
    }

    return preps;
  },

  async getRecords(locationId?: string): Promise<ProductionRecord[]> {
    let list = await db.production_records.toArray();
    if (list.length === 0) {
      await this.syncFromCloud();
      list = await db.production_records.toArray();
    }
    if (locationId) {
      list = list.filter(r => r.location_id === locationId);
    }
    return list.sort((a, b) => (b.production_date || b.created_at || '').localeCompare(a.production_date || a.created_at || ''));
  },

  /**
   * Get all records sharing a specific batch number (for multi-item batch details)
   */
  async getRecordsByBatchNumber(batchNumber: string): Promise<ProductionRecord[]> {
    const all = await db.production_records.toArray();
    return all.filter(r => r.batch_number === batchNumber);
  },

  /**
   * Record multiple items produced simultaneously in ONE batch run (POS-style multi-item entry)
   */
  async recordBatchProduction(data: BatchProductionInput): Promise<{
    batch_number: string;
    records: ProductionRecord[];
    total_items: number;
    total_quantity: number;
  }> {
    if (!data.items || data.items.length === 0) {
      throw new Error('At least one item must be added to the production batch.');
    }

    const now = data.production_date || new Date().toISOString();
    const dateCode = now.split('T')[0].replace(/-/g, '');
    const todayCount = await db.production_records
      .filter(r => r.production_date.startsWith(now.split('T')[0]))
      .count();
    const batchNumber = `BATCH-${dateCode}-${todayCount + 101}`;

    const records: ProductionRecord[] = [];
    let totalQty = 0;

    await db.transaction('rw', [db.production_records, db.inventory_balances, db.inventory_movements, db.audit_logs], async () => {
      for (let i = 0; i < data.items.length; i++) {
        const itemInput = data.items[i];
        if (itemInput.quantity_produced <= 0) continue;

        const clientTxId = `tx_prod_${Date.now()}_${i}_` + Math.random().toString(36).substr(2, 4);
        const record: ProductionRecord = {
          id: `prod_${Date.now()}_${i}_` + Math.random().toString(36).substr(2, 4),
          client_tx_id: clientTxId,
          business_id: data.business_id,
          location_id: data.location_id,
          batch_number: batchNumber,
          inventory_item_id: itemInput.inventory_item_id,
          item_name: itemInput.item_name,
          quantity_produced: itemInput.quantity_produced,
          unit: itemInput.unit,
          production_date: now,
          notes: itemInput.notes || data.notes,
          created_by: data.created_by,
          created_at: new Date().toISOString(),
          is_demo: data.is_demo,
        };

        // 1. Save production record
        await db.production_records.put(record);
        records.push(record);
        totalQty += itemInput.quantity_produced;

        // 2. Fetch or initialize balance at production location
        const balanceKey = `bal_${data.location_id}_${itemInput.inventory_item_id}`;
        const existingBalance = await db.inventory_balances.get(balanceKey);
        const currentQty = existingBalance ? existingBalance.available_quantity : 0;
        const newQty = currentQty + itemInput.quantity_produced;

        await db.inventory_balances.put({
          id: balanceKey,
          business_id: data.business_id,
          location_id: data.location_id,
          inventory_item_id: itemInput.inventory_item_id,
          available_quantity: newQty,
          in_transit_quantity: existingBalance ? existingBalance.in_transit_quantity : 0,
          last_updated: now,
          last_updated_by: data.created_by,
        });

        // 3. Append to movement ledger
        const movement: InventoryMovement = {
          id: `mov_${Date.now()}_${i}_` + Math.random().toString(36).substr(2, 4),
          client_tx_id: clientTxId,
          business_id: data.business_id,
          location_id: data.location_id,
          inventory_item_id: itemInput.inventory_item_id,
          movement_type: 'production_output',
          quantity_change: itemInput.quantity_produced,
          balance_after: newQty,
          unit: itemInput.unit,
          batch_reference: batchNumber,
          notes: itemInput.notes || data.notes || `Kitchen batch production of ${itemInput.quantity_produced} ${itemInput.unit}`,
          reference_id: record.id,
          created_by: data.created_by,
          created_at: now,
          is_demo: data.is_demo,
        };
        await db.inventory_movements.put(movement);
      }

      // 4. Batch Audit Log
      await db.audit_logs.put({
        id: 'audit_' + Date.now(),
        business_id: data.business_id,
        action: 'RECORD_BATCH_PRODUCTION',
        entity: 'production_records',
        entity_id: batchNumber,
        location_id: data.location_id,
        new_data: {
          batch_number: batchNumber,
          total_items: records.length,
          total_quantity: totalQty,
          items: data.items.map(it => ({ name: it.item_name, qty: it.quantity_produced, unit: it.unit })),
          notes: data.notes,
          created_by: data.created_by,
        },
        created_at: now,
      });
    });

    this.debouncedSyncToCloud();

    return {
      batch_number: batchNumber,
      records,
      total_items: records.length,
      total_quantity: totalQty,
    };
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
    const res = await this.recordBatchProduction({
      business_id: data.business_id,
      location_id: data.location_id,
      items: [
        {
          inventory_item_id: data.inventory_item_id,
          item_name: data.item_name,
          quantity_produced: data.quantity_produced,
          unit: data.unit,
          notes: data.notes,
        },
      ],
      notes: data.notes,
      created_by: data.created_by,
      is_demo: data.is_demo,
    });
    return res.records[0];
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

        // Negative stock protection
        if (delta < 0 && currentBalQty + delta < 0) {
          throw new Error(
            `Cannot reduce batch yield for "${existing.item_name || existing.inventory_item_id}": Available stock is only ${currentBalQty} ${existing.unit}, so it cannot be reduced by ${Math.abs(delta)} ${existing.unit}. Some stock has already been dispatched or used.`
          );
        }

        const adjustedBalQty = Math.max(0, currentBalQty + delta);

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
      // 1. Deduct produced quantity from location balance with negative stock protection
      const balanceKey = `bal_${existing.location_id}_${existing.inventory_item_id}`;
      const bal = await db.inventory_balances.get(balanceKey);
      const currentBalQty = bal ? bal.available_quantity : 0;

      if (currentBalQty < existing.quantity_produced) {
        throw new Error(
          `Cannot delete batch: "${existing.item_name || existing.inventory_item_id}" only has ${currentBalQty} ${existing.unit} available in stock, but this batch produced ${existing.quantity_produced} ${existing.unit}. Stock has already been dispatched or consumed. Deletion blocked to prevent negative inventory.`
        );
      }

      const newBalQty = Math.max(0, currentBalQty - existing.quantity_produced);

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

    this.debouncedSyncToCloud();
  },

  /**
   * Delete an entire batch and reverse all inventory additions with negative stock protection
   */
  async deleteBatch(batchNumber: string, reason: string, deletedBy?: string): Promise<void> {
    const all = await db.production_records.toArray();
    const records = all.filter(r => r.batch_number === batchNumber);
    if (records.length === 0) throw new Error(`Batch #${batchNumber} not found`);

    // Pre-flight check: ensure available stock >= batch yield for every item to prevent negative stock
    for (const rec of records) {
      const balanceKey = `bal_${rec.location_id}_${rec.inventory_item_id}`;
      const bal = await db.inventory_balances.get(balanceKey);
      const currentBalQty = bal ? bal.available_quantity : 0;
      if (currentBalQty < rec.quantity_produced) {
        throw new Error(
          `Cannot delete Batch #${batchNumber}: "${rec.item_name || rec.inventory_item_id}" only has ${currentBalQty} ${rec.unit} available in stock, but this batch produced ${rec.quantity_produced} ${rec.unit}. Items have already been dispatched or consumed. Deletion is blocked to prevent negative inventory.`
        );
      }
    }

    const now = new Date().toISOString();

    await db.transaction('rw', [db.production_records, db.inventory_balances, db.inventory_movements, db.audit_logs], async () => {
      for (const rec of records) {
        const balanceKey = `bal_${rec.location_id}_${rec.inventory_item_id}`;
        const bal = await db.inventory_balances.get(balanceKey);
        const currentBalQty = bal ? bal.available_quantity : 0;
        const newBalQty = Math.max(0, currentBalQty - rec.quantity_produced);

        await db.inventory_balances.put({
          id: balanceKey,
          business_id: rec.business_id,
          location_id: rec.location_id,
          inventory_item_id: rec.inventory_item_id,
          available_quantity: newBalQty,
          in_transit_quantity: bal ? bal.in_transit_quantity : 0,
          last_updated: now,
          last_updated_by: deletedBy,
        });

        const clientTxId = 'tx_del_b_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        await db.inventory_movements.put({
          id: 'mov_rev_' + Date.now() + Math.random().toString(36).substr(2, 3),
          client_tx_id: clientTxId,
          business_id: rec.business_id,
          location_id: rec.location_id,
          inventory_item_id: rec.inventory_item_id,
          movement_type: 'production_output',
          quantity_change: -rec.quantity_produced,
          balance_after: newBalQty,
          unit: rec.unit,
          batch_reference: rec.batch_number,
          notes: `BATCH VOID: Reversal of Batch #${batchNumber}. Reason: ${reason}`,
          reference_id: rec.id,
          created_by: deletedBy,
          created_at: now,
        });

        await db.production_records.delete(rec.id);
      }

      await db.audit_logs.put({
        id: 'audit_' + Date.now(),
        business_id: records[0].business_id,
        action: 'DELETE_PRODUCTION_BATCH',
        entity: 'production_records',
        entity_id: batchNumber,
        location_id: records[0].location_id,
        new_data: { batch_number: batchNumber, items_count: records.length, reason, deletedBy },
        created_at: now,
      });
    });

    this.debouncedSyncToCloud();
  },

  /**
   * Update an entire batch (quantities of items, notes, chef) with negative stock protection
   */
  async updateBatch(
    batchNumber: string,
    updates: {
      records: { id: string; quantity: number; notes?: string }[];
      notes?: string;
      chefName?: string;
    },
    updatedBy?: string
  ): Promise<void> {
    const all = await db.production_records.toArray();
    const existingRecords = all.filter(r => r.batch_number === batchNumber);
    if (existingRecords.length === 0) throw new Error(`Batch #${batchNumber} not found`);

    const now = new Date().toISOString();

    await db.transaction('rw', [db.production_records, db.inventory_balances, db.inventory_movements, db.audit_logs], async () => {
      for (const itemUpdate of updates.records) {
        const rec = existingRecords.find(r => r.id === itemUpdate.id);
        if (!rec) continue;

        if (itemUpdate.quantity !== rec.quantity_produced) {
          const delta = itemUpdate.quantity - rec.quantity_produced;
          const balanceKey = `bal_${rec.location_id}_${rec.inventory_item_id}`;
          const bal = await db.inventory_balances.get(balanceKey);
          const currentBalQty = bal ? bal.available_quantity : 0;

          if (delta < 0 && currentBalQty + delta < 0) {
            throw new Error(
              `Cannot reduce batch yield for "${rec.item_name || rec.inventory_item_id}": Available stock is only ${currentBalQty} ${rec.unit}, so it cannot be reduced by ${Math.abs(delta)} ${rec.unit}. Stock has already been dispatched.`
            );
          }

          const adjustedBalQty = Math.max(0, currentBalQty + delta);

          await db.inventory_balances.put({
            id: balanceKey,
            business_id: rec.business_id,
            location_id: rec.location_id,
            inventory_item_id: rec.inventory_item_id,
            available_quantity: adjustedBalQty,
            in_transit_quantity: bal ? bal.in_transit_quantity : 0,
            last_updated: now,
            last_updated_by: updatedBy,
          });

          const clientTxId = 'tx_upd_b_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
          await db.inventory_movements.put({
            id: 'mov_adj_' + Date.now() + Math.random().toString(36).substr(2, 3),
            client_tx_id: clientTxId,
            business_id: rec.business_id,
            location_id: rec.location_id,
            inventory_item_id: rec.inventory_item_id,
            movement_type: 'production_output',
            quantity_change: delta,
            balance_after: adjustedBalQty,
            unit: rec.unit,
            batch_reference: rec.batch_number,
            notes: `BATCH ADJUSTMENT: Yield corrected from ${rec.quantity_produced} to ${itemUpdate.quantity} ${rec.unit}`,
            reference_id: rec.id,
            created_by: updatedBy,
            created_at: now,
          });
        }

        await db.production_records.update(rec.id, {
          quantity_produced: itemUpdate.quantity,
          notes: itemUpdate.notes !== undefined ? itemUpdate.notes : updates.notes || rec.notes,
          created_by: updates.chefName || rec.created_by,
        });
      }

      await db.audit_logs.put({
        id: 'audit_' + Date.now(),
        business_id: existingRecords[0].business_id,
        action: 'UPDATE_PRODUCTION_BATCH',
        entity: 'production_records',
        entity_id: batchNumber,
        location_id: existingRecords[0].location_id,
        new_data: { batch_number: batchNumber, updates, updatedBy },
        created_at: now,
      });
    });

    this.debouncedSyncToCloud();
  },
};
