import { db } from '../db';
import type { Location } from '../../types';

export const locationsRepo = {
  async getAll(): Promise<Location[]> {
    return await db.locations.toArray();
  },

  async getActive(): Promise<Location[]> {
    return await db.locations.filter(loc => loc.is_active).toArray();
  },

  async getById(id: string): Promise<Location | undefined> {
    return await db.locations.get(id);
  },

  async add(location: Omit<Location, 'id' | 'created_at' | 'updated_at'>): Promise<Location> {
    const now = new Date().toISOString();
    const newLoc: Location = {
      ...location,
      id: 'loc_' + Date.now(),
      created_at: now,
      updated_at: now,
    };
    await db.locations.put(newLoc);
    return newLoc;
  },

  async update(id: string, updates: Partial<Location>): Promise<void> {
    const now = new Date().toISOString();
    await db.locations.update(id, {
      ...updates,
      updated_at: now,
    });
  },

  async toggleActive(id: string, is_active: boolean): Promise<void> {
    const now = new Date().toISOString();
    await db.locations.update(id, { is_active, updated_at: now });
  },
};
