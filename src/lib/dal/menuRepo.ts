import { db } from '../db';
import type { MenuCategory, MenuItem } from '../../types';

export const menuRepo = {
  // Categories
  async getCategories(): Promise<MenuCategory[]> {
    const list = await db.menu_categories.toArray();
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
    return newCat;
  },

  async updateCategory(id: string, updates: Partial<MenuCategory>): Promise<void> {
    await db.menu_categories.update(id, updates);
  },

  // Menu Items
  async getMenuItems(): Promise<MenuItem[]> {
    const list = await db.menu_items.toArray();
    return list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  },

  async getMenuItemsByCategory(categoryId: string): Promise<MenuItem[]> {
    return await db.menu_items.where('category_id').equals(categoryId).toArray();
  },

  async addMenuItem(item: Omit<MenuItem, 'id' | 'created_at' | 'updated_at'>): Promise<MenuItem> {
    const now = new Date().toISOString();
    const newItem: MenuItem = {
      ...item,
      id: 'mi_' + Date.now(),
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

    return newItem;
  },

  async updateMenuItem(id: string, updates: Partial<MenuItem>): Promise<void> {
    const existing = await db.menu_items.get(id);
    const now = new Date().toISOString();
    await db.menu_items.update(id, {
      ...updates,
      updated_at: now,
    });

    if (existing) {
      await db.audit_logs.put({
        id: 'audit_' + Date.now(),
        business_id: 'biz_chaatkulture_01',
        action: 'UPDATE_MENU_ITEM',
        entity: 'menu_items',
        entity_id: id,
        old_data: existing,
        new_data: { ...existing, ...updates },
        created_at: now,
      });
    }
  },

  async toggleAvailability(id: string, is_available: boolean): Promise<void> {
    await this.updateMenuItem(id, { is_available });
  },

  async deleteMenuItem(id: string): Promise<void> {
    await db.menu_items.delete(id);
  },
};
