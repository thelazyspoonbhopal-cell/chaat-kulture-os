/**
 * CHAAT KULTURE OS — ROLE-BASED ACCESS CONTROL (RBAC) REPOSITORY
 * Provides Super Admin with configurable permission control across all roles.
 * Persists changes to local IndexedDB and syncs across sessions.
 */

import { db } from '../db';
import type { UserRole, AppPermissionKey, RolePermissionConfig, PermissionDefinition } from '../../types';

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  // Operations
  {
    key: 'view_dashboard',
    label: 'Owner Command Centre',
    category: 'Operations',
    description: 'Consolidated cross-location financial metrics, gross margin overview, and real-time alerts.'
  },
  {
    key: 'manage_pos',
    label: 'Sales POS & Billing',
    category: 'Operations',
    description: 'Counter quick billing, multi-payment split tender, refund processing, and KOT generation.'
  },
  {
    key: 'manage_kitchen',
    label: 'Kitchen Batch Production',
    category: 'Operations',
    description: 'Base Kitchen batch preparation, recipe consumption, cooking yield, and variance audit.'
  },
  {
    key: 'manage_transfers',
    label: 'Indents & Dispatches',
    category: 'Operations',
    description: 'Two-stage inter-location transfer workflow, stock requests, dispatch, and receiving audits.'
  },
  {
    key: 'manage_wastage',
    label: 'Wastage & Spoilage Logging',
    category: 'Operations',
    description: 'Log and review ingredient spoilage, transit damage, expired stock, and physical inventory loss.'
  },

  // Inventory
  {
    key: 'view_inventory',
    label: 'View Inventory & 4-Location Matrix',
    category: 'Inventory',
    description: 'Read-only access to available and in-transit balances across all 4 independent physical locations.'
  },
  {
    key: 'adjust_inventory',
    label: 'Manual Stock Adjustments & Recounts',
    category: 'Inventory',
    description: 'Authorized physical recount overrides and balance discrepancy adjustments.'
  },

  // Finance
  {
    key: 'manage_purchases',
    label: 'Purchases & Supplier Payables',
    category: 'Finance',
    description: 'Record vendor purchase bills, automatic inward stock movements, and supplier payment allocations.'
  },
  {
    key: 'manage_expenses',
    label: 'Expenses & Credit Accounting',
    category: 'Finance',
    description: 'Immediate expense recognition into payables and cash/bank settlement vouchers.'
  },
  {
    key: 'manage_closing',
    label: '12-Section Daily Shift Closing',
    category: 'Finance',
    description: 'Perform shift cash drawer audits, compute expected cash, and lock daily closings.'
  },
  {
    key: 'reopen_closing',
    label: 'Reopen Locked Closings',
    category: 'Finance',
    description: 'Supervisory override to reopen a locked closing snapshot with mandatory reason auditing.'
  },
  {
    key: 'view_reports',
    label: 'Analytics & Estimated P&L',
    category: 'Finance',
    description: 'Channel revenue breakdown, sales mix trends, inventory valuation, and estimated income statement.'
  },

  // Administration
  {
    key: 'manage_master_data',
    label: 'Admin Master Data Hub',
    category: 'Administration',
    description: 'Configure menu dishes, pricing, inventory items, vendors, locations, units, and system flags.'
  },
  {
    key: 'manage_rbac',
    label: 'Manage Role Permissions (RBAC)',
    category: 'Administration',
    description: 'Control and modify the permission matrix for all organizational roles (Super Admin exclusive).'
  },
  {
    key: 'access_sandbox',
    label: 'Testing Sandbox & Demo Data',
    category: 'Administration',
    description: 'Load isolated demo records and execute safe sandbox purges without touching real master items.'
  }
];

export const DEFAULT_ROLE_PERMISSIONS: RolePermissionConfig[] = [
  {
    role: 'owner',
    role_name: 'Owner (Super Admin)',
    description: 'Full organizational authority. Has complete root access across all 4 locations, master settings, and RBAC.',
    is_system_immutable: true,
    permissions: {
      view_dashboard: true,
      manage_pos: true,
      view_inventory: true,
      adjust_inventory: true,
      manage_kitchen: true,
      manage_transfers: true,
      manage_wastage: true,
      manage_purchases: true,
      manage_expenses: true,
      manage_closing: true,
      reopen_closing: true,
      view_reports: true,
      manage_master_data: true,
      manage_rbac: true,
      access_sandbox: true
    }
  },
  {
    role: 'manager',
    role_name: 'General / Outlet Manager',
    description: 'Oversees day-to-day operations, POS, inventory, vendor inwarding, local expenses, and daily shift closings.',
    is_system_immutable: false,
    permissions: {
      view_dashboard: true,
      manage_pos: true,
      view_inventory: true,
      adjust_inventory: true,
      manage_kitchen: true,
      manage_transfers: true,
      manage_wastage: true,
      manage_purchases: true,
      manage_expenses: true,
      manage_closing: true,
      reopen_closing: false, // Restricted by default, can be granted by Super Admin
      view_reports: true,
      manage_master_data: false, // Restricted by default
      manage_rbac: false, // Super Admin only
      access_sandbox: true
    }
  },
  {
    role: 'kitchen_manager',
    role_name: 'Head Chef / Kitchen Manager',
    description: 'Responsible for Base Kitchen bulk preparations, ingredient indents, yield tracking, dispatches, and emergency petty cash purchases.',
    is_system_immutable: false,
    permissions: {
      view_dashboard: false,
      manage_pos: false,
      view_inventory: true,
      adjust_inventory: false,
      manage_kitchen: true,
      manage_transfers: true,
      manage_wastage: true,
      manage_purchases: false,
      manage_expenses: true,
      manage_closing: false,
      reopen_closing: false,
      view_reports: false,
      manage_master_data: false,
      manage_rbac: false,
      access_sandbox: false
    }
  },
  {
    role: 'outlet_staff',
    role_name: 'Counter Cashier & Outlet Staff',
    description: 'Frontline staff operating quick-service counter POS billing, stock receiving, petty cash expense bills upload, and cash counting.',
    is_system_immutable: false,
    permissions: {
      view_dashboard: false,
      manage_pos: true,
      view_inventory: true,
      adjust_inventory: false,
      manage_kitchen: false,
      manage_transfers: true,
      manage_wastage: true,
      manage_purchases: false,
      manage_expenses: true,
      manage_closing: true,
      reopen_closing: false,
      view_reports: false,
      manage_master_data: false,
      manage_rbac: false,
      access_sandbox: false
    }
  }
];

const STORAGE_KEY = 'chaat_kulture_rbac_permissions_v3';

export const rbacRepo = {
  /**
   * Get all role permission configurations from Database
   */
  async getAll(): Promise<RolePermissionConfig[]> {
    try {
      const dbList = await db.role_permissions.toArray();
      if (dbList && dbList.length > 0) {
        // Ensure owner remains root immutable
        const ownerConfig = dbList.find(c => c.role === 'owner');
        if (ownerConfig) {
          ownerConfig.is_system_immutable = true;
          for (const def of PERMISSION_DEFINITIONS) {
            ownerConfig.permissions[def.key] = true;
          }
        }
        return dbList;
      }

      // Check legacy localStorage migration if available
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: RolePermissionConfig[] = JSON.parse(saved);
        await db.role_permissions.bulkPut(parsed);
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
        return parsed;
      }

      // Seed defaults into database table
      await db.role_permissions.bulkPut(DEFAULT_ROLE_PERMISSIONS);
      return JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS));
    } catch (err) {
      console.error('[RBAC] Error loading permissions from DB, returning defaults:', err);
      return JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS));
    }
  },

  /**
   * Get permission map for a specific role
   */
  async getPermissionsForRole(role: UserRole): Promise<Record<AppPermissionKey, boolean>> {
    const all = await this.getAll();
    const config = all.find(c => c.role === role);
    if (!config) {
      const def = DEFAULT_ROLE_PERMISSIONS.find(c => c.role === role);
      return def ? { ...def.permissions } : ({} as any);
    }
    return config.permissions;
  },

  /**
   * Update a single permission for a specific role (Super Admin action)
   */
  async updatePermission(role: UserRole, key: AppPermissionKey, enabled: boolean): Promise<RolePermissionConfig[]> {
    if (role === 'owner') {
      throw new Error('Super Admin permissions are root immutable and cannot be revoked.');
    }

    const all = await this.getAll();
    const roleConfig = all.find(c => c.role === role);
    if (!roleConfig) {
      throw new Error(`Role configuration for '${role}' not found.`);
    }

    // Never allow non-owner roles to gain manage_rbac
    if (key === 'manage_rbac' && enabled) {
      throw new Error('Role-Based Access Control configuration can only be granted to Super Admin.');
    }

    roleConfig.permissions[key] = enabled;

    try {
      await db.role_permissions.put(roleConfig);

      // Also persist to audit log in db
      await db.audit_logs.add({
        id: `audit_rbac_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        business_id: 'biz_chaat_kulture_001',
        user_name: 'Super Admin',
        action: 'UPDATE_RBAC_PERMISSION',
        entity: 'role_permissions',
        entity_id: `${role}:${key}`,
        old_data: { role, key, enabled: !enabled },
        new_data: { role, key, enabled },
        reason: `Super Admin modified ${key} access for ${roleConfig.role_name} to ${enabled ? 'ENABLED' : 'DISABLED'}`,
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.error('[RBAC] Error saving updated permissions to DB:', err);
    }

    return all;
  },

  /**
   * Batch update multiple permissions for a role
   */
  async updateRolePermissions(role: UserRole, permissions: Record<AppPermissionKey, boolean>): Promise<RolePermissionConfig[]> {
    if (role === 'owner') {
      throw new Error('Super Admin permissions are root immutable and cannot be revoked.');
    }

    const all = await this.getAll();
    const roleConfig = all.find(c => c.role === role);
    if (!roleConfig) {
      throw new Error(`Role configuration for '${role}' not found.`);
    }

    // Ensure non-owners never have manage_rbac
    const safePermissions = { ...permissions, manage_rbac: false };
    roleConfig.permissions = safePermissions;

    try {
      await db.role_permissions.put(roleConfig);
    } catch (err) {
      console.error('[RBAC] Error saving batch permissions to DB:', err);
    }

    return all;
  },

  /**
   * Reset all roles to factory default permissions
   */
  async resetToDefaults(): Promise<RolePermissionConfig[]> {
    const defaults = JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS));
    try {
      await db.role_permissions.clear();
      await db.role_permissions.bulkPut(defaults);

      await db.audit_logs.add({
        id: `audit_rbac_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        business_id: 'biz_chaat_kulture_001',
        user_name: 'Super Admin',
        action: 'RESET_RBAC_DEFAULTS',
        entity: 'role_permissions',
        reason: 'Super Admin restored all role permissions to factory defaults',
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.error('[RBAC] Error resetting permissions in DB:', err);
    }
    return defaults;
  }
};
