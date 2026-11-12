// =============================================================================
// CHAAT KULTURE OS — Domain Types & Data Contracts
// Version 2.1 — Master PRD Aligned
// =============================================================================

export type UserRole = 'owner' | 'manager' | 'kitchen_manager' | 'outlet_staff';

export type LocationType = 'base_kitchen' | 'store_room' | 'outlet' | 'kiosk';

export interface Business {
  id: string;
  name: string;
  slug: string;
  currency: string;
  currency_symbol: string;
  default_tax_rate: number;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: string;
  business_id: string;
  name: string;
  code: string; // e.g. 'BASE-01', 'STOR-02', 'SHAH-03', '11NO-04'
  type: LocationType;
  address: string;
  phone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  business_id: string;
  email?: string;
  phone: string;
  full_name: string;
  role: UserRole;
  password_hash?: string; // SHA-256 salted hash
  password_salt?: string;
  pin_hash?: string; // Quick PIN for terminal login
  pin_salt?: string;
  failed_pin_attempts?: number;
  locked_until?: string;
  assigned_location_id?: string; // Legacy / Primary location
  assigned_location_ids?: string[]; // Multiple assigned outlets & kitchens
  notes?: string;
  is_active: boolean;
  created_at: string;
}

export interface UserSession {
  id: string; // session_id
  user_id: string;
  user_email: string;
  user_name: string;
  role: UserRole;
  device_id: string; // unique device fingerprint
  device_name: string; // e.g. "Windows PC (Chrome 122)" or "Samsung Galaxy Tab (Chrome Mobile)"
  ip_address?: string;
  latitude?: number;
  longitude?: number;
  location_accuracy?: number;
  location_address?: string;
  is_active: boolean;
  login_at: string;
  last_active_at: string;
  revoked_at?: string;
  revocation_reason?: 'user_logout' | 'concurrent_login_override' | 'admin_revoked';
}

export interface LoginAuditLog {
  id: string;
  user_id?: string;
  email: string;
  full_name?: string;
  role?: UserRole;
  status:
    | 'SUCCESS'
    | 'FAILED_CREDENTIALS'
    | 'BLOCKED_LOCATION_DENIED'
    | 'BLOCKED_UNAUTHORIZED_DEVICE'
    | 'PENDING_APPROVAL'
    | 'APPROVED_BY_ADMIN'
    | 'REJECTED_BY_ADMIN'
    | 'LOGOUT'
    | 'CONCURRENT_SESSION_TERMINATED';
  latitude?: number;
  longitude?: number;
  location_accuracy?: number;
  location_address?: string;
  device_id: string;
  device_name: string;
  user_agent: string;
  ip_address?: string;
  screen_resolution?: string;
  notes?: string;
  created_at: string;
}

export interface LoginApprovalRequest {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  device_id: string;
  device_name: string;
  latitude?: number;
  longitude?: number;
  location_address?: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  bypass_token?: string;
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
}

export interface UserLocationAccess {
  id: string;
  user_id: string;
  location_id: string;
  can_manage: boolean;
  created_at: string;
}

// ---------------- MENU TYPES ----------------
export interface MenuCategory {
  id: string;
  business_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  is_demo?: boolean;
  created_at: string;
}

export interface MenuItem {
  id: string;
  business_id: string;
  category_id: string;
  name: string;
  code?: string;
  description?: string;
  base_price: number;
  tax_rate: number; // Configurable per item, never hardcoded
  is_tax_inclusive?: boolean; // When true, base_price is already inclusive of GST; when false, GST is added on top
  channel_prices?: {
    walk_in?: number;
    zomato?: number;
    swiggy?: number;
    other?: number;
  };
  location_availability?: string[]; // Array of location IDs, null/empty = all locations
  is_available: boolean;
  sort_order: number;
  image_url?: string;
  is_demo?: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------- INVENTORY & UNITS ----------------
export type InventoryCategoryType = 
  | 'raw_material' 
  | 'prepared_food' 
  | 'semi_prepared' 
  | 'packaging' 
  | 'disposables' 
  | 'consumables' 
  | 'other';

export interface InventoryCategory {
  id: string;
  business_id: string;
  name: string;
  category_type: InventoryCategoryType;
  description?: string;
  is_demo?: boolean;
  created_at: string;
}

export interface Unit {
  id: string;
  business_id: string;
  name: string; // e.g. "Kilogram", "Gram", "Litre", "Piece", "Plate"
  code: string; // e.g. "kg", "g", "ltr", "ml", "pc", "plate"
  is_base_unit: boolean;
  conversion_factor: number; // multiplier to base unit
  base_unit_code?: string;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  business_id: string;
  category_id: string;
  name: string;
  code?: string;
  category_type: InventoryCategoryType;
  base_unit: string;
  purchase_unit?: string;
  conversion_factor?: number;
  min_stock_alert: number;
  cost_per_unit: number;
  preferred_supplier_id?: string;
  locations_allowed?: string[];
  is_active: boolean;
  notes?: string;
  is_demo?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface InventoryBalance {
  id: string;
  business_id: string;
  location_id: string;
  inventory_item_id: string;
  available_quantity: number;
  in_transit_quantity: number;
  last_updated: string;
  last_updated_by?: string;
}

export type MovementType = 
  | 'opening_balance'
  | 'purchase_receipt'
  | 'production_output'
  | 'dispatch_out'
  | 'dispatch_in'
  | 'wastage'
  | 'damage'
  | 'staff_consumption'
  | 'adjustment'
  | 'physical_count_variance'
  | 'transfer_reversal'
  | 'authorised_reversal';

export interface InventoryMovement {
  id: string;
  client_tx_id: string;
  business_id: string;
  location_id: string;
  inventory_item_id: string;
  movement_type: MovementType;
  quantity_change: number; // positive or negative
  balance_after: number;
  unit: string;
  batch_reference?: string;
  notes?: string;
  reference_id?: string; // purchase_id, dispatch_id, etc.
  created_by?: string;
  created_at: string;
  is_demo?: boolean;
}

// ---------------- SUPPLIERS & PURCHASES ----------------
export interface Supplier {
  id: string;
  business_id: string;
  name: string;
  contact_person?: string;
  phone: string;
  address?: string;
  gstin?: string;
  payment_terms?: string;
  opening_balance: number;
  current_outstanding: number;
  is_active: boolean;
  notes?: string;
  is_demo?: boolean;
  created_at: string;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  inventory_item_id: string;
  item_name: string;
  quantity: number;
  unit: string;
  rate: number;
  tax_amount: number;
  total_amount: number;
}

export interface Purchase {
  id: string;
  client_tx_id: string;
  business_id: string;
  supplier_id: string;
  receiving_location_id: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  tax_amount: number;
  discount_amount: number;
  paid_amount: number;
  outstanding_balance: number;
  payment_status: 'paid' | 'partially_paid' | 'unpaid';
  invoice_image_url?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  items?: PurchaseItem[];
  is_demo?: boolean;
}

export interface SupplierPayment {
  id: string;
  business_id: string;
  purchase_id?: string;
  supplier_id: string;
  amount: number;
  payment_method: 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'other';
  payment_date: string;
  reference_id?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  is_demo?: boolean;
}

// ---------------- EXPENSES ----------------
export interface ExpenseCategory {
  id: string;
  business_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface Expense {
  id: string;
  client_tx_id: string;
  business_id: string;
  location_id: string;
  category_id: string;
  description: string;
  amount: number;
  payment_method: 'cash' | 'upi' | 'bank_transfer' | 'other';
  payment_status: 'paid' | 'partially_paid' | 'unpaid' | 'cancelled';
  amount_paid: number;
  outstanding_balance: number;
  due_date?: string;
  supplier_payee?: string;
  vendor_name?: string;
  receipt_url?: string;
  receipt_images?: string[]; // Multiple bill/invoice image files (Base64 data URLs)
  is_handwritten?: boolean; // Flag if recorded without printed bill (handwritten note / market purchase)
  created_by_role?: UserRole; // Role who uploaded / logged the expense
  expense_date: string;
  paid_by?: string;
  notes?: string;
  created_at: string;
  is_demo?: boolean;
}

export interface ExpensePayment {
  id: string;
  expense_id: string;
  amount: number;
  payment_method: 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'other';
  payment_date: string;
  reference_number?: string;
  paid_by?: string;
  notes?: string;
  created_at: string;
  is_demo?: boolean;
}

// ---------------- SALES & POS ----------------
export type SalesChannel = 'walk_in' | 'zomato' | 'swiggy' | 'other';
export type PaymentMethod = 'cash' | 'upi' | 'card' | 'other';

export interface SaleItem {
  id: string;
  sale_id: string;
  menu_item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  tax_amount: number;
  total_price: number;
  is_complimentary: boolean;
  complimentary_reason?: string;
  complimentary_authorized_by?: string;
  created_at: string;
}

export interface SalePayment {
  id: string;
  sale_id: string;
  payment_method: PaymentMethod;
  amount: number;
  reference_id?: string;
  created_at: string;
}

export interface Sale {
  id: string;
  client_tx_id: string;
  business_id: string;
  location_id: string;
  order_number: string;
  channel: SalesChannel;
  gross_amount: number;
  tax_amount: number;
  discount_amount: number;
  discount_type?: 'percentage' | 'fixed' | 'none';
  discount_reason?: string;
  discount_authorized_by?: string;
  net_amount: number;
  payment_status: 'completed' | 'partially_refunded' | 'fully_refunded' | 'cancelled';
  created_by?: string;
  created_at: string;
  synced_at?: string;
  notes?: string;
  items?: SaleItem[];
  payments?: SalePayment[];
  is_demo?: boolean;
}

// ---------------- TRANSFERS & DISPATCHES ----------------
export type RequestStatus = 
  | 'draft' 
  | 'submitted' 
  | 'reviewed' 
  | 'approved' 
  | 'partially_approved' 
  | 'sent'
  | 'dispatched' 
  | 'delivered'
  | 'received' 
  | 'partially_received' 
  | 'closed' 
  | 'rejected';

export interface StockRequestItem {
  id: string;
  stock_request_id: string;
  inventory_item_id: string;
  item_name?: string;
  requested_quantity: number;
  approved_quantity: number;
  dispatched_quantity: number;
  received_quantity: number;
  unit: string;
  notes?: string;
}

export interface StockRequest {
  id: string;
  client_tx_id: string;
  business_id: string;
  request_number: string;
  from_location_id: string; // Outlet requesting
  to_location_id: string; // Kitchen/Store fulfilling
  request_type: 'next_day' | 'same_day_urgent';
  required_date: string;
  status: RequestStatus;
  rejection_reason?: string;
  notes?: string;
  created_by?: string;
  reviewed_by?: string;
  created_at: string;
  updated_at: string;
  items?: StockRequestItem[];
  is_demo?: boolean;
}

export interface DispatchItem {
  id: string;
  dispatch_id: string;
  inventory_item_id: string;
  item_name?: string;
  requested_quantity: number;
  dispatched_quantity: number;
  received_quantity: number;
  damaged_or_missing_quantity: number;
  unit: string;
  discrepancy_reason?: string;
}

export interface Dispatch {
  id: string;
  client_tx_id: string;
  business_id: string;
  challan_number: string;
  stock_request_id?: string;
  from_location_id: string;
  to_location_id: string;
  status: 'raised' | 'approved' | 'rejected' | 'sent' | 'in_transit' | 'delivered' | 'received' | 'partially_received' | 'discrepancy' | 'cancelled';
  dispatch_date: string;
  received_date?: string;
  dispatched_by?: string;
  received_by?: string;
  vehicle_number?: string;
  driver_name?: string;
  driver_phone?: string;
  cancellation_reason?: string;
  cancelled_by?: string;
  cancelled_at?: string;
  notes?: string;
  created_at: string;
  items?: DispatchItem[];
  is_demo?: boolean;
}

export interface ProductionRecord {
  id: string;
  client_tx_id: string;
  business_id: string;
  location_id: string;
  batch_number: string;
  inventory_item_id: string;
  item_name?: string;
  quantity_produced: number;
  unit: string;
  production_date: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  is_demo?: boolean;
}

export interface WastageRecord {
  id: string;
  client_tx_id: string;
  business_id: string;
  location_id: string;
  inventory_item_id: string;
  item_name?: string;
  quantity: number;
  unit: string;
  reason: 'spoilage' | 'preparation_wastage' | 'damage' | 'spillage' | 'staff_consumption' | 'other';
  photo_url?: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  created_by?: string;
  notes?: string;
  created_at: string;
  is_demo?: boolean;
}

// ---------------- DAILY CLOSING (12 SECTIONS) ----------------
export type SectionStatus = 'not_started' | 'in_progress' | 'completed' | 'attention_required';

export interface DailyClosing {
  id: string;
  business_id: string;
  location_id: string;
  closing_date: string;
  status: 'not_started' | 'in_progress' | 'submitted' | 'reopened' | 'finalised';
  sales_status: SectionStatus;
  cash_status: SectionStatus;
  upi_status: SectionStatus;
  zomato_status: SectionStatus;
  swiggy_status: SectionStatus;
  expenses_status: SectionStatus;
  stock_status: SectionStatus;
  wastage_status: SectionStatus;
  receiving_status: SectionStatus;
  dispatch_status: SectionStatus;
  notes_status: SectionStatus;
  final_submission_status: SectionStatus;
  completed_sections_count: number;
  notes?: string;
  submitted_by?: string;
  submitted_at?: string;
  reopened_by?: string;
  reopened_at?: string;
  reopen_reason?: string;
  created_at: string;
  updated_at: string;
  is_demo?: boolean;
}

export interface CashClosing {
  id: string;
  business_id: string;
  location_id: string;
  closing_date: string;
  opening_cash: number;
  cash_sales: number;
  other_cash_receipts: number;
  cash_expenses: number;
  cash_refunds: number;
  cash_transferred_to_owner: number;
  expected_closing_cash: number;
  physical_closing_cash: number;
  difference: number;
  notes?: string;
  created_by?: string;
  created_at: string;
  is_demo?: boolean;
}

export interface CashTransferToOwner {
  id: string;
  business_id: string;
  from_location_id: string;
  recipient_name: string;
  amount: number;
  transfer_date: string;
  payment_method: 'cash_handover' | 'bank_deposit' | 'upi_transfer';
  reference_number?: string;
  is_confirmed: boolean;
  recorded_by?: string;
  created_at: string;
  is_demo?: boolean;
}

export interface StockCount {
  id: string;
  daily_closing_id?: string;
  business_id: string;
  location_id: string;
  count_date: string;
  inventory_item_id: string;
  opening_stock: number;
  receipts_and_transfers_in: number;
  production_output: number;
  transfers_out: number;
  wastage: number;
  other_consumption: number;
  expected_closing: number;
  physical_closing: number;
  variance: number;
  variance_flagged: boolean;
  notes?: string;
  counted_by?: string;
  created_at: string;
  is_demo?: boolean;
}

// ---------------- AUDIT & REVISIONS ----------------
export interface AuditLog {
  id: string;
  business_id: string;
  user_id?: string;
  user_name?: string;
  action: string;
  entity: string;
  entity_id?: string;
  old_data?: any;
  new_data?: any;
  location_id?: string;
  location_name?: string;
  reason?: string;
  created_at: string;
}

export interface RecordRevision {
  id: string;
  business_id: string;
  entity_type: string;
  entity_id: string;
  revision_number: number;
  previous_state: any;
  new_state: any;
  change_reason: string;
  modified_by?: string;
  created_at: string;
}

export interface FeatureFlag {
  id: string;
  business_id: string;
  feature_key: string;
  name: string;
  description: string;
  is_enabled: boolean;
}

// ---------------- ROLE-BASED ACCESS CONTROL (RBAC) ----------------
export type AppPermissionKey = 
  | 'view_dashboard'
  | 'manage_pos'
  | 'view_inventory'
  | 'adjust_inventory'
  | 'manage_kitchen'
  | 'manage_transfers'
  | 'manage_wastage'
  | 'manage_purchases'
  | 'manage_expenses'
  | 'manage_closing'
  | 'reopen_closing'
  | 'view_reports'
  | 'manage_master_data'
  | 'manage_rbac'
  | 'access_sandbox';

export interface PermissionDefinition {
  key: AppPermissionKey;
  label: string;
  category: 'Operations' | 'Inventory' | 'Finance' | 'Administration';
  description: string;
}

export interface RolePermissionConfig {
  role: UserRole;
  role_name: string;
  description: string;
  is_system_immutable?: boolean;
  permissions: Record<AppPermissionKey, boolean>;
}

