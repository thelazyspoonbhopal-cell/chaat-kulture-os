import { db } from '../db';
import type { InventoryCategory, InventoryItem, Unit, InventoryBalance, Supplier } from '../../types';
import { fetchGistFile, updateGistFiles } from '../sync/cloudRegistry';

export const INVENTORY_GIST_FILE = 'chaat_kulture_inventory.json';

export interface CloudInventoryPayload {
  categories: InventoryCategory[];
  items: InventoryItem[];
  suppliers: Supplier[];
  updated_at: string;
}

let isSyncing = false;
let syncTimeout: any = null;

export const inventoryRepo = {
  // ---------------- CLOUD REGISTRY SYNC ----------------

  async fetchCloudInventory(): Promise<CloudInventoryPayload | null> {
    try {
      const data = await fetchGistFile<CloudInventoryPayload>(INVENTORY_GIST_FILE);
      if (data && (Array.isArray(data.items) || Array.isArray(data.suppliers))) {
        return data;
      }
    } catch (err) {
      console.warn('[InventoryRepo] Failed to fetch cloud inventory:', err);
    }
    return null;
  },

  async syncInventoryToCloud(): Promise<boolean> {
    try {
      const [cats, items, sups] = await Promise.all([
        db.inventory_categories.toArray(),
        db.inventory_items.toArray(),
        db.suppliers.toArray(),
      ]);

      const payload: CloudInventoryPayload = {
        categories: cats,
        items,
        suppliers: sups,
        updated_at: new Date().toISOString(),
      };

      return await updateGistFiles({
        [INVENTORY_GIST_FILE]: payload,
      });
    } catch (err) {
      console.error('[InventoryRepo] Failed to sync inventory to cloud:', err);
      return false;
    }
  },

  debouncedSyncToCloud() {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
      this.syncInventoryToCloud().catch(e => console.warn('[InventoryRepo] Background sync failed:', e));
    }, 2000);
  },

  async syncFromCloud(force = false): Promise<void> {
    if (isSyncing && !force) return;
    isSyncing = true;
    try {
      const [cloudData, localCats, localItems, localSups] = await Promise.all([
        this.fetchCloudInventory(),
        db.inventory_categories.toArray(),
        db.inventory_items.toArray(),
        db.suppliers.toArray(),
      ]);

      if (cloudData) {
        if (Array.isArray(cloudData.categories) && cloudData.categories.length > 0) {
          for (const c of cloudData.categories) await db.inventory_categories.put(c);
        }
        if (Array.isArray(cloudData.items) && cloudData.items.length > 0) {
          for (const i of cloudData.items) await db.inventory_items.put(i);
        }
        if (Array.isArray(cloudData.suppliers) && cloudData.suppliers.length > 0) {
          for (const s of cloudData.suppliers) await db.suppliers.put(s);
        }

        // If local has items not in cloud, push union
        const cloudItemIds = new Set((cloudData.items || []).map(i => i.id));
        const cloudSupIds = new Set((cloudData.suppliers || []).map(s => s.id));
        const hasExtra =
          localItems.some(i => !cloudItemIds.has(i.id)) ||
          localSups.some(s => !cloudSupIds.has(s.id));
        if (hasExtra) {
          await this.syncInventoryToCloud();
        }
      } else if (localItems.length > 0 || localSups.length > 0) {
        await this.syncInventoryToCloud();
      }
    } catch (err) {
      console.error('[InventoryRepo] Sync from cloud failed:', err);
    } finally {
      isSyncing = false;
    }
  },

  // ---------------- CATEGORIES ----------------

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
    this.debouncedSyncToCloud();
    return newCat;
  },

  // ---------------- UNITS ----------------

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

  // ---------------- INVENTORY ITEMS ----------------

  async getItems(): Promise<InventoryItem[]> {
    let items = await db.inventory_items.toArray();
    if (items.length === 0) {
      await this.syncFromCloud();
      items = await db.inventory_items.toArray();
    }
    return items;
  },

  async addItem(item: Omit<InventoryItem, 'id' | 'created_at'>): Promise<InventoryItem> {
    const trimmedCode = item.code?.trim();
    if (trimmedCode) {
      const allItems = await db.inventory_items.toArray();
      const conflict = allItems.find(
        i => i.code && i.code.trim().toLowerCase() === trimmedCode.toLowerCase()
      );
      if (conflict) {
        throw new Error(`Item code "${trimmedCode}" already exists for "${conflict.name}". Every inventory item must have a unique code.`);
      }
    }

    const now = new Date().toISOString();
    const newItem: InventoryItem = {
      ...item,
      code: trimmedCode || undefined,
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

    this.debouncedSyncToCloud();
    return newItem;
  },

  async updateItem(id: string, updates: Partial<InventoryItem>): Promise<void> {
    const existing = await db.inventory_items.get(id);
    if (!existing) throw new Error('Inventory item not found');

    const trimmedCode = updates.code !== undefined ? updates.code?.trim() : existing.code?.trim();
    if (trimmedCode) {
      const allItems = await db.inventory_items.toArray();
      const conflict = allItems.find(
        i => i.id !== id && i.code && i.code.trim().toLowerCase() === trimmedCode.toLowerCase()
      );
      if (conflict) {
        throw new Error(`Item code "${trimmedCode}" already exists for "${conflict.name}". Every inventory item must have a unique code.`);
      }
    }

    const now = new Date().toISOString();
    await db.inventory_items.update(id, {
      ...updates,
      code: trimmedCode || undefined,
      updated_at: now,
    });

    await db.audit_logs.put({
      id: 'audit_' + Date.now(),
      business_id: 'biz_chaatkulture_01',
      action: 'UPDATE_INVENTORY_ITEM',
      entity: 'inventory_items',
      entity_id: id,
      old_data: existing,
      new_data: { ...existing, ...updates, code: trimmedCode || undefined },
      created_at: now,
    });

    this.debouncedSyncToCloud();
  },

  // ---------------- BALANCES ----------------

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
