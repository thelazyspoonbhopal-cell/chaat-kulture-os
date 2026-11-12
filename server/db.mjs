/**
 * CHAAT KULTURE OS — LOCAL BACKEND PERSISTENT DATABASE ENGINE
 * High-performance, atomic JSON-file database engine with zero external dependencies.
 * File location: data/local_db.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'local_db.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Initial state template with 4 physical locations and system seed
const INITIAL_DATABASE = {
  version: '2.4.0',
  created_at: new Date().toISOString(),
  last_updated_at: new Date().toISOString(),
  business: {
    id: 'biz_chaat_kulture_001',
    name: 'Chaat Kulture',
    legal_name: 'Chaat Kulture Food Ops LLP',
    gstin: '23AAAAA0000A1Z5',
    currency: 'INR',
    currency_symbol: '₹',
    timezone: 'Asia/Kolkata',
    day_close_cutoff_hour: 4
  },
  locations: [
    {
      id: 'loc_base_01',
      code: 'BASE-01',
      name: 'Base Kitchen',
      type: 'base_kitchen',
      is_active: true,
      address: 'Industrial Kitchen Zone, Bhopal',
      phone: '+91 98765 43210'
    },
    {
      id: 'loc_stor_02',
      code: 'STOR-02',
      name: 'Central Store Room',
      type: 'store_room',
      is_active: true,
      address: 'Central Logistics Hub, Bhopal',
      phone: '+91 98765 43211'
    },
    {
      id: 'loc_shah_03',
      code: 'SHAH-03',
      name: 'Shahpura Street Outlet',
      type: 'retail_outlet',
      is_active: true,
      address: 'Shahpura Lake Promenade, Bhopal',
      phone: '+91 98765 43212'
    },
    {
      id: 'loc_11no_04',
      code: '11NO-04',
      name: 'Tukisssz Kasa, 11 No. Stop Food Court Outlet',
      type: 'food_court',
      is_active: true,
      address: 'Food Court, 11 No. Bus Stop, Bhopal',
      phone: '+91 98765 43213'
    }
  ],
  units: [
    { id: 'u_kg', code: 'kg', name: 'Kilogram', symbol: 'kg', is_base_unit: true, precision_decimals: 3 },
    { id: 'u_g', code: 'g', name: 'Gram', symbol: 'g', is_base_unit: false, precision_decimals: 1 },
    { id: 'u_ltr', code: 'ltr', name: 'Litre', symbol: 'L', is_base_unit: true, precision_decimals: 3 },
    { id: 'u_ml', code: 'ml', name: 'Millilitre', symbol: 'ml', is_base_unit: false, precision_decimals: 1 },
    { id: 'u_pc', code: 'pc', name: 'Piece', symbol: 'pc', is_base_unit: true, precision_decimals: 0 },
    { id: 'u_plate', code: 'plate', name: 'Plate', symbol: 'plate', is_base_unit: true, precision_decimals: 0 },
    { id: 'u_pkt', code: 'pkt', name: 'Packet', symbol: 'pkt', is_base_unit: true, precision_decimals: 0 },
    { id: 'u_box', code: 'box', name: 'Box', symbol: 'box', is_base_unit: true, precision_decimals: 0 }
  ],
  expense_categories: [
    { id: 'exp_cat_raw', code: 'RAW_PURCHASE', name: 'Raw Material Direct Local Buys' },
    { id: 'exp_cat_gas', code: 'GAS_POWER', name: 'Commercial Gas & Electricity' },
    { id: 'exp_cat_pack', code: 'PACKAGING', name: 'Disposables, Kulhads & Plates' },
    { id: 'exp_cat_rent', code: 'RENT_EST', name: 'Outlet & Kitchen Rent' },
    { id: 'exp_cat_wages', code: 'WAGES_ADV', name: 'Staff Daily Allowances & Advances' },
    { id: 'exp_cat_maint', code: 'MAINTENANCE', name: 'Utensils & Equipment Repairs' },
    { id: 'exp_cat_misc', code: 'MISC', name: 'Miscellaneous Cleaning & Sanitation' }
  ],
  feature_flags: [
    { key: 'enable_pos_quick_billing', name: 'POS Quick Cash Billing', enabled: true },
    { key: 'enable_split_payments', name: 'Split Tender (Cash/UPI/Aggregator)', enabled: true },
    { key: 'strict_physical_stock_only', name: 'Strict Physical Stock Movements Only (Zero Recipe Auto-Deductions)', enabled: true },
    { key: 'enable_inter_outlet_transfers', name: 'Two-Stage Inter-Location Transfers', enabled: true },
    { key: 'enable_daily_closing_audit', name: '12-Section Daily Closing Audit', enabled: true },
    { key: 'enable_owner_cash_handover', name: 'Owner Cash Handover Separation', enabled: true }
  ],
  menu_categories: [],
  menu_items: [],
  inventory_categories: [],
  inventory_items: [],
  inventory_balances: [],
  inventory_movements: [],
  recipes: [],
  production_records: [],
  stock_requests: [],
  dispatches: [],
  transfer_receipts: [],
  wastage_records: [],
  suppliers: [],
  purchases: [],
  supplier_payments: [],
  expenses: [],
  expense_payments: [],
  sales: [],
  daily_closings: [],
  cash_transfers_to_owner: [],
  audit_logs: []
};

class LocalDatabase {
  constructor() {
    this.memoryData = null;
    this.init();
  }

  init() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.memoryData = JSON.parse(raw);
        console.log(`[Local DB] Successfully loaded existing database from ${DB_FILE}`);
      } else {
        this.memoryData = JSON.parse(JSON.stringify(INITIAL_DATABASE));
        this.persistSync();
        console.log(`[Local DB] Initialized brand new local database at ${DB_FILE}`);
      }
    } catch (err) {
      console.error('[Local DB] Error reading DB file, fallback to initial defaults:', err);
      this.memoryData = JSON.parse(JSON.stringify(INITIAL_DATABASE));
      this.persistSync();
    }
  }

  persistSync() {
    try {
      this.memoryData.last_updated_at = new Date().toISOString();
      const serialized = JSON.stringify(this.memoryData, null, 2);
      // Atomic write using a temp file
      const tempPath = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, serialized, 'utf-8');
      fs.renameSync(tempPath, DB_FILE);
    } catch (err) {
      console.error('[Local DB] Failed to save database file:', err);
    }
  }

  getSnapshot() {
    return this.memoryData;
  }

  getCollection(name) {
    if (!this.memoryData[name]) {
      this.memoryData[name] = [];
    }
    return this.memoryData[name];
  }

  insert(collectionName, item) {
    const coll = this.getCollection(collectionName);
    const record = {
      ...item,
      id: item.id || `rec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      created_at: item.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    coll.push(record);
    this.persistSync();
    return record;
  }

  bulkUpsert(collectionName, items) {
    const coll = this.getCollection(collectionName);
    const now = new Date().toISOString();
    let inserted = 0;
    let updated = 0;

    for (const item of items) {
      if (!item || !item.id) continue;
      const index = coll.findIndex(existing => existing.id === item.id);
      if (index >= 0) {
        coll[index] = { ...coll[index], ...item, updated_at: now };
        updated++;
      } else {
        coll.push({
          ...item,
          created_at: item.created_at || now,
          updated_at: now
        });
        inserted++;
      }
    }

    this.persistSync();
    return { inserted, updated, total: coll.length };
  }

  update(collectionName, id, updates) {
    const coll = this.getCollection(collectionName);
    const index = coll.findIndex(item => item.id === id);
    if (index === -1) return null;
    coll[index] = {
      ...coll[index],
      ...updates,
      updated_at: new Date().toISOString()
    };
    this.persistSync();
    return coll[index];
  }

  remove(collectionName, id) {
    const coll = this.getCollection(collectionName);
    const index = coll.findIndex(item => item.id === id);
    if (index === -1) return false;
    coll.splice(index, 1);
    this.persistSync();
    return true;
  }

  // Safe Sandbox purge: delete ONLY items marked with is_demo: true
  purgeDemoData() {
    const collectionsToPurge = [
      'menu_items',
      'menu_categories',
      'inventory_items',
      'inventory_categories',
      'inventory_balances',
      'inventory_movements',
      'suppliers',
      'purchases',
      'sales',
      'expenses',
      'production_records',
      'dispatches',
      'transfer_receipts',
      'wastage_records',
      'daily_closings',
      'cash_transfers_to_owner'
    ];

    let totalPurged = 0;
    for (const collName of collectionsToPurge) {
      if (Array.isArray(this.memoryData[collName])) {
        const before = this.memoryData[collName].length;
        this.memoryData[collName] = this.memoryData[collName].filter(item => !item.is_demo);
        const after = this.memoryData[collName].length;
        totalPurged += (before - after);
      }
    }

    this.persistSync();
    return { purgedCount: totalPurged };
  }

  createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `backup_${timestamp}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(this.memoryData, null, 2), 'utf-8');
    return { backupFile, timestamp };
  }

  restoreBackup(backupData) {
    if (!backupData || !backupData.locations || !backupData.business) {
      throw new Error('Invalid backup schema');
    }
    this.createBackup(); // Backup current before restore
    this.memoryData = backupData;
    this.persistSync();
    return { restored: true, timestamp: new Date().toISOString() };
  }
}

export const localDb = new LocalDatabase();
