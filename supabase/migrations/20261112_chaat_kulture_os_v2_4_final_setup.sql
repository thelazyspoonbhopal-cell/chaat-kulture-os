-- ==============================================================================
-- CHAAT KULTURE OS (v2.4) — COMPLETE SUPABASE SQL UPDATE & INITIALIZATION SCRIPT
-- ==============================================================================
-- Run this complete script in the Supabase SQL Editor:
-- Supabase Dashboard -> Your Project -> SQL Editor -> New Query -> Paste & Click 'Run'
--
-- INCLUDES:
-- 1. Infrastructure, UUID & Crypto Extensions
-- 2. Anti-Public Registration Guard (Enforces Super Admin only user creation)
-- 3. Super Admin User Provisioning (admin@chaatkulture.com / Admin@ChaatKulture2026)
-- 4. Complete Master Schema & Missing Column Migrations (Idempotent)
-- 5. New Security & Authentication Architecture:
--    - user_sessions (Single-device active session enforcement)
--    - login_audit_logs (Mandatory GPS location & device audit trail)
--    - login_approval_requests (Admin location/device exception approvals)
-- 6. Operational Features Schema:
--    - Challans workflow (stock_requests with sent / delivered / received states)
--    - Outlet Expense Ledger with multiple receipt images & handwritten notes
--    - Menu Master GST-inclusive pricing support
--    - Multi-Outlet Staff Assignment & RBAC matrix
-- 7. Row Level Security (RLS) Policies & Outlet Isolation
-- 8. Validated Core Seed Data (4 Approved Outlets, Units, Tax Rates, Flags)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 2. CORE BUSINESS DOMAIN TABLES
-- ------------------------------------------------------------------------------

-- Businesses
CREATE TABLE IF NOT EXISTS public.businesses (
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

-- Locations (4 Approved Physical Units)
CREATE TABLE IF NOT EXISTS public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE RESTRICT,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN ('base_kitchen', 'store_room', 'retail_outlet', 'food_court', 'outlet', 'kiosk')),
  phone VARCHAR(20),
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User Profiles (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE RESTRICT,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE,
  phone VARCHAR(20),
  role VARCHAR(30) NOT NULL CHECK (role IN ('owner', 'manager', 'kitchen_manager', 'outlet_staff')),
  primary_location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  assigned_location_ids JSONB DEFAULT '[]'::jsonb,
  password_hash VARCHAR(255),
  password_salt VARCHAR(255),
  pin_hash VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all new columns exist if table was already created
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS assigned_location_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS password_salt VARCHAR(255);
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS notes TEXT;

-- User Location Access (Join table for multiple outlet permissions)
CREATE TABLE IF NOT EXISTS public.user_location_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  can_manage BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_loc_pair UNIQUE (user_id, location_id)
);

-- Role Permission Matrix
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role VARCHAR(30) NOT NULL,
  permission_key VARCHAR(100) NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_role_perm_pair UNIQUE (role, permission_key)
);

-- Feature Flags
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE RESTRICT,
  feature_key VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Units & Conversions
CREATE TABLE IF NOT EXISTS public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE RESTRICT,
  name VARCHAR(50) NOT NULL,
  code VARCHAR(20) NOT NULL UNIQUE,
  is_base_unit BOOLEAN NOT NULL DEFAULT TRUE,
  conversion_factor NUMERIC(12, 4) DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Menu Categories & Menu Items
CREATE TABLE IF NOT EXISTS public.menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE RESTRICT,
  name VARCHAR(100) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE RESTRICT,
  category_id UUID REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  name VARCHAR(150) NOT NULL,
  code VARCHAR(50),
  description TEXT,
  base_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 5.00,
  is_tax_inclusive BOOLEAN NOT NULL DEFAULT FALSE,
  is_gst_inclusive BOOLEAN NOT NULL DEFAULT FALSE,
  channel_prices JSONB DEFAULT '{}'::jsonb,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS is_gst_inclusive BOOLEAN DEFAULT FALSE;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS is_tax_inclusive BOOLEAN DEFAULT FALSE;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS channel_prices JSONB DEFAULT '{}'::jsonb;

-- Inventory Categories & Inventory Items
CREATE TABLE IF NOT EXISTS public.inventory_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE RESTRICT,
  name VARCHAR(100) NOT NULL,
  category_type VARCHAR(50) NOT NULL DEFAULT 'raw_material',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE RESTRICT,
  category_id UUID REFERENCES public.inventory_categories(id) ON DELETE SET NULL,
  category_type VARCHAR(50) NOT NULL DEFAULT 'raw_material',
  name VARCHAR(150) NOT NULL,
  sku VARCHAR(50),
  primary_unit_id UUID REFERENCES public.units(id) ON DELETE RESTRICT,
  cost_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  minimum_stock_level NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  current_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
  reserved_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
  last_counted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_loc_item_balance UNIQUE (location_id, inventory_item_id)
);

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tx_id VARCHAR(100),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  movement_type VARCHAR(50) NOT NULL,
  quantity NUMERIC(12, 3) NOT NULL,
  previous_quantity NUMERIC(12, 3) NOT NULL,
  new_quantity NUMERIC(12, 3) NOT NULL,
  reference_type VARCHAR(50),
  reference_id VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Suppliers & Purchases
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE RESTRICT,
  name VARCHAR(150) NOT NULL,
  contact_person VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(100),
  gstin VARCHAR(50),
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tx_id VARCHAR(100),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  receiving_location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  invoice_number VARCHAR(100),
  invoice_date DATE NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  payment_status VARCHAR(30) NOT NULL DEFAULT 'unpaid',
  bill_image_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Expense Categories & Expenses (With Multiple Bill Images & Handwritten Notes)
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE RESTRICT,
  name VARCHAR(100) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tx_id VARCHAR(100),
  business_id UUID REFERENCES public.businesses(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL,
  expense_date DATE NOT NULL,
  paid_to VARCHAR(150),
  paid_by VARCHAR(150),
  payment_method VARCHAR(50) DEFAULT 'cash',
  receipt_images JSONB DEFAULT '[]'::jsonb,
  is_handwritten BOOLEAN DEFAULT FALSE,
  created_by_role VARCHAR(30) DEFAULT 'outlet_staff',
  notes TEXT,
  description TEXT,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS receipt_images JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS is_handwritten BOOLEAN DEFAULT FALSE;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS created_by_role VARCHAR(30) DEFAULT 'outlet_staff';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS description TEXT;

-- Stock Requests & Inter-Outlet Challans (With Sent / Delivered / Received Workflow)
CREATE TABLE IF NOT EXISTS public.stock_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tx_id VARCHAR(100),
  business_id UUID REFERENCES public.businesses(id) ON DELETE RESTRICT,
  request_number VARCHAR(100) NOT NULL,
  from_location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  to_location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  request_type VARCHAR(50) DEFAULT 'next_day',
  required_date DATE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  rejection_reason TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  dispatched_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  dispatched_at TIMESTAMPTZ,
  received_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.stock_requests ADD COLUMN IF NOT EXISTS dispatched_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public.stock_requests ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;
ALTER TABLE public.stock_requests ADD COLUMN IF NOT EXISTS received_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public.stock_requests ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.stock_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_request_id UUID NOT NULL REFERENCES public.stock_requests(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  requested_quantity NUMERIC(12, 3) NOT NULL,
  approved_quantity NUMERIC(12, 3) DEFAULT 0.000,
  dispatched_quantity NUMERIC(12, 3) DEFAULT 0.000,
  received_quantity NUMERIC(12, 3) DEFAULT 0.000,
  unit VARCHAR(20) NOT NULL,
  notes TEXT
);

-- Dispatches & Production Records
CREATE TABLE IF NOT EXISTS public.dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tx_id VARCHAR(100),
  challan_number VARCHAR(100) NOT NULL,
  stock_request_id UUID REFERENCES public.stock_requests(id) ON DELETE SET NULL,
  from_location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  to_location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  status VARCHAR(30) NOT NULL DEFAULT 'raised',
  dispatch_date DATE NOT NULL,
  received_date DATE,
  dispatched_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  received_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.production_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tx_id VARCHAR(100),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  batch_number VARCHAR(100) NOT NULL,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  quantity_produced NUMERIC(12, 3) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  production_date DATE NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Wastage Records
CREATE TABLE IF NOT EXISTS public.wastage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tx_id VARCHAR(100),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  quantity NUMERIC(12, 3) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  reason VARCHAR(50) NOT NULL,
  photo_url TEXT,
  status VARCHAR(30) DEFAULT 'pending',
  approved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Daily Closings & Cash Management
CREATE TABLE IF NOT EXISTS public.daily_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  closing_date DATE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'in_progress',
  completed_sections_count INT DEFAULT 0,
  notes TEXT,
  submitted_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_location_closing_date UNIQUE (location_id, closing_date)
);

CREATE TABLE IF NOT EXISTS public.cash_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  closing_date DATE NOT NULL,
  opening_cash NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  cash_sales NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  cash_expenses NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  expected_closing_cash NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  physical_closing_cash NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  difference NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cash_transfers_to_owner (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE RESTRICT,
  from_location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  recipient_name VARCHAR(150) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  transfer_date DATE NOT NULL,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'cash_handover',
  reference_number VARCHAR(100),
  is_confirmed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sales POS & Items
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tx_id VARCHAR(100),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  order_number VARCHAR(100) NOT NULL,
  channel VARCHAR(30) NOT NULL DEFAULT 'walk_in',
  subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  payment_status VARCHAR(30) NOT NULL DEFAULT 'paid',
  payment_method VARCHAR(50) DEFAULT 'cash',
  cashier_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. NEW SECURITY, AUTHENTICATION & SINGLE-DEVICE ENFORCEMENT ARCHITECTURE
-- ------------------------------------------------------------------------------

-- 1. user_sessions: Enforces Single-Device Login Policy
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id VARCHAR(150) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  user_email VARCHAR(150) NOT NULL,
  user_name VARCHAR(150),
  role VARCHAR(30) NOT NULL,
  device_id VARCHAR(100) NOT NULL,
  device_name VARCHAR(255) NOT NULL,
  ip_address VARCHAR(50),
  latitude NUMERIC(10, 6),
  longitude NUMERIC(10, 6),
  location_accuracy NUMERIC(10, 2),
  location_address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revocation_reason VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON public.user_sessions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_device ON public.user_sessions(device_id);

-- 2. login_audit_logs: Mandatory GPS & Device Stealth Audit Log
CREATE TABLE IF NOT EXISTS public.login_audit_logs (
  id VARCHAR(150) PRIMARY KEY DEFAULT ('aud_' || gen_random_uuid()::text),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  email VARCHAR(150) NOT NULL,
  full_name VARCHAR(150),
  role VARCHAR(30),
  status VARCHAR(60) NOT NULL, -- SUCCESS, FAILED_CREDENTIALS, BLOCKED_LOCATION_DENIED, CONCURRENT_SESSION_TERMINATED, LOGOUT, APPROVED_BY_ADMIN, REJECTED_BY_ADMIN
  device_id VARCHAR(100) NOT NULL,
  device_name VARCHAR(255) NOT NULL,
  user_agent TEXT,
  ip_address VARCHAR(50),
  latitude NUMERIC(10, 6),
  longitude NUMERIC(10, 6),
  location_accuracy NUMERIC(10, 2),
  location_address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_audit_email ON public.login_audit_logs(email);
CREATE INDEX IF NOT EXISTS idx_login_audit_created ON public.login_audit_logs(created_at DESC);

-- 3. login_approval_requests: Admin Exception Approval Queue
CREATE TABLE IF NOT EXISTS public.login_approval_requests (
  id VARCHAR(150) PRIMARY KEY DEFAULT ('req_' || gen_random_uuid()::text),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  email VARCHAR(150) NOT NULL,
  full_name VARCHAR(150),
  role VARCHAR(30),
  device_id VARCHAR(100) NOT NULL,
  device_name VARCHAR(255) NOT NULL,
  latitude NUMERIC(10, 6),
  longitude NUMERIC(10, 6),
  location_address TEXT,
  reason TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  bypass_token VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  admin_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_approval_status ON public.login_approval_requests(status);

-- ------------------------------------------------------------------------------
-- 4. SUPER ADMIN USER PROVISIONING (admin@chaatkulture.com)
-- ------------------------------------------------------------------------------
-- Temporarily drop the guard trigger if it was previously created
DROP TRIGGER IF EXISTS trg_prevent_public_signup ON auth.users;

DO $$
DECLARE
  v_biz_id UUID;
  v_user_id UUID;
  v_encrypted_pass TEXT;
BEGIN
  -- 1. Ensure Root Business exists
  SELECT id INTO v_biz_id FROM public.businesses WHERE name = 'Chaat Kulture' LIMIT 1;
  IF v_biz_id IS NULL THEN
    INSERT INTO public.businesses (name, legal_name, currency_code, timezone, is_active)
    VALUES ('Chaat Kulture', 'Chaat Kulture Private Limited', 'INR', 'Asia/Kolkata', TRUE)
    RETURNING id INTO v_biz_id;
  END IF;

  -- 2. Encrypt default password (Admin@ChaatKulture2026) using bcrypt
  v_encrypted_pass := crypt('Admin@ChaatKulture2026', gen_salt('bf'));

  -- 3. Check or Create Super Admin in auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@chaatkulture.com' LIMIT 1;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      'admin@chaatkulture.com',
      v_encrypted_pass,
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Aditya Sharma","role":"owner"}'::jsonb,
      NOW(),
      NOW()
    );
  ELSE
    -- Update existing user's password and confirmation
    UPDATE auth.users
    SET 
      encrypted_password = v_encrypted_pass,
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      raw_user_meta_data = '{"full_name":"Aditya Sharma","role":"owner"}'::jsonb,
      updated_at = NOW()
    WHERE id = v_user_id;
  END IF;

  -- 4. Create or Update public.user_profiles
  INSERT INTO public.user_profiles (
    id,
    business_id,
    full_name,
    email,
    role,
    password_salt,
    password_hash,
    is_active,
    notes
  ) VALUES (
    v_user_id,
    v_biz_id,
    'Aditya Sharma',
    'admin@chaatkulture.com',
    'owner',
    'ck_salt_admin_01',
    '090c6b58ae017ee3d9b6caf4c8bf7bd113d6786f49a79bb84aa0b7f4e300e3d2',
    TRUE,
    'Super Admin with unrestricted global access to all physical units and financial records.'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = 'admin@chaatkulture.com',
    role = 'owner',
    password_salt = 'ck_salt_admin_01',
    password_hash = '090c6b58ae017ee3d9b6caf4c8bf7bd113d6786f49a79bb84aa0b7f4e300e3d2',
    is_active = TRUE,
    updated_at = NOW();

END $$;

-- ------------------------------------------------------------------------------
-- 5. ANTI-PUBLIC SIGNUP SECURITY GUARD
-- ------------------------------------------------------------------------------
-- Ensures nobody can call supabase.auth.signUp() directly from public client apps.
CREATE OR REPLACE FUNCTION public.guard_prevent_public_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Block if initiated from the public anon client API
  IF (current_setting('request.jwt.claim.role', true) = 'anon') THEN
    RAISE EXCEPTION 'Public user registration is disabled for Chaat Kulture OS. User accounts must be created by the Super Admin.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_public_signup ON auth.users;
CREATE TRIGGER trg_prevent_public_signup
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.guard_prevent_public_signup();

-- ------------------------------------------------------------------------------
-- 6. FOUNDATIONAL SEEDING (4 Approved Physical Locations & Setup)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_biz_id UUID;
BEGIN
  SELECT id INTO v_biz_id FROM public.businesses WHERE name = 'Chaat Kulture' LIMIT 1;

  -- 4 Physical Outlets
  INSERT INTO public.locations (business_id, code, name, type, phone, address, is_active) VALUES
    (v_biz_id, 'BASE-01', 'Base Kitchen', 'base_kitchen', '+91 98260 00001', 'Industrial Area, Govindpura, Bhopal', TRUE),
    (v_biz_id, 'STOR-02', 'Central Store Room', 'store_room', '+91 98260 00002', 'Central Storage & Logistics Hub, Bhopal', TRUE),
    (v_biz_id, 'SHAH-03', 'Shahpura Street Outlet', 'retail_outlet', '+91 98260 00003', 'Shahpura Lake Promenade, Bhopal', TRUE),
    (v_biz_id, '11NO-04', 'Tukisssz Kasa, 11 No. Stop Food Court Outlet', 'food_court', '+91 98260 00004', 'Food Court Zone, 11 No. Bus Stop, Bhopal', TRUE)
  ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    is_active = TRUE,
    updated_at = NOW();

  -- Standard Units
  INSERT INTO public.units (business_id, name, code, is_base_unit, conversion_factor) VALUES
    (v_biz_id, 'Kilogram', 'kg', TRUE, 1.0),
    (v_biz_id, 'Gram', 'g', FALSE, 0.001),
    (v_biz_id, 'Litre', 'ltr', TRUE, 1.0),
    (v_biz_id, 'Millilitre', 'ml', FALSE, 0.001),
    (v_biz_id, 'Piece', 'pc', TRUE, 1.0),
    (v_biz_id, 'Plate', 'plate', TRUE, 1.0),
    (v_biz_id, 'Packet', 'pkt', TRUE, 1.0),
    (v_biz_id, 'Box', 'box', TRUE, 1.0)
  ON CONFLICT (code) DO NOTHING;

  -- 6 Feature Flags
  INSERT INTO public.feature_flags (business_id, feature_key, name, is_enabled) VALUES
    (v_biz_id, 'owner_command_centre', 'Owner Command Centre', TRUE),
    (v_biz_id, 'production_planner', 'Production Planner', TRUE),
    (v_biz_id, 'recipe_costing', 'Recipe Costing & Menu Profitability', TRUE),
    (v_biz_id, 'staff_accountability', 'Staff Accountability & Audit Trail', TRUE),
    (v_biz_id, 'smart_alerts', 'Smart Operational Alerts', TRUE),
    (v_biz_id, 'business_intelligence', 'Business Intelligence & Multi-Outlet Analytics', TRUE)
  ON CONFLICT (feature_key) DO UPDATE SET is_enabled = EXCLUDED.is_enabled;

  -- Core Expense Categories
  INSERT INTO public.expense_categories (business_id, name, is_active) VALUES
    (v_biz_id, 'Raw Materials & Emergency Market Purchase', TRUE),
    (v_biz_id, 'Daily Dairy & Perishables', TRUE),
    (v_biz_id, 'LPG & Fuel Utilities', TRUE),
    (v_biz_id, 'Packaging & Disposables', TRUE),
    (v_biz_id, 'Outlet Maintenance & Repairs', TRUE),
    (v_biz_id, 'Staff Welfare & Food', TRUE),
    (v_biz_id, 'Local Transport & Courier', TRUE),
    (v_biz_id, 'Miscellaneous & Cash Expense', TRUE)
  ON CONFLICT DO NOTHING;

END $$;

-- ------------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
-- Enable RLS across all operational tables
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_location_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wastage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_approval_requests ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Master Permissive Policy for Authenticated Staff & Super Admin
-- 1. Read Policy for Master Data (Everyone can view catalog, locations, units)
DROP POLICY IF EXISTS "Authenticated users can read locations" ON public.locations;
CREATE POLICY "Authenticated users can read locations" ON public.locations FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Authenticated users can read menu" ON public.menu_items;
CREATE POLICY "Authenticated users can read menu" ON public.menu_items FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Authenticated users can read menu categories" ON public.menu_categories;
CREATE POLICY "Authenticated users can read menu categories" ON public.menu_categories FOR SELECT TO authenticated USING (TRUE);

-- 2. User Profiles Policy: Super Admin full access, users can view all colleagues & edit own
DROP POLICY IF EXISTS "User profiles access policy" ON public.user_profiles;
CREATE POLICY "User profiles access policy" ON public.user_profiles FOR ALL TO authenticated
USING (
  public.current_user_role() = 'owner'
  OR id = auth.uid()
  OR role IN ('manager', 'kitchen_manager', 'outlet_staff')
)
WITH CHECK (
  public.current_user_role() = 'owner'
  OR id = auth.uid()
);

-- 3. Expenses Policy: Outlet Staff see their outlet expenses, Super Admin/Manager see all
DROP POLICY IF EXISTS "Expenses access policy" ON public.expenses;
CREATE POLICY "Expenses access policy" ON public.expenses FOR ALL TO authenticated
USING (
  public.current_user_role() IN ('owner', 'manager')
  OR created_by = auth.uid()
  OR location_id IN (
    SELECT location_id FROM public.user_location_access WHERE user_id = auth.uid()
    UNION
    SELECT primary_location_id FROM public.user_profiles WHERE id = auth.uid()
  )
)
WITH CHECK (
  public.current_user_role() IN ('owner', 'manager')
  OR location_id IN (
    SELECT location_id FROM public.user_location_access WHERE user_id = auth.uid()
    UNION
    SELECT primary_location_id FROM public.user_profiles WHERE id = auth.uid()
  )
);

-- 4. Challans (stock_requests): Everyone can create and view, only Super Admin can delete
DROP POLICY IF EXISTS "Stock requests view/create" ON public.stock_requests;
CREATE POLICY "Stock requests view/create" ON public.stock_requests FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Stock requests insert" ON public.stock_requests;
CREATE POLICY "Stock requests insert" ON public.stock_requests FOR INSERT TO authenticated WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Stock requests update" ON public.stock_requests;
CREATE POLICY "Stock requests update" ON public.stock_requests FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Stock requests delete by super admin only" ON public.stock_requests;
CREATE POLICY "Stock requests delete by super admin only" ON public.stock_requests FOR DELETE TO authenticated
USING (public.current_user_role() = 'owner');

-- 5. Sessions & Audit Logs: Users can manage their own session; Super Admin can audit all
DROP POLICY IF EXISTS "User sessions access policy" ON public.user_sessions;
CREATE POLICY "User sessions access policy" ON public.user_sessions FOR ALL TO authenticated
USING (public.current_user_role() = 'owner' OR user_id = auth.uid())
WITH CHECK (public.current_user_role() = 'owner' OR user_id = auth.uid());

DROP POLICY IF EXISTS "Audit logs insert by all, view by super admin" ON public.login_audit_logs;
CREATE POLICY "Audit logs insert by all, view by super admin" ON public.login_audit_logs FOR INSERT TO authenticated WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Audit logs view by super admin" ON public.login_audit_logs;
CREATE POLICY "Audit logs view by super admin" ON public.login_audit_logs FOR SELECT TO authenticated
USING (public.current_user_role() = 'owner');

DROP POLICY IF EXISTS "Approval requests insert by all, view/review by super admin" ON public.login_approval_requests;
CREATE POLICY "Approval requests insert by all, view/review by super admin" ON public.login_approval_requests FOR ALL TO authenticated
USING (public.current_user_role() = 'owner' OR user_id = auth.uid())
WITH CHECK (public.current_user_role() = 'owner' OR user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- VERIFICATION CONFIRMATION
-- ------------------------------------------------------------------------------
SELECT 
  'Chaat Kulture OS v2.4 Supabase Schema Configured Successfully!' AS status,
  NOW() AS executed_at,
  (SELECT COUNT(*) FROM public.locations) AS approved_locations,
  (SELECT COUNT(*) FROM public.user_profiles WHERE email = 'admin@chaatkulture.com') AS super_admin_created;
