import { db } from '../db';
import type { UserProfile, UserRole, Location } from '../../types';

const INITIAL_DEFAULT_USERS: UserProfile[] = [
  {
    id: 'usr_owner',
    business_id: 'biz_chaatkulture_01',
    full_name: 'Aditya Sharma (Super Admin)',
    email: 'admin@chaatkulture.com',
    phone: '9826000001',
    role: 'owner',
    password_salt: 'ck_salt_admin_01',
    password_hash: '090c6b58ae017ee3d9b6caf4c8bf7bd113d6786f49a79bb84aa0b7f4e300e3d2', // Admin@ChaatKulture2026
    assigned_location_ids: ['loc_base_01', 'loc_stor_02', 'loc_shah_03', 'loc_11no_04'],
    assigned_location_id: 'loc_base_01',
    is_active: true,
    notes: 'Sole Super Admin with root authority over Chaat Kulture OS.',
    created_at: new Date('2026-01-01').toISOString(),
  },
  {
    id: 'usr_aakash_manager',
    business_id: 'biz_chaatkulture_01',
    full_name: 'Aakash Tiwari',
    email: 'aakashtiwari@chaatkulture.com',
    phone: '9826000000',
    role: 'manager',
    password_salt: 'ck_salt_aakash_01',
    password_hash: '',
    assigned_location_ids: ['loc_base_01', 'loc_stor_02', 'loc_shah_03', 'loc_11no_04'],
    assigned_location_id: 'loc_base_01',
    pin_hash: '1234',
    is_active: true,
    notes: 'Operations Manager overseeing multi-outlet operations.',
    created_at: new Date('2026-01-01').toISOString(),
  },
  {
    id: 'usr_manager',
    business_id: 'biz_chaatkulture_01',
    full_name: 'Vikram Patel',
    email: 'manager@chaatkulture.com',
    phone: '9826000002',
    role: 'manager',
    password_salt: 'ck_salt_mgr_01',
    password_hash: 'add6f798e47bd28599f3d239337be037f9b6cc5fe35f1acbab610bb16647c3c2', // Manager@2026
    assigned_location_ids: ['loc_base_01', 'loc_stor_02', 'loc_shah_03', 'loc_11no_04'],
    assigned_location_id: 'loc_base_01',
    is_active: true,
    notes: 'Operations Manager overseeing production batches, challans, and outlet coordination.',
    created_at: new Date('2026-01-01').toISOString(),
  },
  {
    id: 'usr_kitchen',
    business_id: 'biz_chaatkulture_01',
    full_name: 'Chef Ram Kumar',
    email: 'kitchen@chaatkulture.com',
    phone: '9826000003',
    role: 'kitchen_manager',
    password_salt: 'ck_salt_ktn_01',
    password_hash: '61e0f3b7dc4d804b465e97e9318f6ff185a711de94a1170dd9189800a78ded5d', // Kitchen@2026
    assigned_location_ids: ['loc_base_01'],
    assigned_location_id: 'loc_base_01',
    is_active: true,
    notes: 'Head Chef at Central Kitchen. Restricted to Base Kitchen prep and dispatch operations.',
    created_at: new Date('2026-01-01').toISOString(),
  },
  {
    id: 'usr_staff_shahpura',
    business_id: 'biz_chaatkulture_01',
    full_name: 'Deepak Singh',
    email: 'shahpura@chaatkulture.com',
    phone: '9826000004',
    role: 'outlet_staff',
    password_salt: 'ck_salt_stf_01',
    password_hash: 'd94585c931292a94b8308551969ccf381fdc33f45a245e87d31e3737affbfdb9', // Staff@2026
    assigned_location_ids: ['loc_shah_03'],
    assigned_location_id: 'loc_shah_03',
    pin_hash: '2026',
    is_active: true,
    notes: 'Frontline Counter Staff assigned strictly to Shahpura Street Outlet.',
    created_at: new Date('2026-01-01').toISOString(),
  },
  {
    id: 'usr_staff_11no',
    business_id: 'biz_chaatkulture_01',
    full_name: 'Rahul Sen',
    email: 'outlet11no@chaatkulture.com',
    phone: '9826000005',
    role: 'outlet_staff',
    password_salt: 'ck_salt_stf_01',
    password_hash: 'd94585c931292a94b8308551969ccf381fdc33f45a245e87d31e3737affbfdb9', // Staff@2026
    assigned_location_ids: ['loc_11no_04'],
    assigned_location_id: 'loc_11no_04',
    pin_hash: '1104',
    is_active: true,
    notes: 'Counter Cashier assigned strictly to Tukisssz Kasa, 11 No. Food Court Outlet.',
    created_at: new Date('2026-01-01').toISOString(),
  },
  {
    id: 'usr_staff_multi',
    business_id: 'biz_chaatkulture_01',
    full_name: 'Rohan Verma',
    email: 'rohan@chaatkulture.com',
    phone: '9826000006',
    role: 'outlet_staff',
    password_salt: 'ck_salt_stf_01',
    password_hash: 'd94585c931292a94b8308551969ccf381fdc33f45a245e87d31e3737affbfdb9', // Staff@2026
    assigned_location_ids: ['loc_shah_03', 'loc_11no_04'],
    assigned_location_id: 'loc_shah_03',
    pin_hash: '3344',
    is_active: true,
    notes: 'Roving staff member assigned to multiple retail outlets (Shahpura & 11 No. Food Court).',
    created_at: new Date('2026-01-01').toISOString(),
  },
];

export const usersRepo = {
  async getAll(): Promise<UserProfile[]> {
    let list = await db.user_profiles.toArray();
    if (list.length === 0) {
      await db.user_profiles.bulkPut(INITIAL_DEFAULT_USERS);
      return INITIAL_DEFAULT_USERS;
    }

    let needsUpdate = false;

    // Ensure all default users exist and have updated emails/passwords
    for (const defUser of INITIAL_DEFAULT_USERS) {
      const idx = list.findIndex(u => u.id === defUser.id);
      if (idx === -1) {
        list.push(defUser);
        await db.user_profiles.put(defUser);
      } else {
        const existing = list[idx];
        let changed = false;
        // Fix owner email & role to ensure only 1 Super Admin
        if (existing.id === 'usr_owner') {
          if (existing.email !== 'admin@chaatkulture.com') {
            existing.email = 'admin@chaatkulture.com';
            changed = true;
          }
          if (existing.role !== 'owner') {
            existing.role = 'owner';
            changed = true;
          }
        }
        // Ensure Aakash Tiwari is strictly Manager
        if (existing.email === 'aakashtiwari@chaatkulture.com' || existing.id === 'usr_aakash_admin' || existing.id === 'usr_aakash_manager') {
          if (existing.role !== 'manager') {
            existing.role = 'manager';
            changed = true;
          }
        }
        // Ensure password hash & salt exist
        if (!existing.password_hash || !existing.password_salt) {
          existing.password_hash = defUser.password_hash;
          existing.password_salt = defUser.password_salt;
          changed = true;
        }
        if (changed) {
          list[idx] = existing;
          await db.user_profiles.put(existing);
        }
      }
    }

    // Ensure all users have assigned_location_ids initialized
    const sanitized = list.map(u => {
      let ids = u.assigned_location_ids;
      if (!ids || ids.length === 0) {
        if (u.assigned_location_id) {
          ids = [u.assigned_location_id];
        } else if (u.role === 'owner' || u.role === 'manager') {
          ids = ['loc_base_01', 'loc_stor_02', 'loc_shah_03', 'loc_11no_04'];
        } else {
          ids = ['loc_shah_03'];
        }
        needsUpdate = true;
        return { ...u, assigned_location_ids: ids };
      }
      return u;
    });

    if (needsUpdate) {
      await db.user_profiles.bulkPut(sanitized);
    }

    return sanitized;
  },

  async getById(id: string): Promise<UserProfile | undefined> {
    const u = await db.user_profiles.get(id);
    if (!u) return undefined;
    if (!u.assigned_location_ids || u.assigned_location_ids.length === 0) {
      u.assigned_location_ids = u.assigned_location_id ? [u.assigned_location_id] : [];
    }
    return u;
  },

  async add(user: Omit<UserProfile, 'id' | 'created_at'>): Promise<UserProfile> {
    const cleanEmail = (user.email || '').trim().toLowerCase();
    const cleanPhone = (user.phone || '').replace(/[^0-9]/g, '');

    const allUsers = await db.user_profiles.toArray();
    const existing = allUsers.find(
      u =>
        (cleanEmail && (u.email || '').trim().toLowerCase() === cleanEmail) ||
        (cleanPhone.length >= 10 && (u.phone || '').replace(/[^0-9]/g, '').endsWith(cleanPhone.slice(-10)))
    );

    if (existing) {
      return await this.update(existing.id, user);
    }

    const now = new Date().toISOString();
    const id = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    
    // Ensure assigned_location_ids is present
    const locIds = user.assigned_location_ids && user.assigned_location_ids.length > 0
      ? user.assigned_location_ids
      : (user.assigned_location_id ? [user.assigned_location_id] : ['loc_shah_03']);

    const newUser: UserProfile = {
      ...user,
      id,
      assigned_location_ids: locIds,
      assigned_location_id: locIds[0] || 'loc_shah_03',
      created_at: now,
    };

    await db.user_profiles.put(newUser);
    return newUser;
  },

  async update(id: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    const existing = await db.user_profiles.get(id);
    if (!existing) {
      throw new Error(`User with ID ${id} not found.`);
    }

    let locIds = updates.assigned_location_ids !== undefined
      ? updates.assigned_location_ids
      : existing.assigned_location_ids;

    if (locIds && locIds.length > 0 && !updates.assigned_location_id) {
      updates.assigned_location_id = locIds[0];
    }

    const merged: UserProfile = {
      ...existing,
      ...updates,
      assigned_location_ids: locIds,
    };

    await db.user_profiles.put(merged);
    return merged;
  },

  async delete(id: string): Promise<void> {
    if (id === 'usr_owner') {
      throw new Error('Cannot delete primary Owner/Super Admin account.');
    }
    await db.user_profiles.delete(id);
  },

  async assignLocations(userId: string, locationIds: string[]): Promise<UserProfile> {
    return await this.update(userId, {
      assigned_location_ids: locationIds,
      assigned_location_id: locationIds[0] || undefined,
    });
  },

  /**
   * Helper to compute accessible location IDs for a given user profile.
   * If owner or manager, grants access to all business locations.
   */
  getAccessibleLocationIds(user: UserProfile | null, allLocations: Location[]): string[] {
    if (!user) {
      return allLocations.map(l => l.id);
    }

    // Owner and Manager always have organization-wide multi-location access
    if (user.role === 'owner' || user.role === 'manager') {
      return allLocations.map(l => l.id);
    }

    // Dedicated assigned locations for frontline staff / kitchen managers
    if (user.assigned_location_ids && user.assigned_location_ids.length > 0) {
      return user.assigned_location_ids;
    }

    if (user.assigned_location_id) {
      return [user.assigned_location_id];
    }

    return [];
  },
};
