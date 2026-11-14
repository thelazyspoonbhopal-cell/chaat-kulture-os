import { db } from '../db';
import type { MenuCategory, MenuItem } from '../../types';
import { fetchGistFile, updateGistFiles } from '../sync/cloudRegistry';

export const MENU_GIST_FILE = 'chaat_kulture_menu.json';

export interface CloudMenuPayload {
  categories: MenuCategory[];
  items: MenuItem[];
  updated_at: string;
}

export const DEFAULT_MENU_CATEGORIES: MenuCategory[] = [
  { id: 'mcat_chaat', business_id: 'biz_chaatkulture_01', name: 'Chaat & Street Food', sort_order: 1, is_active: true, created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'mcat_pav', business_id: 'biz_chaatkulture_01', name: 'Pav & Breads', sort_order: 2, is_active: true, created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'mcat_snacks', business_id: 'biz_chaatkulture_01', name: 'Snacks & Quick Bites', sort_order: 3, is_active: true, created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'mcat_beverages', business_id: 'biz_chaatkulture_01', name: 'Beverages & Drinks', sort_order: 4, is_active: true, created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'mcat_desserts', business_id: 'biz_chaatkulture_01', name: 'Desserts & Sweets', sort_order: 5, is_active: true, created_at: '2026-01-01T00:00:00.000Z' },
];

export const DEFAULT_MENU_ITEMS: MenuItem[] = [
  {
    id: 'mi_pb_01',
    business_id: 'biz_chaatkulture_01',
    category_id: 'mcat_pav',
    name: 'Special Butter Pav Bhaji',
    code: 'PB-01',
    description: 'Authentic buttery Mumbai style Pav Bhaji served with 2 toasted pavs and onions',
    base_price: 120,
    tax_rate: 5.0,
    is_tax_inclusive: true,
    channel_prices: { walk_in: 120, zomato: 140, swiggy: 140 },
    is_available: true,
    sort_order: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'mi_cb_01',
    business_id: 'biz_chaatkulture_01',
    category_id: 'mcat_pav',
    name: 'Amritsari Chole Bhature',
    code: 'CB-01',
    description: 'Rich spiced chickpeas served with two fluffy golden bhature and pickle',
    base_price: 140,
    tax_rate: 5.0,
    is_tax_inclusive: true,
    channel_prices: { walk_in: 140, zomato: 165, swiggy: 165 },
    is_available: true,
    sort_order: 2,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'mi_sp_01',
    business_id: 'biz_chaatkulture_01',
    category_id: 'mcat_chaat',
    name: 'Mumbai Sev Puri',
    code: 'SP-01',
    description: 'Crisp puris loaded with potatoes, tangy chutneys, and fine nylon sev',
    base_price: 80,
    tax_rate: 5.0,
    is_tax_inclusive: true,
    channel_prices: { walk_in: 80, zomato: 95, swiggy: 95 },
    is_available: true,
    sort_order: 3,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'mi_dc_01',
    business_id: 'biz_chaatkulture_01',
    category_id: 'mcat_chaat',
    name: 'Dahi Papdi Chaat',
    code: 'DC-01',
    description: 'Crisp papdi wafers topped with chilled spiced curd, saunth, and mint chutney',
    base_price: 90,
    tax_rate: 5.0,
    is_tax_inclusive: true,
    channel_prices: { walk_in: 90, zomato: 105, swiggy: 105 },
    is_available: true,
    sort_order: 4,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'mi_pp_01',
    business_id: 'biz_chaatkulture_01',
    category_id: 'mcat_chaat',
    name: 'Crispy Pani Puri (6 Pcs)',
    code: 'PP-01',
    description: 'Classic semolina puris with spicy mint water, tangy hing water, and spiced potato filling',
    base_price: 50,
    tax_rate: 5.0,
    is_tax_inclusive: true,
    channel_prices: { walk_in: 50, zomato: 65, swiggy: 65 },
    is_available: true,
    sort_order: 5,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'mi_at_01',
    business_id: 'biz_chaatkulture_01',
    category_id: 'mcat_chaat',
    name: 'Kurkuri Aloo Tikki Chaat',
    code: 'AT-01',
    description: 'Crispy pan-fried potato patty with seasoned chole and sweet-tangy curd',
    base_price: 80,
    tax_rate: 5.0,
    is_tax_inclusive: true,
    channel_prices: { walk_in: 80, zomato: 95, swiggy: 95 },
    is_available: true,
    sort_order: 6,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'mi_db_01',
    business_id: 'biz_chaatkulture_01',
    category_id: 'mcat_chaat',
    name: 'Dahi Bhalla Special',
    code: 'DB-01',
    description: 'Melt-in-mouth lentil dumplings soaked in creamy spiced yogurt with pomegranate',
    base_price: 90,
    tax_rate: 5.0,
    is_tax_inclusive: true,
    channel_prices: { walk_in: 90, zomato: 105, swiggy: 105 },
    is_available: true,
    sort_order: 7,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'mi_bp_01',
    business_id: 'biz_chaatkulture_01',
    category_id: 'mcat_chaat',
    name: 'Special Bhel Puri',
    code: 'BP-01',
    description: 'Puffed rice tossed with chopped veggies, raw mango, peanuts, and zesty chutneys',
    base_price: 70,
    tax_rate: 5.0,
    is_tax_inclusive: true,
    channel_prices: { walk_in: 70, zomato: 85, swiggy: 85 },
    is_available: true,
    sort_order: 8,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'mi_sc_01',
    business_id: 'biz_chaatkulture_01',
    category_id: 'mcat_snacks',
    name: 'Samosa Chaat',
    code: 'SC-01',
    description: 'Crushed hot samosa served with tangy chole, curd, and house chutneys',
    base_price: 70,
    tax_rate: 5.0,
    is_tax_inclusive: true,
    channel_prices: { walk_in: 70, zomato: 85, swiggy: 85 },
    is_available: true,
    sort_order: 9,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'mi_mc_01',
    business_id: 'biz_chaatkulture_01',
    category_id: 'mcat_beverages',
    name: 'Spiced Masala Chaas',
    code: 'MC-01',
    description: 'Refreshing traditional buttermilk tempered with roasted cumin, ginger, and mint',
    base_price: 40,
    tax_rate: 5.0,
    is_tax_inclusive: true,
    channel_prices: { walk_in: 40, zomato: 50, swiggy: 50 },
    is_available: true,
    sort_order: 10,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'mi_sl_01',
    business_id: 'biz_chaatkulture_01',
    category_id: 'mcat_beverages',
    name: 'Sweet Lassi Kulhad',
    code: 'SL-01',
    description: 'Thick chilled Punjabi lassi topped with malai and dry fruits in clay kulhad',
    base_price: 60,
    tax_rate: 5.0,
    is_tax_inclusive: true,
    channel_prices: { walk_in: 60, zomato: 75, swiggy: 75 },
    is_available: true,
    sort_order: 11,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'mi_gj_01',
    business_id: 'biz_chaatkulture_01',
    category_id: 'mcat_desserts',
    name: 'Gulab Jamun (2 Pcs)',
    code: 'GJ-01',
    description: 'Warm khoya dumplings steeped in aromatic cardamom rose syrup',
    base_price: 50,
    tax_rate: 5.0,
    is_tax_inclusive: true,
    channel_prices: { walk_in: 50, zomato: 60, swiggy: 60 },
    is_available: true,
    sort_order: 12,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
];

let isSyncing = false;
let syncTimeout: any = null;

export const menuRepo = {
  // ---------------- CLOUD REGISTRY SYNC ----------------

  async fetchCloudMenu(): Promise<CloudMenuPayload | null> {
    try {
      const data = await fetchGistFile<CloudMenuPayload>(MENU_GIST_FILE);
      if (data && Array.isArray(data.items)) {
        return data;
      }
    } catch (err) {
      console.warn('[MenuRepo] Failed to fetch cloud menu:', err);
    }
    return null;
  },

  async syncMenuToCloud(): Promise<boolean> {
    try {
      const [cats, items] = await Promise.all([
        db.menu_categories.toArray(),
        db.menu_items.toArray(),
      ]);

      const payload: CloudMenuPayload = {
        categories: cats,
        items: items,
        updated_at: new Date().toISOString(),
      };

      const success = await updateGistFiles({
        [MENU_GIST_FILE]: payload,
      });

      return success;
    } catch (err) {
      console.error('[MenuRepo] Failed to sync menu to cloud:', err);
      return false;
    }
  },

  debouncedSyncToCloud() {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
      this.syncMenuToCloud().catch(e => console.warn('[MenuRepo] Background sync failed:', e));
    }, 1500);
  },

  /**
   * Bidirectional sync between local Dexie and Cloud Gist registry:
   * 1. If cloud has items, pull and merge into local Dexie.
   * 2. If local has items not in cloud, push union back to cloud.
   * 3. If both local and cloud are completely empty, seeds signature Chaat Kulture menu!
   */
  async syncFromCloud(force = false): Promise<{ count: number; synced: boolean }> {
    if (isSyncing && !force) {
      const count = await db.menu_items.count();
      return { count, synced: false };
    }

    isSyncing = true;
    try {
      const [cloudData, localCats, localItems] = await Promise.all([
        this.fetchCloudMenu(),
        db.menu_categories.toArray(),
        db.menu_items.toArray(),
      ]);

      const localItemCodeMap = new Map<string, MenuItem>();
      const localItemIdMap = new Map<string, MenuItem>();
      localItems.forEach(i => {
        localItemIdMap.set(i.id, i);
        if (i.code) localItemCodeMap.set(i.code.trim().toLowerCase(), i);
      });

      const localCatIdMap = new Map<string, MenuCategory>();
      localCats.forEach(c => localCatIdMap.set(c.id, c));

      // Case A: Cloud has menu items
      if (cloudData && Array.isArray(cloudData.items) && cloudData.items.length > 0) {
        // 1. Merge categories
        if (Array.isArray(cloudData.categories)) {
          for (const cat of cloudData.categories) {
            await db.menu_categories.put(cat);
            localCatIdMap.set(cat.id, cat);
          }
        }

        // 2. Merge items
        for (const item of cloudData.items) {
          await db.menu_items.put(item);
          localItemIdMap.set(item.id, item);
          if (item.code) localItemCodeMap.set(item.code.trim().toLowerCase(), item);
        }

        // 3. If local has any unique items not yet in cloud, push union to cloud
        const cloudItemIds = new Set(cloudData.items.map(i => i.id));
        const cloudItemCodes = new Set(cloudData.items.map(i => i.code?.trim().toLowerCase()).filter(Boolean));
        const hasLocalUniqueItems = localItems.some(
          i => !cloudItemIds.has(i.id) && (!i.code || !cloudItemCodes.has(i.code.trim().toLowerCase()))
        );

        if (hasLocalUniqueItems) {
          await this.syncMenuToCloud();
        }

        const totalNow = await db.menu_items.count();
        return { count: totalNow, synced: true };
      }

      // Case B: Cloud is empty, but local has items
      if (localItems.length > 0) {
        await this.syncMenuToCloud();
        return { count: localItems.length, synced: true };
      }

      // Case C: Both cloud and local are empty -> Seed Chaat Kulture signature menu
      await db.menu_categories.bulkPut(DEFAULT_MENU_CATEGORIES);
      await db.menu_items.bulkPut(DEFAULT_MENU_ITEMS);

      // Immediately push seeded baseline menu to cloud
      await this.syncMenuToCloud();

      return { count: DEFAULT_MENU_ITEMS.length, synced: true };
    } catch (err) {
      console.error('[MenuRepo] Error during cloud menu synchronization:', err);
      const count = await db.menu_items.count();
      return { count, synced: false };
    } finally {
      isSyncing = false;
    }
  },

  // ---------------- CATEGORIES ----------------

  async getCategories(): Promise<MenuCategory[]> {
    let list = await db.menu_categories.toArray();
    if (list.length === 0) {
      await this.syncFromCloud();
      list = await db.menu_categories.toArray();
    }
    return list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  },

  async addCategory(name: string): Promise<MenuCategory> {
    const categories = await this.getCategories();
    const newCat: MenuCategory = {
      id: 'mcat_' + Date.now(),
      business_id: 'biz_chaatkulture_01',
      name: name.trim(),
      sort_order: categories.length + 1,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    await db.menu_categories.put(newCat);
    this.debouncedSyncToCloud();
    return newCat;
  },

  async updateCategory(id: string, updates: Partial<MenuCategory>): Promise<void> {
    await db.menu_categories.update(id, updates);
    this.debouncedSyncToCloud();
  },

  async deleteCategory(id: string): Promise<void> {
    await db.menu_categories.delete(id);
    this.debouncedSyncToCloud();
  },

  // ---------------- MENU ITEMS ----------------

  async getMenuItems(): Promise<MenuItem[]> {
    let list = await db.menu_items.toArray();
    if (list.length === 0) {
      await this.syncFromCloud();
      list = await db.menu_items.toArray();
    }
    return list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  },

  async getMenuItemsByCategory(categoryId: string): Promise<MenuItem[]> {
    return await db.menu_items.where('category_id').equals(categoryId).toArray();
  },

  async addMenuItem(item: Omit<MenuItem, 'id' | 'created_at' | 'updated_at'>): Promise<MenuItem> {
    const trimmedCode = item.code?.trim();
    if (trimmedCode) {
      const allItems = await db.menu_items.toArray();
      const conflict = allItems.find(
        i => i.code && i.code.trim().toLowerCase() === trimmedCode.toLowerCase()
      );
      if (conflict) {
        throw new Error(`Item code "${trimmedCode}" already exists for "${conflict.name}". Every menu item must have a unique code.`);
      }
    }

    const now = new Date().toISOString();
    const newItem: MenuItem = {
      ...item,
      code: trimmedCode || undefined,
      id: 'mi_' + Date.now() + Math.random().toString(36).substr(2, 4),
      business_id: 'biz_chaatkulture_01',
      created_at: now,
      updated_at: now,
    };
    await db.menu_items.put(newItem);

    // Audit log
    await db.audit_logs.put({
      id: 'audit_' + Date.now(),
      business_id: 'biz_chaatkulture_01',
      action: 'CREATE_MENU_ITEM',
      entity: 'menu_items',
      entity_id: newItem.id,
      new_data: newItem,
      created_at: now,
    });

    this.debouncedSyncToCloud();
    return newItem;
  },

  async updateMenuItem(id: string, updates: Partial<MenuItem>): Promise<void> {
    const existing = await db.menu_items.get(id);
    if (!existing) throw new Error('Menu item not found');

    const trimmedCode = updates.code !== undefined ? updates.code?.trim() : existing.code?.trim();
    if (trimmedCode) {
      const allItems = await db.menu_items.toArray();
      const conflict = allItems.find(
        i => i.id !== id && i.code && i.code.trim().toLowerCase() === trimmedCode.toLowerCase()
      );
      if (conflict) {
        throw new Error(`Item code "${trimmedCode}" already exists for "${conflict.name}". Every menu item must have a unique code.`);
      }
    }

    const now = new Date().toISOString();
    await db.menu_items.update(id, {
      ...updates,
      code: trimmedCode || undefined,
      updated_at: now,
    });

    await db.audit_logs.put({
      id: 'audit_' + Date.now(),
      business_id: 'biz_chaatkulture_01',
      action: 'UPDATE_MENU_ITEM',
      entity: 'menu_items',
      entity_id: id,
      old_data: existing,
      new_data: { ...existing, ...updates, code: trimmedCode || undefined },
      created_at: now,
    });

    this.debouncedSyncToCloud();
  },

  async toggleAvailability(id: string, is_available: boolean): Promise<void> {
    await this.updateMenuItem(id, { is_available });
  },

  async deleteMenuItem(id: string): Promise<void> {
    await db.menu_items.delete(id);
    this.debouncedSyncToCloud();
  },
};
