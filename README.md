# CHAAT KULTURE OS (v2.4 Final Implementation-Ready)
> **Professional Multi-Location Food Operations Management Platform**  
> **Initial Physical Locations:**  
> 1. `BASE-01` — Base Kitchen (Bulk batch preparation)  
> 2. `STOR-02` — Central Store Room (Vendor invoice receipt & inventory warehousing)  
> 3. `SHAH-03` — Shahpura Street Outlet (Retail counter & indents)  
> 4. `11NO-04` — Tukisssz Kasa, 11 No. Stop Food Court Outlet (Food court counter & indents)  
>  
> **Development Strategy:** Local-First PWA (IndexedDB / Dexie.js) → Ready for Cloud Sync (Supabase PostgreSQL / RLS) & Vercel Deployment

---

## 1. Quick Start (Zero-Setup Local Run)

### Non-Technical Windows Shortcut:
Simply double-click:
```cmd
start-dev.bat
```

### Manual Command Line:
```bash
npm run dev
```
Open **`http://localhost:5173`** in Chrome, Edge, Safari, or mobile browser.

To build for production verification:
```bash
npm run build
```

---

## 2. Core Non-Negotiable Business Rules Enforced in System

1. **Physical vs Analytical Independence:**
   - Base Kitchen (`BASE-01`) and Central Store Room (`STOR-02`) are strictly separate physical locations with separate stock balances.
   - Stock never moves between locations without a formal physical transfer event (Dispatch & Transfer Receipt).
2. **Zero Recipe Stock Deductions:**
   - Point-of-Sale (POS) dish billing **never** auto-deducts raw material stock.
   - Recipe Costing is strictly analytical for margins and menu engineering.
   - Physical stock decreases **only** via confirmed physical events: dispatches, verified kitchen consumption batches, approved wastage/damage, and physical recounts.
3. **Empty Master Data at Start:**
   - Production business data starts 100% clean: 0 menu items, 0 inventory items, 0 suppliers, 0 employees, 0 opening stock.
   - Only system seed metadata exists (the business entity, the 4 locations, units, 7 standard expense categories, and 6 feature flags).
4. **Credit Expense Accounting (PRD Section 13):**
   - Credit expenses are recognized immediately when incurred, increasing Accounts Payable.
   - Subsequent settlement payments reduce the payable liability without duplicating the expense.
5. **Strict Cash Separation for Owner Transferred Cash:**
   - Cash transferred to the Owner is classified as an Equity Withdrawal / Capital Drawdown.
   - Excluded from operational expenses and cost of goods sold.
6. **12-Section Daily Closing with Authoritative Cash Drawer Formula:**
   - Enforces Asia/Kolkata date boundaries (04:00 AM cutoff).
   - Expected Cash = `Opening Float + Net Cash Sales + Cash Receipts - Cash Expenses Paid - Cash Supplier Payments - Cash Transferred to Owner`.
7. **Idempotency & Tamper-Proof Stock Ledgers:**
   - Every transaction accepts a `client_tx_id` and SHA-256 payload hash.
   - Stock movements are append-only. Corrections require explicit authorized reversal movements.

---

## 3. Dynamic Role-Based Access Control (RBAC) for Super Admin

Chaat Kulture OS features a complete **Super Admin RBAC Matrix Engine** located in **Admin Master Data Hub &rarr; Role Permissions (RBAC)**:

- **Super Admin (`owner`) Root Authority:** Has immutable root access across all 4 locations, master settings, financial P&L, closing reopens, and user permissions. Super Admin permissions cannot be revoked to prevent lockout.
- **Configurable Roles:**
  - `manager` (General / Outlet Manager)
  - `kitchen_manager` (Base Kitchen Head Chef)
  - `outlet_staff` (Counter Cashier / Service Staff)
- **Granular Feature Capabilities (15 Configurable Permissions):**
  - **Operations:** `view_dashboard`, `manage_pos`, `manage_kitchen`, `manage_transfers`, `manage_wastage`
  - **Inventory:** `view_inventory`, `adjust_inventory`
  - **Finance:** `manage_purchases`, `manage_expenses`, `manage_closing`, `reopen_closing`, `view_reports`
  - **Administration:** `manage_master_data`, `manage_rbac` (Super Admin exclusive), `access_sandbox`
- **Instant Live Enforcement:** When a Super Admin grants or revokes an access capability, the navigation sidebar updates in real time and route-level protection blocks unauthorized access.
- **Audit Logging:** Every permission alteration by Super Admin is recorded with timestamps and reason trails in `audit_logs`.

---

## 4. Database Schema Overview (61 Business Tables + 1 Migration History Table)

The complete SQL migration script is located at:
[`supabase/migrations/20261111_chaat_kulture_os_v2_final.sql`](file:///d:/chaat%20kulture/supabase/migrations/20261111_chaat_kulture_os_v2_final.sql)

### Module Breakdown:
1. **Organization (7 tables):** `businesses`, `locations`, `user_profiles`, `user_location_access`, `roles`, `permissions`, `role_permissions`, `business_settings`, `feature_flags`.
2. **Taxes & Configuration (1 table):** `tax_rates` (custom rates with frozen sales snapshots).
3. **Menu Domain (4 tables):** `menu_categories`, `menu_items`, `menu_item_locations`, `menu_price_history`.
4. **Sales & POS (6 tables):** `sales`, `sale_items`, `sale_payments`, `sale_discounts`, `sale_refunds`, `complimentary_items`.
5. **Inventory Core (7 tables):** `units`, `unit_conversions`, `inventory_categories`, `inventory_items`, `inventory_item_locations`, `inventory_balances`, `inventory_movements`.
6. **Stock Auditing & Wastage (4 tables):** `stock_counts`, `stock_count_items`, `stock_adjustments`, `wastage_records`.
7. **Production & Kitchen (3 tables):** `recipe_masters`, `recipe_ingredients`, `production_records`.
8. **Transfers & Logistics (4 tables):** `stock_requests`, `stock_request_items`, `dispatches`, `dispatch_items`, `transfer_receipts`, `transfer_receipt_items`.
9. **Purchasing & Supplier Ledger (6 tables):** `suppliers`, `purchases`, `purchase_items`, `supplier_payments`, `supplier_payment_allocations`, `supplier_ledger_entries`.
10. **Expenses & Payables (3 tables):** `expense_categories`, `expenses`, `expense_payments`.
11. **Cash & Daily Closings (8 tables):** `daily_closings`, `cash_closings`, `cash_receipts`, `payment_reconciliations`, `platform_settlements`, `cash_transfers_to_owner`, `daily_closing_snapshots`, `daily_closing_revisions`.
12. **Audit & Sync Infrastructure (4 tables):** `audit_logs`, `client_sync_queue`, `device_registrations`, `schema_migrations`.

---

## 4. Testing Sandbox (Safe Demo Data Engine)

Located in the bottom-left sidebar: **"Testing Sandbox"**
- **Load Demo Data:** Populates realistic Chaat Kulture master data, suppliers, recipes, and transactions tagged with `is_demo: true`.
- **Safe Purge Test Data:** Deletes *only* `is_demo: true` records using Dexie atomic transaction rollback protection. Real business records are completely untouched.
- **In-App Verification Checklist:** Navigate to **"Phase 1 Verification"** tab to run all 20+ automated business checks inside the browser.

---

## 5. Deployment Instructions

### A. Supabase PostgreSQL Deployment (When Ready)
1. Log into your Supabase Dashboard: [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Open your project and click on the **SQL Editor** tab.
3. Open `supabase/migrations/20261111_chaat_kulture_os_v2_final.sql`.
4. Copy the entire file content, paste it into the Supabase SQL Editor, and click **Run**.
5. The 61 tables, triggers, atomic functions, and Row-Level Security policies will be installed atomically.

### B. Vercel Web Deployment
1. Push your repository to GitHub / GitLab.
2. In Vercel, click **"Add New Project"** and select the repository.
3. Build Settings:
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Set Environment Variables:
   - `VITE_SUPABASE_URL`: Your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase Public Anon Key
   - *(Never put service_role keys in Vercel)*
5. Click **Deploy**.
