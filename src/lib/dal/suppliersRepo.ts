import { db } from '../db';
import type { Supplier } from '../../types';

export const suppliersRepo = {
  async getAll(): Promise<Supplier[]> {
    return await db.suppliers.toArray();
  },

  async getActive(): Promise<Supplier[]> {
    return await db.suppliers.filter(s => s.is_active).toArray();
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
  },

  async toggleActive(id: string, is_active: boolean): Promise<void> {
    await db.suppliers.update(id, { is_active });
  },
};
