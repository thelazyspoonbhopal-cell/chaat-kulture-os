import { db } from '../db';
import type { Supplier } from '../../types';
import { inventoryRepo } from './inventoryRepo';

export const suppliersRepo = {
  async getAll(): Promise<Supplier[]> {
    let list = await db.suppliers.toArray();
    if (list.length === 0) {
      await inventoryRepo.syncFromCloud();
      list = await db.suppliers.toArray();
    }
    return list;
  },

  async getActive(): Promise<Supplier[]> {
    const all = await this.getAll();
    return all.filter(s => s.is_active);
  },

  async add(supplier: Omit<Supplier, 'id' | 'current_outstanding' | 'created_at'>): Promise<Supplier> {
    const now = new Date().toISOString();
    const newSup: Supplier = {
      ...supplier,
      id: 'sup_' + Date.now(),
      business_id: 'biz_chaatkulture_01',
      current_outstanding: supplier.opening_balance || 0,
      created_at: now,
    };
    await db.suppliers.put(newSup);

    // Audit log
    await db.audit_logs.put({
      id: 'audit_' + Date.now(),
      business_id: 'biz_chaatkulture_01',
      action: 'CREATE_SUPPLIER',
      entity: 'suppliers',
      entity_id: newSup.id,
      new_data: newSup,
      created_at: now,
    });

    inventoryRepo.debouncedSyncToCloud();
    return newSup;
  },

  async update(id: string, updates: Partial<Supplier>): Promise<void> {
    const existing = await db.suppliers.get(id);
    await db.suppliers.update(id, updates);

    if (existing) {
      await db.audit_logs.put({
        id: 'audit_' + Date.now(),
        business_id: 'biz_chaatkulture_01',
        action: 'UPDATE_SUPPLIER',
        entity: 'suppliers',
        entity_id: id,
        old_data: existing,
        new_data: { ...existing, ...updates },
        created_at: new Date().toISOString(),
      });
    }

    inventoryRepo.debouncedSyncToCloud();
  },

  async toggleActive(id: string, is_active: boolean): Promise<void> {
    await db.suppliers.update(id, { is_active });
    inventoryRepo.debouncedSyncToCloud();
  },
};
