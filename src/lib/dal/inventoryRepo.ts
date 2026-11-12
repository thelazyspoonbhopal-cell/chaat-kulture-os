import { db } from '../db';
import type { InventoryCategory, InventoryItem, Unit, InventoryBalance } from '../../types';

export const inventoryRepo = {
  // Categories
  async getCategories(): Promise<InventoryCategory[]> {
    return await db.inventory_categories.toArray();
  },

  async addCategory(name: string, category_type: InventoryCategory['category_type']): Promise<InventoryCategory> {
    const newCat: InventoryCategory = {
      id: 'invcat_' + Date.now(),
      business_id: 'biz_chaatkulture_01',
      name: name.trim(),
      category_type,
      created_at: new Date().toISOString(),
    };
    await db.inventory_categories.put(newCat);
    return newCat;
  },

  // Units
  async getUnits(): Promise<Unit[]> {
    return await db.units.toArray();
  },

  async addUnit(name: string, code: string, is_base_unit: boolean, conversion_factor: number = 1.0): Promise<Unit> {
    const newUnit: Unit = {
      id: 'unit_' + Date.now(),
      business_id: 'biz_chaatkulture_01',
      name: name.trim(),
      code: code.trim().toLowerCase(),
      is_base_unit,
      conversion_factor,
      created_at: new Date().toISOString(),
    };
    await db.units.put(newUnit);
    return newUnit;
  },

  // Inventory Items
  async getItems(): Promise<InventoryItem[]> {
    return await db.inventory_items.toArray();
  },

  async addItem(item: Omit<InventoryItem, 'id' | 'created_at'>): Promise<InventoryItem> {
    const now = new Date().toISOString();
    const newItem: InventoryItem = {
      ...item,
      id: 'inv_' + Date.now(),
      business_id: 'biz_chaatkulture_01',
      created_at: now,
    };
    await db.inventory_items.put(newItem);

    // Initialize 0 balances for all 4 locations
    const locations = await db.locations.toArray();
    const initialBalances: InventoryBalance[] = locations.map(loc => ({
      id: `bal_${loc.id}_${newItem.id}`,
      business_id: 'biz_chaatkulture_01',
      location_id: loc.id,
      inventory_item_id: newItem.id,
      available_quantity: 0,
      in_transit_quantity: 0,
      last_updated: now,
    }));
    await db.inventory_balances.bulkPut(initialBalances);

    // Audit log
    await db.audit_logs.put({
      id: 'audit_' + Date.now(),
      business_id: 'biz_chaatkulture_01',
      action: 'CREATE_INVENTORY_ITEM',
      entity: 'inventory_items',
      entity_id: newItem.id,
      new_data: newItem,
      created_at: now,
    });

    return newItem;
  },

  async updateItem(id: string, updates: Partial<InventoryItem>): Promise<void> {
    const existing = await db.inventory_items.get(id);
    const now = new Date().toISOString();
    await db.inventory_items.update(id, {
      ...updates,
      updated_at: now,
    });

    if (existing) {
      await db.audit_logs.put({
        id: 'audit_' + Date.now(),
        business_id: 'biz_chaatkulture_01',
        action: 'UPDATE_INVENTORY_ITEM',
        entity: 'inventory_items',
        entity_id: id,
        old_data: existing,
        new_data: { ...existing, ...updates },
        created_at: now,
      });
    }
  },

  // Balances
  async getBalancesByLocation(locationId: string): Promise<(InventoryBalance & { item?: InventoryItem })[]> {
    const balances = await db.inventory_balances.where('location_id').equals(locationId).toArray();
    const items = await db.inventory_items.toArray();
    const itemMap = new Map(items.map(i => [i.id, i]));

    return balances.map(b => ({
      ...b,
      item: itemMap.get(b.inventory_item_id),
    }));
  },

  async adjustBalance(locationId: string, itemId: string, newQty: number, reason: string): Promise<void> {
    const now = new Date().toISOString();
    const balanceKey = `bal_${locationId}_${itemId}`;
    const existing = await db.inventory_balances.get(balanceKey);
    const oldQty = existing ? existing.available_quantity : 0;
    const diff = newQty - oldQty;

    await db.inventory_balances.put({
      id: balanceKey,
      business_id: 'biz_chaatkulture_01',
      location_id: locationId,
      inventory_item_id: itemId,
      available_quantity: newQty,
      in_transit_quantity: existing ? existing.in_transit_quantity : 0,
      last_updated: now,
    });

    // Record strictly in movement ledger
    await db.inventory_movements.put({
      id: 'mov_' + Date.now(),
      client_tx_id: 'tx_adj_' + Date.now(),
      business_id: 'biz_chaatkulture_01',
      location_id: locationId,
      inventory_item_id: itemId,
      movement_type: 'adjustment',
      quantity_change: diff,
      balance_after: newQty,
      unit: existing ? 'unit' : 'base',
      notes: reason,
      created_at: now,
    });
  },

  /**
   * Reconcile inventory balances with movement ledger
   */
  async reconcileBalances(locationId: string) {
    const balances = await db.inventory_balances.where('location_id').equals(locationId).toArray();
    const movements = await db.inventory_movements.where('location_id').equals(locationId).toArray();
    const items = await db.inventory_items.toArray();
    const itemMap = new Map(items.map(i => [i.id, i.name]));

    const computedMap = new Map<string, number>();
    for (const mov of movements) {
      const current = computedMap.get(mov.inventory_item_id) || 0;
      computedMap.set(mov.inventory_item_id, current + (mov.quantity_change || 0));
    }

    const variances = [];
    for (const bal of balances) {
      const ledgerQty = computedMap.get(bal.inventory_item_id) || 0;
      const recorded = bal.available_quantity || 0;
      const diff = recorded - ledgerQty;
      if (Math.abs(diff) > 0.001) {
        variances.push({
          item_id: bal.inventory_item_id,
          item_name: itemMap.get(bal.inventory_item_id) || 'Unknown Item',
          recorded_balance: recorded,
          ledger_computed_balance: ledgerQty,
          variance: diff,
        });
      }
    }
    return variances;
  },
};
