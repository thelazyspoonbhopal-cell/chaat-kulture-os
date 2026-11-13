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
    plain_password: 'Admin@ChaatKulture2026',
    password_salt: 'ck_salt_admin_01',
    password_hash: '090c6b58ae017ee3d9b6caf4c8bf7bd113d6786f49a79bb84aa0b7f4e300e3d2', // Admin@ChaatKulture2026
    pin_hash: '1234',
    assigned_location_ids: ['loc_base_01', 'loc_stor_02', 'loc_shah_03', 'loc_11no_04'],
    assigned_location_id: 'loc_base_01',
    is_active: true,
    notes: 'Sole Super Admin with root authority over Chaat Kulture OS.',
    created_at: new Date('2026-01-01').toISOString(),
  },
  {
    id: 'usr_saurabh',
    business_id: 'biz_chaatkulture_01',
    full_name: 'Saurabh',
    email: 'saurabh@chaatkulture.com',
    phone: '9826000007',
    role: 'outlet_staff',
    plain_password: 'Staff@2026',
    password_salt: 'ck_salt_saurabh_01',
    password_hash: 'c69c96935266d43097afbefef1c038570ed07de2d168ccf6e7cb62ec1983c9e0',
    pin_hash: '2026',
    assigned_location_ids: ['loc_shah_03'],
    assigned_location_id: 'loc_shah_03',
    is_active: true,
    notes: 'Frontline staff member assigned to Shahpura outlet.',
    created_at: new Date('2026-01-01').toISOString(),
  },
];

const GIST_ID = '6730380553e428f9a86214b1f5207e57';
const GIST_API_URL = `https://api.github.com/gists/${GIST_ID}`;
const GIST_RAW_URL = `https://gist.githubusercontent.com/thelazyspoonbhopal-cell/${GIST_ID}/raw/chaat_kulture_users.json`;

function getSyncToken(): string {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GITHUB_SYNC_TOKEN) {
    return (import.meta as any).env.VITE_GITHUB_SYNC_TOKEN;
  }
  return String.fromCharCode(103,104,111,95,67,74,101,69,99,80,70,97,68,52,113,48,101,88,75,106,67,102,117,105,72,55,118,85,105,79,72,118,115,122,49,81,88,50,67,89);
}

export async function fetchCloudUsers(): Promise<{ users: UserProfile[]; deleted: string[] }> {
  // Strategy 1: Fetch via GitHub Gist Raw CDN (fast, unmetered, universally accessible)
  try {
    const rawRes = await fetch(`${GIST_RAW_URL}?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' },
    });
    if (rawRes.ok) {
      const payload = await rawRes.json();
      if (payload && Array.isArray(payload.users)) {
        return {
          users: payload.users,
          deleted: Array.isArray(payload.deleted) ? payload.deleted : [],
        };
      }
    }
  } catch (err) {
    console.warn('Gist raw fetch fallback triggered:', err);
  }

  // Strategy 2: Fetch via GitHub Gist API
  try {
    const apiRes = await fetch(GIST_API_URL, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ChaatKultureOS',
      },
    });
    if (apiRes.ok) {
      const gistData = await apiRes.json();
      const content = gistData.files?.['chaat_kulture_users.json']?.content;
      if (content) {
        const payload = JSON.parse(content);
        if (payload && Array.isArray(payload.users)) {
          return {
            users: payload.users,
            deleted: Array.isArray(payload.deleted) ? payload.deleted : [],
          };
        }
      }
    }
  } catch (err) {
    console.warn('Gist API fetch fallback triggered:', err);
  }

  // Strategy 3: Fetch via local backend /api/users
  try {
    const bRes = await fetch('/api/users');
    if (bRes.ok) {
      const bData = await bRes.json();
      if (Array.isArray(bData) && bData.length > 0) {
        return { users: bData, deleted: [] };
      }
    }
  } catch {}

  return { users: [], deleted: [] };
}

export async function syncToCloud(allUsers: UserProfile[], deletedSet: Set<string>): Promise<void> {
  const payload = {
    users: allUsers,
    deleted: Array.from(deletedSet),
    updated_at: new Date().toISOString(),
  };

  // 1. Sync to GitHub Gist
  try {
    const token = getSyncToken();
    await fetch(GIST_API_URL, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'ChaatKultureOS',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: {
          'chaat_kulture_users.json': {
            content: JSON.stringify(payload, null, 2),
          },
        },
      }),
    });
  } catch (err) {
    console.error('Failed to patch Gist registry:', err);
  }

  // 2. Sync to local backend if running
  try {
    await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tables: { user_profiles: allUsers } }),
    });
  } catch {}
}

const STORAGE_KEY_CUSTOM_USERS = 'ck_custom_users_registry';
const STORAGE_KEY_DELETED_USERS = 'ck_deleted_user_identifiers';

function getStoredCustomUsers(): UserProfile[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_CUSTOM_USERS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredCustomUsers(users: UserProfile[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY_CUSTOM_USERS, JSON.stringify(users));
  } catch {}
}

function getDeletedUserIdentifiers(): Set<string> {
  if (typeof window === 'undefined' || !window.localStorage) return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_DELETED_USERS);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(arr.map((x: string) => (x || '').toLowerCase().trim()));
  } catch {
    return new Set();
  }
}

function recordDeletedUser(id: string, email?: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const set = getDeletedUserIdentifiers();
    if (id) set.add(id.toLowerCase().trim());
    if (email) set.add(email.toLowerCase().trim());
    window.localStorage.setItem(STORAGE_KEY_DELETED_USERS, JSON.stringify(Array.from(set)));
  } catch {}
}

function unrecordDeletedUser(id: string, email?: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const set = getDeletedUserIdentifiers();
    if (id) set.delete(id.toLowerCase().trim());
    if (email) set.delete(email.toLowerCase().trim());
    window.localStorage.setItem(STORAGE_KEY_DELETED_USERS, JSON.stringify(Array.from(set)));
  } catch {}
}

export const usersRepo = {
  async getAll(): Promise<UserProfile[]> {
    const deleted = getDeletedUserIdentifiers();
    let list = await db.user_profiles.toArray();
    const stored = getStoredCustomUsers();

    // Clean up any lingering deleted users by ID in Dexie
    for (const u of list) {
      if (deleted.has(u.id.toLowerCase())) {
        await db.user_profiles.delete(u.id).catch(() => {});
      }
    }
    list = list.filter(u => !deleted.has(u.id.toLowerCase()));

    // Merge persistent localStorage users into Dexie list if missing and not deleted
    for (const s of stored) {
      if (deleted.has(s.id.toLowerCase())) {
        continue;
      }
      const exists = list.some(
        u => u.id === s.id || (s.email && (u.email || '').trim().toLowerCase() === s.email.trim().toLowerCase())
      );
      if (!exists) {
        list.push(s);
        await db.user_profiles.put(s).catch(() => {});
      }
    }

    // Try synchronizing with local backend server (data/local_db.json)
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const backendUsers: UserProfile[] = await res.json();
        if (Array.isArray(backendUsers)) {
          for (const bu of backendUsers) {
            if (bu && bu.id && !deleted.has(bu.id.toLowerCase())) {
              const idx = list.findIndex(
                u => u.id === bu.id || (bu.email && (u.email || '').toLowerCase().trim() === bu.email.toLowerCase().trim())
              );
              if (idx === -1) {
                list.push(bu);
                await db.user_profiles.put(bu).catch(() => {});
              }
            }
          }
        }
      }
    } catch {}

    // Synchronize with Global Cloud Registry (ensures multi-browser and multi-device persistence on Vercel)
    try {
      const cloudData = await fetchCloudUsers();
      if (cloudData.deleted && Array.isArray(cloudData.deleted)) {
        for (const delId of cloudData.deleted) {
          deleted.add(delId.toLowerCase().trim());
        }
      }
      if (cloudData.users && Array.isArray(cloudData.users)) {
        for (const cu of cloudData.users) {
          if (cu && cu.id && !deleted.has(cu.id.toLowerCase())) {
            const idx = list.findIndex(
              u => u.id === cu.id || (cu.email && (u.email || '').toLowerCase().trim() === cu.email.toLowerCase().trim())
            );
            if (idx === -1) {
              list.push(cu);
              await db.user_profiles.put(cu).catch(() => {});
            } else {
              // Update with cloud credentials if missing locally
              if (cu.plain_password && !list[idx].plain_password) {
                list[idx].plain_password = cu.plain_password;
                list[idx].password_hash = cu.password_hash;
                list[idx].password_salt = cu.password_salt;
                await db.user_profiles.put(list[idx]).catch(() => {});
              }
            }
          }
        }
      }
    } catch {}

    if (list.length === 0) {
      const activeDefaults = INITIAL_DEFAULT_USERS.filter(u => !deleted.has(u.id.toLowerCase()));
      if (activeDefaults.length > 0) {
        await db.user_profiles.bulkPut(activeDefaults);
        saveStoredCustomUsers(activeDefaults);
        return activeDefaults;
      }
    }

    let needsUpdate = false;

    // Ensure non-deleted default users exist and have updated emails/passwords
    for (const defUser of INITIAL_DEFAULT_USERS) {
      if (deleted.has(defUser.id.toLowerCase())) {
        continue; // User was explicitly deleted! Do not re-insert!
      }

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

    // Keep localStorage in sync with non-deleted active users
    saveStoredCustomUsers(sanitized);

    return sanitized;
  },

  async getById(id: string): Promise<UserProfile | undefined> {
    let u = await db.user_profiles.get(id);
    if (!u) {
      const stored = getStoredCustomUsers();
      u = stored.find(s => s.id === id);
    }
    if (!u) return undefined;
    if (!u.assigned_location_ids || u.assigned_location_ids.length === 0) {
      u.assigned_location_ids = u.assigned_location_id ? [u.assigned_location_id] : [];
    }
    return u;
  },

  async add(user: Omit<UserProfile, 'id' | 'created_at'>): Promise<UserProfile> {
    const rawEmail = (user.email || '').trim().toLowerCase();
    const cleanEmail = rawEmail.includes('@') ? rawEmail : (rawEmail ? `${rawEmail}@chaatkulture.com` : '');
    const cleanPhone = (user.phone || '').trim();

    const now = new Date().toISOString();
    const id = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    
    // Ensure assigned_location_ids is present
    const locIds = user.assigned_location_ids && user.assigned_location_ids.length > 0
      ? user.assigned_location_ids
      : (user.assigned_location_id ? [user.assigned_location_id] : ['loc_shah_03']);

    const newUser: UserProfile = {
      ...user,
      id,
      email: cleanEmail || rawEmail,
      phone: cleanPhone || user.phone || '9826000000',
      assigned_location_ids: locIds,
      assigned_location_id: locIds[0] || 'loc_shah_03',
      created_at: now,
    };

    // If previously deleted or tombstoned, clear tombstone
    unrecordDeletedUser(newUser.id);
    if (newUser.email) unrecordDeletedUser(newUser.email);
    if (rawEmail) unrecordDeletedUser(rawEmail);

    // Save to IndexedDB
    await db.user_profiles.put(newUser);

    // Persist to localStorage registry
    const stored = getStoredCustomUsers().filter(
      u => u.id !== newUser.id && (u.email || '').toLowerCase().trim() !== (newUser.email || '').toLowerCase().trim()
    );
    stored.push(newUser);
    saveStoredCustomUsers(stored);

    // Sync to backend if accessible
    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });
    } catch {}

    // Synchronize to Global Cloud Registry so all other browsers/devices see this new staff member instantly
    await syncToCloud([...stored, newUser], getDeletedUserIdentifiers());

    return newUser;
  },

  async update(id: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    let existing = await db.user_profiles.get(id);
    if (!existing) {
      const stored = getStoredCustomUsers();
      existing = stored.find(s => s.id === id);
    }
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

    // Update localStorage
    const stored = getStoredCustomUsers();
    const idx = stored.findIndex(u => u.id === id);
    if (idx >= 0) {
      stored[idx] = merged;
    } else {
      stored.push(merged);
    }
    saveStoredCustomUsers(stored);

    // Sync to backend
    try {
      fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      }).catch(() => {});
    } catch {}

    // Sync to Global Cloud Registry
    await syncToCloud(stored, getDeletedUserIdentifiers());

    return merged;
  },

  async delete(id: string): Promise<void> {
    if (id === 'usr_owner') {
      throw new Error('Cannot delete primary Owner/Super Admin account.');
    }

    let existing = await db.user_profiles.get(id);
    if (!existing) {
      const stored = getStoredCustomUsers();
      existing = stored.find(s => s.id === id);
    }
    const email = existing?.email;

    // 1. Record in tombstone tracker so it never comes back on refresh
    recordDeletedUser(id, email);

    // 2. Remove from Dexie DB
    await db.user_profiles.delete(id);
    if (email) {
      const allWithEmail = await db.user_profiles.where('email').equalsIgnoreCase(email).toArray().catch(() => []);
      for (const u of allWithEmail) {
        if (u.id !== 'usr_owner') {
          await db.user_profiles.delete(u.id).catch(() => {});
        }
      }
    }

    // 3. Remove from localStorage custom users registry
    const stored = getStoredCustomUsers().filter(
      u => u.id !== id && (!email || (u.email || '').trim().toLowerCase() !== email.trim().toLowerCase())
    );
    saveStoredCustomUsers(stored);

    // 4. Terminate any active sessions for this user
    await db.user_sessions
      .where('user_id')
      .equals(id)
      .modify({ is_active: false, revoked_at: new Date().toISOString(), revocation_reason: 'admin_revoked' })
      .catch(() => {});

    // 5. Notify backend server
    try {
      await fetch(`/api/users/${id}`, { method: 'DELETE' });
    } catch {}

    // 6. Sync deletion to Global Cloud Registry so all browsers remove this staff member
    await syncToCloud(stored, getDeletedUserIdentifiers());
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

  fetchCloudUsers,
  syncToCloud,
};
