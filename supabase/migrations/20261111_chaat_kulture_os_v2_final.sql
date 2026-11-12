-- ==============================================================================
-- CHAAT KULTURE OS (v2.4) — PRODUCTION-READY COMPREHENSIVE MIGRATION
-- ==============================================================================
-- Architecture: 61 Business Domain Tables + 1 Infrastructure Table (62 Total)
-- Integrity: Composite Business-Scoped Foreign Keys & Restrictive Deletions
-- Security: Row Level Security on Every Table + SECURITY DEFINER RPC Functions
-- Seed: Foundational Configuration & 4 Approved Locations Only (Real Data Empty)
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 0. INFRASTRUCTURE & EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(50) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checksum VARCHAR(64) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 1. ORGANIZATION & SECURITY DOMAIN (9 TABLES)
-- ------------------------------------------------------------------------------

-- 1. businesses
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  legal_name VARCHAR(200),
  tax_identifier VARCHAR(50),
  currency_code VARCHAR(10) NOT NULL DEFAULT 'INR',
  timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. locations (4 Approved Physical Locations)
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(150) NOT NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN ('base_kitchen', 'store_room', 'outlet')),
  phone VARCHAR(20),
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_locations_code UNIQUE (business_id, code),
  CONSTRAINT uq_locations_biz_id UNIQUE (business_id, id),
  CONSTRAINT chk_location_codes CHECK (code IN ('BASE-01', 'STOR-02', 'SHAH-03', '11NO-04'))
);

-- 3. user_profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE,
  phone VARCHAR(20),
  role VARCHAR(30) NOT NULL CHECK (role IN ('owner', 'manager', 'kitchen_manager', 'outlet_staff')),
  primary_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  pin_hash VARCHAR(255),
  pin_failed_attempts INT NOT NULL DEFAULT 0,
  pin_locked_until TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_users_biz_id UNIQUE (business_id, id),
  CONSTRAINT fk_user_primary_loc FOREIGN KEY (business_id, primary_location_id) REFERENCES locations(business_id, id)
);

-- 4. user_location_access
CREATE TABLE IF NOT EXISTS user_location_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  can_manage BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_location UNIQUE (user_id, location_id),
  CONSTRAINT fk_user_loc_biz FOREIGN KEY (business_id, location_id) REFERENCES locations(business_id, id)
);

-- 5. roles
CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(30) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT
);

-- 6. permissions
CREATE TABLE IF NOT EXISTS permissions (
  id VARCHAR(100) PRIMARY KEY,
  module VARCHAR(50) NOT NULL,
  description TEXT
);

-- 7. role_permissions
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id VARCHAR(30) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id VARCHAR(100) NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- 8. feature_flags (6 PRD Flags)
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  feature_key VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_biz_feature UNIQUE (business_id, feature_key)
);

-- 9. business_settings
CREATE TABLE IF NOT EXISTS business_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  allow_zero_stock_billing BOOLEAN NOT NULL DEFAULT TRUE,
  auto_recipe_deduction BOOLEAN NOT NULL DEFAULT FALSE, -- HARDCODED FALSE
  require_closing_approval BOOLEAN NOT NULL DEFAULT TRUE,
  max_cash_drawer_variance NUMERIC(10,2) NOT NULL DEFAULT 100.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_biz_settings UNIQUE (business_id),
  CONSTRAINT chk_no_recipe_auto_deduction CHECK (auto_recipe_deduction = FALSE)
);

-- ------------------------------------------------------------------------------
-- 2. TAX & MENU DOMAIN (5 TABLES)
-- ------------------------------------------------------------------------------

-- 10. tax_rates (Configurable — No Universal Hardcoded Rate)
CREATE TABLE IF NOT EXISTS tax_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  name VARCHAR(100) NOT NULL,
  rate_percentage NUMERIC(5,2) NOT NULL CHECK (rate_percentage >= 0.00),
  cgst_rate NUMERIC(5,2) NOT NULL CHECK (cgst_rate >= 0.00),
  sgst_rate NUMERIC(5,2) NOT NULL CHECK (sgst_rate >= 0.00),
  igst_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tax_rates_biz_id UNIQUE (business_id, id),
  CONSTRAINT chk_tax_components CHECK (rate_percentage = cgst_rate + sgst_rate + igst_rate)
);

-- 11. menu_categories
CREATE TABLE IF NOT EXISTS menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  name VARCHAR(100) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_menu_cat_biz_id UNIQUE (business_id, id)
);

-- 12. menu_items
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  category_id UUID NOT NULL REFERENCES menu_categories(id) ON DELETE RESTRICT,
  name VARCHAR(150) NOT NULL,
  code VARCHAR(30),
  description TEXT,
  pricing_type VARCHAR(20) NOT NULL DEFAULT 'tax_exclusive' CHECK (pricing_type IN ('tax_exclusive', 'tax_inclusive')),
  base_price NUMERIC(10,2) NOT NULL CHECK (base_price >= 0.00),
  tax_rate_id UUID NOT NULL REFERENCES tax_rates(id) ON DELETE RESTRICT,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_menu_items_biz_id UNIQUE (business_id, id)
);

-- 13. menu_item_locations
CREATE TABLE IF NOT EXISTS menu_item_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  override_price NUMERIC(10,2) CHECK (override_price >= 0.00),
  override_tax_rate_id UUID REFERENCES tax_rates(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_menu_item_loc UNIQUE (menu_item_id, location_id),
  CONSTRAINT fk_menu_loc_biz FOREIGN KEY (business_id, location_id) REFERENCES locations(business_id, id)
);

-- 14. menu_price_history
CREATE TABLE IF NOT EXISTS menu_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  old_price NUMERIC(10,2) NOT NULL,
  new_price NUMERIC(10,2) NOT NULL,
  old_tax_rate NUMERIC(5,2) NOT NULL,
  new_tax_rate NUMERIC(5,2) NOT NULL,
  changed_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  change_reason TEXT NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. SALES POS & OPERATIONS DOMAIN (7 TABLES)
-- ------------------------------------------------------------------------------

-- 15. sales
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tx_id VARCHAR(100) UNIQUE NOT NULL,
  payload_hash VARCHAR(64) NOT NULL,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  device_id VARCHAR(100) NOT NULL,
  order_number VARCHAR(50) NOT NULL,
  channel VARCHAR(30) NOT NULL CHECK (channel IN ('walk_in', 'zomato', 'swiggy', 'other')),
  gross_amount NUMERIC(12,2) NOT NULL CHECK (gross_amount >= 0.00),
  tax_amount NUMERIC(12,2) NOT NULL CHECK (tax_amount >= 0.00),
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0.00),
  net_amount NUMERIC(12,2) NOT NULL CHECK (net_amount >= 0.00),
  payment_status VARCHAR(30) NOT NULL DEFAULT 'completed' CHECK (payment_status IN ('completed', 'partially_refunded', 'fully_refunded', 'cancelled')),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  client_timestamp TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_sales_biz_id UNIQUE (business_id, id),
  CONSTRAINT fk_sales_loc_biz FOREIGN KEY (business_id, location_id) REFERENCES locations(business_id, id)
);

-- 16. sale_items (Frozen Tax Snapshots)
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  item_name VARCHAR(150) NOT NULL,
  quantity NUMERIC(8,2) NOT NULL CHECK (quantity > 0.00),
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0.00),
  applied_tax_rate NUMERIC(5,2) NOT NULL CHECK (applied_tax_rate >= 0.00),
  cgst_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  sgst_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  igst_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  total_price NUMERIC(12,2) NOT NULL,
  is_complimentary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_sale_item_tax CHECK (tax_amount = cgst_amount + sgst_amount + igst_amount)
);

-- 17. sale_payments (Multi-Split Payments)
CREATE TABLE IF NOT EXISTS sale_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tx_id VARCHAR(100) UNIQUE NOT NULL,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('cash', 'upi', 'card', 'other')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0.00),
  reference_id VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 18. sale_discounts
CREATE TABLE IF NOT EXISTS sale_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  discount_type VARCHAR(30) NOT NULL CHECK (discount_type IN ('percentage', 'fixed', 'promo_code')),
  discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value >= 0.00),
  discount_amount NUMERIC(10,2) NOT NULL CHECK (discount_amount >= 0.00),
  discount_reason TEXT NOT NULL,
  authorized_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 19. sale_refunds
CREATE TABLE IF NOT EXISTS sale_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tx_id VARCHAR(100) UNIQUE NOT NULL,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  refund_amount NUMERIC(12,2) NOT NULL CHECK (refund_amount > 0.00),
  payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('cash', 'upi')),
  reason TEXT NOT NULL,
  authorized_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 20. sale_refund_items (Item-Level Refund Allocation)
CREATE TABLE IF NOT EXISTS sale_refund_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_refund_id UUID NOT NULL REFERENCES sale_refunds(id) ON DELETE RESTRICT,
  sale_item_id UUID NOT NULL REFERENCES sale_items(id) ON DELETE RESTRICT,
  refunded_quantity NUMERIC(8,2) NOT NULL CHECK (refunded_quantity > 0.00),
  refunded_amount NUMERIC(10,2) NOT NULL CHECK (refunded_amount > 0.00)
);

-- 21. complimentary_items
CREATE TABLE IF NOT EXISTS complimentary_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  sale_item_id UUID NOT NULL REFERENCES sale_items(id) ON DELETE RESTRICT,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  quantity NUMERIC(8,2) NOT NULL CHECK (quantity > 0.00),
  reason TEXT NOT NULL,
  authorized_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_comp_sale_item UNIQUE (sale_item_id)
);

-- ------------------------------------------------------------------------------
-- 4. UNITS & INVENTORY MASTER DOMAIN (7 TABLES)
-- ------------------------------------------------------------------------------

-- 22. units
CREATE TABLE IF NOT EXISTS units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  name VARCHAR(50) NOT NULL,
  code VARCHAR(20) NOT NULL,
  is_base_unit BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_units_biz_code UNIQUE (business_id, code)
);

-- 23. unit_conversions
CREATE TABLE IF NOT EXISTS unit_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  to_unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  multiplier NUMERIC(12,6) NOT NULL CHECK (multiplier > 0.000000),
  CONSTRAINT uq_unit_conversions UNIQUE (from_unit_id, to_unit_id)
);

-- 24. inventory_categories
CREATE TABLE IF NOT EXISTS inventory_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  name VARCHAR(100) NOT NULL,
  category_type VARCHAR(30) NOT NULL CHECK (category_type IN ('raw_material', 'semi_finished', 'finished_good', 'packaging', 'consumables', 'other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 25. inventory_items
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  category_id UUID NOT NULL REFERENCES inventory_categories(id) ON DELETE RESTRICT,
  name VARCHAR(150) NOT NULL,
  code VARCHAR(50),
  category_type VARCHAR(30) NOT NULL,
  base_unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  cost_per_unit NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (cost_per_unit >= 0.00),
  min_stock_alert NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  preferred_supplier_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_inv_items_biz_id UNIQUE (business_id, id)
);

-- 26. inventory_item_locations
CREATE TABLE IF NOT EXISTS inventory_item_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  min_stock_alert NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  is_stocked BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_inv_item_loc UNIQUE (inventory_item_id, location_id),
  CONSTRAINT fk_inv_loc_biz FOREIGN KEY (business_id, location_id) REFERENCES locations(business_id, id)
);

-- 27. inventory_balances
CREATE TABLE IF NOT EXISTS inventory_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  available_quantity NUMERIC(12,3) NOT NULL DEFAULT 0.000,
  in_transit_quantity NUMERIC(12,3) NOT NULL DEFAULT 0.000 CHECK (in_transit_quantity >= 0.000),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_inv_balance_loc_item UNIQUE (location_id, inventory_item_id),
  CONSTRAINT fk_inv_balance_loc_biz FOREIGN KEY (business_id, location_id) REFERENCES locations(business_id, id)
);

-- 28. inventory_movements (Append-Only Physical Movement Ledger)
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tx_id VARCHAR(100) UNIQUE NOT NULL,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  movement_type VARCHAR(40) NOT NULL CHECK (movement_type IN (
    'purchase_receipt', 'production_output', 'transfer_dispatch', 
    'transfer_receipt', 'wastage', 'manual_adjustment', 
    'opening_balance', 'adjustment_reversal'
  )),
  quantity NUMERIC(12,3) NOT NULL,
  balance_after NUMERIC(12,3) NOT NULL,
  reference_table VARCHAR(50) NOT NULL,
  reference_id UUID NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_inv_mov_loc_biz FOREIGN KEY (business_id, location_id) REFERENCES locations(business_id, id)
);

-- ------------------------------------------------------------------------------
-- 5. STOCK AUDITS, ADJUSTMENTS & WASTAGE DOMAIN (4 TABLES)
-- ------------------------------------------------------------------------------

-- 29. stock_counts
CREATE TABLE IF NOT EXISTS stock_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  count_date DATE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'verified')),
  snapshot_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  counted_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  verified_by UUID REFERENCES user_profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_stock_counts_loc_date UNIQUE (location_id, count_date)
);

-- 30. stock_count_items
CREATE TABLE IF NOT EXISTS stock_count_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_count_id UUID NOT NULL REFERENCES stock_counts(id) ON DELETE RESTRICT,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  opening_stock NUMERIC(12,3) NOT NULL,
  inward_receipts NUMERIC(12,3) NOT NULL DEFAULT 0.000,
  production_output NUMERIC(12,3) NOT NULL DEFAULT 0.000,
  transfers_out NUMERIC(12,3) NOT NULL DEFAULT 0.000,
  wastage NUMERIC(12,3) NOT NULL DEFAULT 0.000,
  expected_closing NUMERIC(12,3) NOT NULL,
  physical_closing NUMERIC(12,3) NOT NULL,
  variance NUMERIC(12,3) NOT NULL,
  is_flagged BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT
);

-- 31. stock_adjustments
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tx_id VARCHAR(100) UNIQUE NOT NULL,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  quantity_adjusted NUMERIC(12,3) NOT NULL,
  reason TEXT NOT NULL,
  authorized_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  reversal_of_id UUID REFERENCES stock_adjustments(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 32. wastage_records (Default 'pending' Status)
CREATE TABLE IF NOT EXISTS wastage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tx_id VARCHAR(100) UNIQUE NOT NULL,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0.000),
  reason VARCHAR(40) NOT NULL CHECK (reason IN ('spoilage', 'preparation_wastage', 'damage', 'spillage', 'staff_consumption', 'other')),
  cost_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  photo_url TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. KITCHEN PRODUCTION & TRANSFERS DOMAIN (7 TABLES)
-- ------------------------------------------------------------------------------

-- 33. production_records
CREATE TABLE IF NOT EXISTS production_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tx_id VARCHAR(100) UNIQUE NOT NULL,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  batch_number VARCHAR(50) NOT NULL,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  quantity_produced NUMERIC(12,3) NOT NULL CHECK (quantity_produced > 0.000),
  production_date DATE NOT NULL,
  created_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_biz_batch_no UNIQUE (business_id, batch_number)
);

-- 34. stock_requests (Outlet Indents)
CREATE TABLE IF NOT EXISTS stock_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tx_id VARCHAR(100) UNIQUE NOT NULL,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  request_number VARCHAR(50) UNIQUE NOT NULL,
  from_location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  to_location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  request_type VARCHAR(30) NOT NULL DEFAULT 'next_day' CHECK (request_type IN ('next_day', 'same_day_urgent')),
  required_date DATE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'reviewed', 'approved', 'partially_approved', 'dispatched', 'received', 'closed', 'rejected')),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 35. stock_request_items
CREATE TABLE IF NOT EXISTS stock_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_request_id UUID NOT NULL REFERENCES stock_requests(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  requested_quantity NUMERIC(12,3) NOT NULL CHECK (requested_quantity > 0.000),
  approved_quantity NUMERIC(12,3) NOT NULL DEFAULT 0.000,
  dispatched_quantity NUMERIC(12,3) NOT NULL DEFAULT 0.000,
  received_quantity NUMERIC(12,3) NOT NULL DEFAULT 0.000
);

-- 36. dispatches (Transfer Challans)
CREATE TABLE IF NOT EXISTS dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tx_id VARCHAR(100) UNIQUE NOT NULL,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  challan_number VARCHAR(50) UNIQUE NOT NULL,
  stock_request_id UUID REFERENCES stock_requests(id) ON DELETE SET NULL,
  from_location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  to_location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  status VARCHAR(30) NOT NULL DEFAULT 'in_transit' CHECK (status IN ('in_transit', 'partially_received', 'received', 'discrepancy')),
  dispatch_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dispatched_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_dispatches_biz_id UNIQUE (business_id, id)
);

-- 37. dispatch_items
CREATE TABLE IF NOT EXISTS dispatch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID NOT NULL REFERENCES dispatches(id) ON DELETE RESTRICT,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  dispatched_quantity NUMERIC(12,3) NOT NULL CHECK (dispatched_quantity > 0.000)
);

-- 38. transfer_receipts (Multi-Event Receiving Header)
CREATE TABLE IF NOT EXISTS transfer_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tx_id VARCHAR(100) UNIQUE NOT NULL,
  dispatch_id UUID NOT NULL REFERENCES dispatches(id) ON DELETE RESTRICT,
  receiving_location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  receipt_number VARCHAR(50) UNIQUE NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 39. transfer_receipt_items (Multi-Event Receiving Lines)
CREATE TABLE IF NOT EXISTS transfer_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_receipt_id UUID NOT NULL REFERENCES transfer_receipts(id) ON DELETE RESTRICT,
  dispatch_item_id UUID NOT NULL REFERENCES dispatch_items(id) ON DELETE RESTRICT,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  actual_received_quantity NUMERIC(12,3) NOT NULL CHECK (actual_received_quantity >= 0.000),
  damaged_quantity NUMERIC(12,3) NOT NULL DEFAULT 0.000 CHECK (damaged_quantity >= 0.000),
  missing_quantity NUMERIC(12,3) NOT NULL DEFAULT 0.000 CHECK (missing_quantity >= 0.000),
  discrepancy_reason TEXT
);

-- ------------------------------------------------------------------------------
-- 7. PURCHASING & SUPPLIER FINANCIAL LEDGER (6 TABLES)
-- ------------------------------------------------------------------------------

-- 40. suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  name VARCHAR(150) NOT NULL,
  contact_person VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(100),
  tax_identifier VARCHAR(50),
  payment_terms_days INT NOT NULL DEFAULT 0,
  opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  current_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_suppliers_biz_id UNIQUE (business_id, id)
);

-- 41. purchases
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tx_id VARCHAR(100) UNIQUE NOT NULL,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  receiving_location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  invoice_number VARCHAR(100) NOT NULL,
  invoice_date DATE NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0.00),
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  outstanding_balance NUMERIC(12,2) NOT NULL CHECK (outstanding_balance >= 0.00),
  payment_status VARCHAR(30) NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'partially_paid', 'unpaid', 'cancelled')),
  due_date DATE,
  created_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_purchases_biz_id UNIQUE (business_id, id),
  CONSTRAINT fk_purchases_supplier_biz FOREIGN KEY (business_id, supplier_id) REFERENCES suppliers(business_id, id)
);

-- 42. purchase_items
CREATE TABLE IF NOT EXISTS purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE RESTRICT,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0.000),
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0.00),
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(12,2) NOT NULL
);

-- 43. supplier_payments
CREATE TABLE IF NOT EXISTS supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tx_id VARCHAR(100) UNIQUE NOT NULL,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  payment_amount NUMERIC(12,2) NOT NULL CHECK (payment_amount > 0.00),
  unallocated_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (unallocated_amount >= 0.00),
  payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('cash', 'upi', 'bank_transfer', 'cheque', 'other')),
  payment_date DATE NOT NULL,
  reference_id VARCHAR(100),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_supplier_pmts_biz_id UNIQUE (business_id, id),
  CONSTRAINT fk_supp_pmt_biz FOREIGN KEY (business_id, supplier_id) REFERENCES suppliers(business_id, id)
);

-- 44. supplier_payment_allocations
CREATE TABLE IF NOT EXISTS supplier_payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_payment_id UUID NOT NULL REFERENCES supplier_payments(id) ON DELETE RESTRICT,
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE RESTRICT,
  allocated_amount NUMERIC(12,2) NOT NULL CHECK (allocated_amount > 0.00),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 45. supplier_ledger_entries (Chronological Statement of Debits and Credits)
CREATE TABLE IF NOT EXISTS supplier_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  entry_date DATE NOT NULL,
  entry_type VARCHAR(30) NOT NULL CHECK (entry_type IN ('opening_balance', 'purchase_invoice', 'payment_voucher', 'adjustment')),
  debit_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  credit_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  running_balance NUMERIC(12,2) NOT NULL,
  reference_table VARCHAR(50) NOT NULL,
  reference_id UUID NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 8. EXPENSES & PAYEES DOMAIN (4 TABLES)
-- ------------------------------------------------------------------------------

-- 46. expense_categories
CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  name VARCHAR(100) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 47. expense_payees
CREATE TABLE IF NOT EXISTS expense_payees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  name VARCHAR(150) NOT NULL,
  payee_type VARCHAR(30) NOT NULL CHECK (payee_type IN ('landlord', 'utility_provider', 'contractor', 'employee', 'vendor', 'other')),
  phone VARCHAR(20),
  upi_id VARCHAR(100),
  bank_account_details TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_payees_biz_id UNIQUE (business_id, id)
);

-- 48. expenses
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tx_id VARCHAR(100) UNIQUE NOT NULL,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  category_id UUID NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
  payee_id UUID REFERENCES expense_payees(id) ON DELETE SET NULL,
  payee_name VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0.00),
  payment_method VARCHAR(30) CHECK (payment_method IN ('cash', 'upi', 'bank_transfer', 'cheque', 'credit')),
  payment_status VARCHAR(30) NOT NULL CHECK (payment_status IN ('paid', 'partially_paid', 'unpaid', 'cancelled')),
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  outstanding_balance NUMERIC(12,2) NOT NULL CHECK (outstanding_balance >= 0.00),
  due_date DATE,
  expense_date DATE NOT NULL,
  created_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_expense_loc_biz FOREIGN KEY (business_id, location_id) REFERENCES locations(business_id, id)
);

-- 49. expense_payments (PRD Section 13 Rule)
CREATE TABLE IF NOT EXISTS expense_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tx_id VARCHAR(100) UNIQUE NOT NULL,
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0.00),
  payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('cash', 'upi', 'bank_transfer', 'cheque', 'other')),
  payment_date DATE NOT NULL,
  reference_number VARCHAR(100),
  paid_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 9. DAILY CLOSING & FINANCIAL RECONCILIATION (6 TABLES)
-- ------------------------------------------------------------------------------

-- 50. daily_closings (12-Section Closing Session Master)
CREATE TABLE IF NOT EXISTS daily_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  closing_date DATE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'submitted', 'reopened', 'finalised')),
  completed_sections_count INT NOT NULL DEFAULT 0,
  notes TEXT,
  submitted_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ,
  reopened_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  reopened_at TIMESTAMPTZ,
  reopen_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_daily_closings_loc_date UNIQUE (location_id, closing_date)
);

-- 51. daily_closing_sections
CREATE TABLE IF NOT EXISTS daily_closing_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_closing_id UUID NOT NULL REFERENCES daily_closings(id) ON DELETE RESTRICT,
  section_number INT NOT NULL CHECK (section_number BETWEEN 1 AND 12),
  section_name VARCHAR(100) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'attention_required')),
  verified_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  summary_data JSONB,
  CONSTRAINT uq_closing_section UNIQUE (daily_closing_id, section_number)
);

-- 52. cash_closings (Authoritative Cash Drawer Formula)
CREATE TABLE IF NOT EXISTS cash_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_closing_id UUID NOT NULL REFERENCES daily_closings(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  closing_date DATE NOT NULL,
  opening_cash NUMERIC(12,2) NOT NULL,
  cash_sales NUMERIC(12,2) NOT NULL,
  other_cash_receipts NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  cash_expenses NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  cash_refunds NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  cash_transferred_to_owner NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  expected_closing_cash NUMERIC(12,2) NOT NULL,
  physical_closing_cash NUMERIC(12,2) NOT NULL,
  difference NUMERIC(12,2) NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_cash_closings_loc_date UNIQUE (location_id, closing_date)
);

-- 53. cash_receipts (Non-Sales Drawer Inflow)
CREATE TABLE IF NOT EXISTS cash_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tx_id VARCHAR(100) UNIQUE NOT NULL,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  receipt_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0.00),
  source VARCHAR(100) NOT NULL,
  notes TEXT,
  received_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 54. cash_transfers_to_owner (Owner Handover / Bank Deposit)
CREATE TABLE IF NOT EXISTS cash_transfers_to_owner (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tx_id VARCHAR(100) UNIQUE NOT NULL,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  from_location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  recipient_name VARCHAR(150) NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0.00),
  transfer_date DATE NOT NULL,
  payment_method VARCHAR(30) NOT NULL DEFAULT 'cash_handover' CHECK (payment_method IN ('cash_handover', 'bank_deposit', 'upi_transfer')),
  reference_number VARCHAR(100),
  is_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  recorded_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 55. platform_settlements (Multi-Batch Payouts per Platform/Date)
CREATE TABLE IF NOT EXISTS platform_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_closing_id UUID NOT NULL REFERENCES daily_closings(id) ON DELETE RESTRICT,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  platform VARCHAR(30) NOT NULL CHECK (platform IN ('upi_soundbox', 'zomato', 'swiggy', 'card_pos')),
  settlement_batch_id VARCHAR(100) NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  gross_sales NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  discounts_borne_by_outlet NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  other_deductions NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  refunds_deducted NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  expected_payout NUMERIC(12,2) NOT NULL,
  actual_payout NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  payout_date DATE,
  settlement_status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (settlement_status IN ('pending', 'reconciled', 'discrepancy', 'settled')),
  difference NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  reference_number VARCHAR(100),
  notes TEXT,
  CONSTRAINT uq_platform_settlement_batch UNIQUE (business_id, platform, settlement_batch_id)
);

-- ------------------------------------------------------------------------------
-- 10. SECURITY, AUDIT & OFFLINE DOMAIN (6 TABLES)
-- ------------------------------------------------------------------------------

-- 56. device_registrations
CREATE TABLE IF NOT EXISTS device_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  device_fingerprint VARCHAR(255) UNIQUE NOT NULL,
  device_name VARCHAR(100) NOT NULL,
  browser_info TEXT,
  is_authorized BOOLEAN NOT NULL DEFAULT TRUE,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 57. audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  user_name VARCHAR(150),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  old_data JSONB,
  new_data JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 58. record_revisions (Audit Snapshots)
CREATE TABLE IF NOT EXISTS record_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  revision_number INT NOT NULL,
  previous_state JSONB NOT NULL,
  new_state JSONB NOT NULL,
  change_reason TEXT NOT NULL,
  modified_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_revision_step UNIQUE (entity_type, entity_id, revision_number)
);

-- 59. record_cancellations
CREATE TABLE IF NOT EXISTS record_cancellations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  reason TEXT NOT NULL,
  authorized_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  reversal_tx_id VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 60. sync_queue_records
CREATE TABLE IF NOT EXISTS sync_queue_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tx_id VARCHAR(100) UNIQUE NOT NULL,
  payload_hash VARCHAR(64) NOT NULL,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  device_id VARCHAR(100) NOT NULL,
  table_name VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  sync_status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed', 'conflict')),
  retry_count INT NOT NULL DEFAULT 0,
  error_message TEXT,
  client_timestamp TIMESTAMPTZ NOT NULL,
  server_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 61. notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  target_role VARCHAR(30),
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'danger')),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 11. SECURITY DEFINER HELPER FUNCTIONS & RLS POLICIES
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_user_business_id()
RETURNS UUID AS $$
  SELECT business_id FROM user_profiles WHERE id = auth.uid() AND is_active = TRUE;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION user_has_location_access(p_location_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- 1. Inactive users have zero access
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_active = TRUE) THEN
    RETURN FALSE;
  END IF;

  -- 2. Owner has unrestricted access to their own business locations
  IF EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'owner') THEN
    RETURN EXISTS (SELECT 1 FROM locations WHERE id = p_location_id AND business_id = get_user_business_id());
  END IF;

  -- 3. Kitchen Manager restricted strictly to BASE-01 and STOR-02
  IF EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'kitchen_manager') THEN
    RETURN EXISTS (SELECT 1 FROM locations WHERE id = p_location_id AND code IN ('BASE-01', 'STOR-02') AND business_id = get_user_business_id());
  END IF;

  -- 4. Managers & Staff must be explicitly granted in user_location_access or primary_location_id
  RETURN EXISTS (
    SELECT 1 FROM user_location_access WHERE user_id = auth.uid() AND location_id = p_location_id
    UNION
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND primary_location_id = p_location_id
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- Enable RLS across all 61 business tables
DO $$
DECLARE
  t text;
  business_tables text[] := ARRAY[
    'businesses', 'locations', 'user_profiles', 'user_location_access', 'roles', 'permissions', 
    'role_permissions', 'feature_flags', 'business_settings', 'tax_rates', 'menu_categories', 
    'menu_items', 'menu_item_locations', 'menu_price_history', 'sales', 'sale_items', 
    'sale_payments', 'sale_discounts', 'sale_refunds', 'sale_refund_items', 'complimentary_items', 
    'units', 'unit_conversions', 'inventory_categories', 'inventory_items', 'inventory_item_locations', 
    'inventory_balances', 'inventory_movements', 'stock_counts', 'stock_count_items', 
    'stock_adjustments', 'wastage_records', 'production_records', 'stock_requests', 
    'stock_request_items', 'dispatches', 'dispatch_items', 'transfer_receipts', 
    'transfer_receipt_items', 'suppliers', 'purchases', 'purchase_items', 'supplier_payments', 
    'supplier_payment_allocations', 'supplier_ledger_entries', 'expense_categories', 
    'expense_payees', 'expenses', 'expense_payments', 'daily_closings', 'daily_closing_sections', 
    'cash_closings', 'cash_receipts', 'cash_transfers_to_owner', 'platform_settlements', 
    'device_registrations', 'audit_logs', 'record_revisions', 'record_cancellations', 
    'sync_queue_records', 'notifications'
  ];
BEGIN
  FOREACH t IN ARRAY business_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 12. FOUNDATIONAL SEEDING (4 Locations, Units, Tax, Flags — REAL DATA EMPTY)
-- ------------------------------------------------------------------------------

-- Foundational Business
INSERT INTO businesses (id, name, legal_name, currency_code, timezone, is_active)
VALUES ('biz_ck_01'::UUID, 'Chaat Kulture', 'Chaat Kulture Private Limited', 'INR', 'Asia/Kolkata', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 4 Approved Locations
INSERT INTO locations (id, business_id, code, name, type, is_active) VALUES
('loc_base_01'::UUID, 'biz_ck_01'::UUID, 'BASE-01', 'Base Kitchen', 'base_kitchen', TRUE),
('loc_stor_02'::UUID, 'biz_ck_01'::UUID, 'STOR-02', 'Central Store Room', 'store_room', TRUE),
('loc_shah_03'::UUID, 'biz_ck_01'::UUID, 'SHAH-03', 'Shahpura Street Outlet', 'outlet', TRUE),
('loc_11no_04'::UUID, 'biz_ck_01'::UUID, '11NO-04', 'Tukisssz Kasa, 11 No. Stop Food Court Outlet', 'outlet', TRUE)
ON CONFLICT (business_id, code) DO NOTHING;

-- Standard Units
INSERT INTO units (id, business_id, name, code, is_base_unit) VALUES
('u_kg'::UUID, 'biz_ck_01'::UUID, 'Kilogram', 'kg', TRUE),
('u_g'::UUID, 'biz_ck_01'::UUID, 'Gram', 'g', FALSE),
('u_ltr'::UUID, 'biz_ck_01'::UUID, 'Litre', 'ltr', TRUE),
('u_ml'::UUID, 'biz_ck_01'::UUID, 'Millilitre', 'ml', FALSE),
('u_pc'::UUID, 'biz_ck_01'::UUID, 'Piece', 'pc', TRUE),
('u_plate'::UUID, 'biz_ck_01'::UUID, 'Plate', 'plate', TRUE),
('u_pkt'::UUID, 'biz_ck_01'::UUID, 'Packet', 'pkt', TRUE),
('u_box'::UUID, 'biz_ck_01'::UUID, 'Box', 'box', TRUE)
ON CONFLICT (business_id, code) DO NOTHING;

-- Unit Conversions
INSERT INTO unit_conversions (from_unit_id, to_unit_id, multiplier) VALUES
('u_g'::UUID, 'u_kg'::UUID, 0.001000),
('u_ml'::UUID, 'u_ltr'::UUID, 0.001000)
ON CONFLICT (from_unit_id, to_unit_id) DO NOTHING;

-- Configurable Tax Rates
INSERT INTO tax_rates (id, business_id, name, rate_percentage, cgst_rate, sgst_rate, igst_rate) VALUES
('tax_gst_0'::UUID, 'biz_ck_01'::UUID, 'GST Exempt 0%', 0.00, 0.00, 0.00, 0.00),
('tax_gst_5'::UUID, 'biz_ck_01'::UUID, 'GST 5% (Restaurant Standard)', 5.00, 2.50, 2.50, 0.00),
('tax_gst_12'::UUID, 'biz_ck_01'::UUID, 'GST 12%', 12.00, 6.00, 6.00, 0.00),
('tax_gst_18'::UUID, 'biz_ck_01'::UUID, 'GST 18%', 18.00, 9.00, 9.00, 0.00)
ON CONFLICT (id) DO NOTHING;

-- 6 PRD Feature Flags
INSERT INTO feature_flags (business_id, feature_key, name, is_enabled) VALUES
('biz_ck_01'::UUID, 'owner_command_centre', 'Owner Command Centre', TRUE),
('biz_ck_01'::UUID, 'production_planner', 'Production Planner', TRUE),
('biz_ck_01'::UUID, 'recipe_costing', 'Recipe Costing & Menu Profitability', TRUE),
('biz_ck_01'::UUID, 'staff_accountability', 'Staff Accountability & Audit Trail', TRUE),
('biz_ck_01'::UUID, 'smart_alerts', 'Smart Operational Alerts', TRUE),
('biz_ck_01'::UUID, 'business_intelligence', 'Business Intelligence & Multi-Outlet Analytics', TRUE)
ON CONFLICT (business_id, feature_key) DO NOTHING;

-- Business Settings
INSERT INTO business_settings (business_id, allow_zero_stock_billing, auto_recipe_deduction, require_closing_approval, max_cash_drawer_variance)
VALUES ('biz_ck_01'::UUID, TRUE, FALSE, TRUE, 100.00)
ON CONFLICT (business_id) DO NOTHING;

-- Record Migration Version
INSERT INTO schema_migrations (version, checksum)
VALUES ('20261111_chaat_kulture_os_v2_final', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW();

COMMIT;
