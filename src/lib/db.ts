import Dexie, { type Table } from 'dexie';
import type {
  Business,
  Location,
  UserProfile,
  UserLocationAccess,
  MenuCategory,
  MenuItem,
  InventoryCategory,
  Unit,
  InventoryItem,
  InventoryBalance,
  InventoryMovement,
  Supplier,
  Purchase,
  SupplierPayment,
  ExpenseCategory,
  Expense,
  ExpensePayment,
  Sale,
  StockRequest,
  ProductionRecord,
  Dispatch,
  WastageRecord,
  DailyClosing,
  CashClosing,
  CashTransferToOwner,
  StockCount,
  AuditLog,
  RecordRevision,
  FeatureFlag,
  UserSession,
  LoginAuditLog,
  LoginApprovalRequest,
  RolePermissionConfig,
} from '../types';

export class ChaatKultureDexieDB extends Dexie {
  businesses!: Table<Business, string>;
  locations!: Table<Location, string>;
  user_profiles!: Table<UserProfile, string>;
  user_sessions!: Table<UserSession, string>;
  login_audit_logs!: Table<LoginAuditLog, string>;
  login_approval_requests!: Table<LoginApprovalRequest, string>;
  user_location_access!: Table<UserLocationAccess, string>;
  menu_categories!: Table<MenuCategory, string>;
  menu_items!: Table<MenuItem, string>;
  inventory_categories!: Table<InventoryCategory, string>;
  units!: Table<Unit, string>;
  inventory_items!: Table<InventoryItem, string>;
  inventory_balances!: Table<InventoryBalance, string>;
  inventory_movements!: Table<InventoryMovement, string>;
  suppliers!: Table<Supplier, string>;
  purchases!: Table<Purchase, string>;
  supplier_payments!: Table<SupplierPayment, string>;
  expense_categories!: Table<ExpenseCategory, string>;
  expenses!: Table<Expense, string>;
  expense_payments!: Table<ExpensePayment, string>;
  sales!: Table<Sale, string>;
  stock_requests!: Table<StockRequest, string>;
  production_records!: Table<ProductionRecord, string>;
  dispatches!: Table<Dispatch, string>;
  wastage_records!: Table<WastageRecord, string>;
  daily_closings!: Table<DailyClosing, string>;
  cash_closings!: Table<CashClosing, string>;
  cash_transfers_to_owner!: Table<CashTransferToOwner, string>;
  stock_counts!: Table<StockCount, string>;
  audit_logs!: Table<AuditLog, string>;
  record_revisions!: Table<RecordRevision, string>;
  feature_flags!: Table<FeatureFlag, string>;
  role_permissions!: Table<RolePermissionConfig, string>;

  constructor() {
    super('ChaatKultureOS_LocalDB');

    this.version(1).stores({
      businesses: 'id, slug',
      locations: 'id, business_id, code, type, is_active',
      user_profiles: 'id, role, assigned_location_id, is_active',
      user_location_access: 'id, user_id, location_id',
      menu_categories: 'id, business_id, sort_order, is_active, is_demo',
      menu_items: 'id, business_id, category_id, is_available, is_demo',
      inventory_categories: 'id, business_id, category_type, is_demo',
      units: 'id, business_id, code',
      inventory_items: 'id, business_id, category_id, category_type, is_active, is_demo',
      inventory_balances: 'id, [location_id+inventory_item_id], location_id, inventory_item_id',
      inventory_movements: 'id, client_tx_id, location_id, inventory_item_id, movement_type, created_at, is_demo',
      suppliers: 'id, business_id, is_active, is_demo',
      purchases: 'id, client_tx_id, supplier_id, receiving_location_id, payment_status, created_at, is_demo',
      supplier_payments: 'id, purchase_id, supplier_id, payment_date, is_demo',
      expense_categories: 'id, business_id, is_active',
      expenses: 'id, client_tx_id, location_id, category_id, payment_status, expense_date, is_demo',
      expense_payments: 'id, expense_id, payment_date, is_demo',
      sales: 'id, client_tx_id, location_id, channel, payment_status, created_at, is_demo',
      stock_requests: 'id, client_tx_id, from_location_id, to_location_id, status, required_date, is_demo',
      production_records: 'id, client_tx_id, location_id, inventory_item_id, production_date, is_demo',
      dispatches: 'id, client_tx_id, from_location_id, to_location_id, status, dispatch_date, is_demo',
      wastage_records: 'id, client_tx_id, location_id, inventory_item_id, status, created_at, is_demo',
      daily_closings: 'id, location_id, closing_date, status, is_demo',
      cash_closings: 'id, location_id, closing_date, is_demo',
      cash_transfers_to_owner: 'id, from_location_id, transfer_date, is_demo',
      stock_counts: 'id, location_id, count_date, inventory_item_id, is_demo',
      audit_logs: 'id, action, entity, entity_id, location_id, created_at',
      record_revisions: 'id, entity_type, entity_id, created_at',
      feature_flags: 'id, feature_key',
    });

    this.version(2).stores({
      stock_requests: 'id, client_tx_id, from_location_id, to_location_id, status, required_date, created_at, is_demo',
      purchases: 'id, client_tx_id, supplier_id, receiving_location_id, payment_status, invoice_date, created_at, is_demo',
      menu_items: 'id, business_id, category_id, sort_order, is_available, is_demo',
    });

    this.version(3).stores({
      user_sessions: 'id, user_id, device_id, is_active, login_at',
      login_audit_logs: 'id, user_id, email, status, created_at',
      login_approval_requests: 'id, user_id, email, status, created_at',
    });

    this.version(4).stores({
      role_permissions: 'role',
    });

    this.version(5).stores({
      supplier_payments: 'id, purchase_id, supplier_id, payment_date, is_demo',
    });
  }
}

export const db = new ChaatKultureDexieDB();

// ---------------- DEFAULT INITIALIZATION ----------------
export async function initializeDatabaseDefaults() {
  const bizCount = await db.businesses.count();
  if (bizCount > 0) return; // Already initialized

  const now = new Date().toISOString();
  const businessId = 'biz_chaatkulture_01';

  // 1. Root Business
  await db.businesses.put({
    id: businessId,
    name: 'Chaat Kulture',
    slug: 'chaat-kulture',
    currency: 'INR',
    currency_symbol: '₹',
    default_tax_rate: 5.0, // Configurable default (5% GST on dining)
    created_at: now,
    updated_at: now,
  });

  // 2. Approved Four Separate Locations
  await db.locations.bulkPut([
    {
      id: 'loc_base_01',
      business_id: businessId,
      code: 'BASE-01',
      name: 'Base Kitchen',
      type: 'base_kitchen',
      address: 'Industrial Area, Govindpura, Bhopal',
      phone: '9826011111',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'loc_stor_02',
      business_id: businessId,
      code: 'STOR-02',
      name: 'Central Store Room',
      type: 'store_room',
      address: 'Industrial Area, Govindpura, Bhopal',
      phone: '9826011112',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'loc_shah_03',
      business_id: businessId,
      code: 'SHAH-03',
      name: 'Shahpura Street Outlet',
      type: 'outlet',
      address: 'Sector B, Shahpura Lake Promenade, Bhopal',
      phone: '9826022222',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'loc_11no_04',
      business_id: businessId,
      code: '11NO-04',
      name: 'Tukisssz Kasa, 11 No. Stop Food Court Outlet',
      type: 'outlet',
      address: 'Food Court Zone, 11 No. Stop, Arera Colony, Bhopal',
      phone: '9826033333',
      is_active: true,
      created_at: now,
      updated_at: now,
    },
  ]);

  // 3. Standard Units
  await db.units.bulkPut([
    { id: 'u_kg', business_id: businessId, name: 'Kilogram', code: 'kg', is_base_unit: true, conversion_factor: 1.0, created_at: now },
    { id: 'u_g', business_id: businessId, name: 'Gram', code: 'g', is_base_unit: false, conversion_factor: 0.001, base_unit_code: 'kg', created_at: now },
    { id: 'u_ltr', business_id: businessId, name: 'Litre', code: 'ltr', is_base_unit: true, conversion_factor: 1.0, created_at: now },
    { id: 'u_ml', business_id: businessId, name: 'Millilitre', code: 'ml', is_base_unit: false, conversion_factor: 0.001, base_unit_code: 'ltr', created_at: now },
    { id: 'u_pc', business_id: businessId, name: 'Piece', code: 'pc', is_base_unit: true, conversion_factor: 1.0, created_at: now },
    { id: 'u_plate', business_id: businessId, name: 'Plate', code: 'plate', is_base_unit: true, conversion_factor: 1.0, created_at: now },
    { id: 'u_pkt', business_id: businessId, name: 'Packet', code: 'pkt', is_base_unit: true, conversion_factor: 1.0, created_at: now },
    { id: 'u_box', business_id: businessId, name: 'Box', code: 'box', is_base_unit: true, conversion_factor: 1.0, created_at: now },
  ]);

  // 4. Default 6 Feature Flags
  await db.feature_flags.bulkPut([
    { id: 'ff_1', business_id: businessId, feature_key: 'owner_command_centre', name: 'Owner Command Centre', description: 'Consolidated multi-outlet operations, financial intelligence and alert centre', is_enabled: true },
    { id: 'ff_2', business_id: businessId, feature_key: 'production_planner', name: 'Production Planner', description: 'Kitchen batch planning based on outlet request demand and available stock', is_enabled: true },
    { id: 'ff_3', business_id: businessId, feature_key: 'recipe_costing', name: 'Recipe Costing & Menu Profitability', description: 'Theoretical ingredient cost modeling (does not auto-consume inventory)', is_enabled: false },
    { id: 'ff_4', business_id: businessId, feature_key: 'staff_accountability', name: 'Staff Accountability & Audit Trail', description: 'Detailed logging of every transaction, override, discount and approval', is_enabled: true },
    { id: 'ff_5', business_id: businessId, feature_key: 'smart_alerts', name: 'Smart Operational Alerts', description: 'Real-time notifications for variances, missing closings, shortages, and unpaid bills', is_enabled: true },
    { id: 'ff_6', business_id: businessId, feature_key: 'business_intelligence', name: 'Business Intelligence & Multi-Outlet Analytics', description: 'Outlet comparison metrics, hourly sales patterns and profit forecasting', is_enabled: true },
  ]);

  // 5. Initial Root Super Admin (Strictly Sole Super Admin, No Dummy Personas)
  const existingOwner = await db.user_profiles.get('usr_owner');
  if (!existingOwner) {
    await db.user_profiles.put({
      id: 'usr_owner',
      business_id: businessId,
      full_name: 'Aditya Sharma (Super Admin)',
      email: 'admin@chaatkulture.com',
      phone: '9826000001',
      role: 'owner',
      password_salt: 'ck_salt_admin_01',
      password_hash: '090c6b58ae017ee3d9b6caf4c8bf7bd113d6786f49a79bb84aa0b7f4e300e3d2', // Admin@ChaatKulture2026
      plain_password: 'Admin@ChaatKulture2026',
      pin_hash: '1234',
      assigned_location_ids: ['loc_base_01', 'loc_stor_02', 'loc_shah_03', 'loc_11no_04'],
      assigned_location_id: 'loc_base_01',
      is_active: true,
      notes: 'Sole Super Admin with root authority over Chaat Kulture OS.',
      created_at: now,
    });
  } else {
    // Keep Super Admin email and role aligned
    if (existingOwner.email !== 'admin@chaatkulture.com' || existingOwner.role !== 'owner' || !existingOwner.plain_password) {
      existingOwner.email = 'admin@chaatkulture.com';
      existingOwner.role = 'owner';
      existingOwner.plain_password = 'Admin@ChaatKulture2026';
      existingOwner.password_hash = '090c6b58ae017ee3d9b6caf4c8bf7bd113d6786f49a79bb84aa0b7f4e300e3d2';
      existingOwner.password_salt = 'ck_salt_admin_01';
      existingOwner.pin_hash = '1234';
      await db.user_profiles.put(existingOwner);
    }
  }

  // 6. Default Expense Categories
  await db.expense_categories.bulkPut([
    { id: 'exp_cat_1', business_id: businessId, name: 'LPG Gas Cylinders', is_active: true, created_at: now },
    { id: 'exp_cat_2', business_id: businessId, name: 'Fuel & Transportation', is_active: true, created_at: now },
    { id: 'exp_cat_3', business_id: businessId, name: 'Electricity & Utilities', is_active: true, created_at: now },
    { id: 'exp_cat_4', business_id: businessId, name: 'Local Groceries & Dairy', is_active: true, created_at: now },
    { id: 'exp_cat_5', business_id: businessId, name: 'Repairs & Maintenance', is_active: true, created_at: now },
    { id: 'exp_cat_6', business_id: businessId, name: 'Cleaning & Hygiene Supplies', is_active: true, created_at: now },
    { id: 'exp_cat_7', business_id: businessId, name: 'Outlet Rent & Food Court Dues', is_active: true, created_at: now },
    { id: 'exp_cat_8', business_id: businessId, name: 'Miscellaneous Petty Cash', is_active: true, created_at: now },
  ]);

  // NOTE:
  // menu_categories: EMPTY
  // menu_items: EMPTY
  // inventory_categories: EMPTY
  // inventory_items: EMPTY
  // suppliers: EMPTY
  // purchases: EMPTY
  // sales: EMPTY
  // stock_requests: EMPTY
  // dispatches: EMPTY
  // daily_closings: EMPTY
}
