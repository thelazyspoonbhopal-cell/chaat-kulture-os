import { db } from '../db';
import type {
  MenuCategory,
  MenuItem,
  InventoryCategory,
  InventoryItem,
  Supplier,
  Purchase,
  SupplierPayment,
  Sale,
  StockRequest,
  ProductionRecord,
  Dispatch,
  WastageRecord,
  DailyClosing,
  CashClosing,
  CashTransferToOwner,
  StockCount,
  Expense,
  InventoryBalance,
  InventoryMovement,
} from '../../types';

export const sandboxRepo = {
  // Check counts of demo vs real records
  async getStats() {
    const [
      demoMenu, realMenu,
      demoInv, realInv,
      demoSuppliers, realSuppliers,
      demoSales, demoPurchases,
      demoExpenses, demoProduction,
      demoRequests, demoDispatches,
      demoWastage, demoClosings
    ] = await Promise.all([
      db.menu_items.filter(i => !!i.is_demo).count(),
      db.menu_items.filter(i => !i.is_demo).count(),
      db.inventory_items.filter(i => !!i.is_demo).count(),
      db.inventory_items.filter(i => !i.is_demo).count(),
      db.suppliers.filter(s => !!s.is_demo).count(),
      db.suppliers.filter(s => !s.is_demo).count(),
      db.sales.filter(s => !!s.is_demo).count(),
      db.purchases.filter(p => !!p.is_demo).count(),
      db.expenses.filter(e => !!e.is_demo).count(),
      db.production_records.filter(pr => !!pr.is_demo).count(),
      db.stock_requests.filter(sr => !!sr.is_demo).count(),
      db.dispatches.filter(d => !!d.is_demo).count(),
      db.wastage_records.filter(w => !!w.is_demo).count(),
      db.daily_closings.filter(c => !!c.is_demo).count(),
    ]);

    return {
      demoMenu,
      realMenu,
      demoInv,
      realInv,
      demoSuppliers,
      realSuppliers,
      demoSales,
      demoPurchases,
      demoExpenses,
      demoProduction,
      demoRequests,
      demoDispatches,
      demoWastage,
      demoClosings,
      hasDemoData: demoMenu > 0 || demoInv > 0 || demoSuppliers > 0 || demoSales > 0 || demoPurchases > 0 || demoProduction > 0,
    };
  },

  // Load comprehensive multi-case demo data across all roles and workflows
  async loadDemoData() {
    const now = new Date().toISOString();
    const todayDate = now.split('T')[0];
    const yesterdayDate = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const twoDaysAgoDate = new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0];
    const businessId = 'biz_chaatkulture_01';

    // ---------------- 1. MENU CATEGORIES & MASTER (7 ITEMS) ----------------
    const catChaat: MenuCategory = { id: 'demo_cat_chaat', business_id: businessId, name: 'Signature Chaats', sort_order: 1, is_active: true, is_demo: true, created_at: now };
    const catHot: MenuCategory = { id: 'demo_cat_hot', business_id: businessId, name: 'Hot Kitchen Specials', sort_order: 2, is_active: true, is_demo: true, created_at: now };
    const catCoolers: MenuCategory = { id: 'demo_cat_coolers', business_id: businessId, name: 'Coolers & Desserts', sort_order: 3, is_active: true, is_demo: true, created_at: now };
    await db.menu_categories.bulkPut([catChaat, catHot, catCoolers]);

    const demoMenuItems: MenuItem[] = [
      { id: 'demo_menu_pb', business_id: businessId, category_id: 'demo_cat_hot', name: 'Pav Bhaji (Amul Butter)', code: 'PB-01', description: 'Special spiced vegetable mash cooked in rich Amul butter, served with 2 hot butter pavs', base_price: 99.00, tax_rate: 5.00, channel_prices: { walk_in: 99.00, zomato: 119.00, swiggy: 119.00 }, is_available: true, sort_order: 1, is_demo: true, created_at: now, updated_at: now },
      { id: 'demo_menu_cb', business_id: businessId, category_id: 'demo_cat_hot', name: 'Chole Bhature (2 Pcs)', code: 'CB-02', description: 'Pindi style slow-cooked rich chole with 2 fluffy bhaturas, pickled onion and mint chutney', base_price: 120.00, tax_rate: 5.00, channel_prices: { walk_in: 120.00, zomato: 139.00, swiggy: 139.00 }, is_available: true, sort_order: 2, is_demo: true, created_at: now, updated_at: now },
      { id: 'demo_menu_sp', business_id: businessId, category_id: 'demo_cat_chaat', name: 'Sev Puri Mumbai Style', code: 'SP-03', description: '6 flat crispy papdis loaded with diced potatoes, onions, trio of chutneys and nylon sev', base_price: 60.00, tax_rate: 5.00, channel_prices: { walk_in: 60.00, zomato: 75.00, swiggy: 75.00 }, is_available: true, sort_order: 3, is_demo: true, created_at: now, updated_at: now },
      { id: 'demo_menu_dp', business_id: businessId, category_id: 'demo_cat_chaat', name: 'Dahi Papdi Chaat', code: 'DP-04', description: 'Crisp papdi with potato-sprout filling, chilled sweetened curd, saunth and fresh pomegranate', base_price: 85.00, tax_rate: 5.00, channel_prices: { walk_in: 85.00, zomato: 99.00, swiggy: 99.00 }, is_available: true, sort_order: 4, is_demo: true, created_at: now, updated_at: now },
      { id: 'demo_menu_pp', business_id: businessId, category_id: 'demo_cat_chaat', name: 'Special Pani Puri (6 Pcs)', code: 'PP-05', description: '6 crispy puris with spiced potato-ragda mix and chilled hing-jeera & khatta-meetha water', base_price: 50.00, tax_rate: 5.00, channel_prices: { walk_in: 50.00, zomato: 65.00, swiggy: 65.00 }, is_available: true, sort_order: 5, is_demo: true, created_at: now, updated_at: now },
      { id: 'demo_menu_at', business_id: businessId, category_id: 'demo_cat_hot', name: 'Kurkure Aloo Tikki Chaat', code: 'AT-06', description: 'Double-crisped potato patty served on spiced chole ragda with green & sweet tamarind chutneys', base_price: 90.00, tax_rate: 5.00, channel_prices: { walk_in: 90.00, zomato: 105.00, swiggy: 105.00 }, is_available: true, sort_order: 6, is_demo: true, created_at: now, updated_at: now },
      { id: 'demo_menu_chaas', business_id: businessId, category_id: 'demo_cat_coolers', name: 'Special Masala Chaas (Kulhad)', code: 'CH-07', description: 'Traditional earthen kulhad, churned spiced buttermilk with roasted cumin, mint & black salt', base_price: 40.00, tax_rate: 5.00, channel_prices: { walk_in: 40.00, zomato: 50.00, swiggy: 50.00 }, is_available: true, sort_order: 7, is_demo: true, created_at: now, updated_at: now }
    ];
    await db.menu_items.bulkPut(demoMenuItems);

    // ---------------- 2. INVENTORY MASTER (12 SKUs: RAW, PREP & PACKAGING) ----------------
    const invCatRaw: InventoryCategory = { id: 'demo_invcat_raw', business_id: businessId, name: 'Raw Ingredients & Grains', category_type: 'raw_material', is_demo: true, created_at: now };
    const invCatPrep: InventoryCategory = { id: 'demo_invcat_prep', business_id: businessId, name: 'Base Kitchen Semi-Prepared Batches', category_type: 'prepared_food', is_demo: true, created_at: now };
    const invCatPack: InventoryCategory = { id: 'demo_invcat_pack', business_id: businessId, name: 'Eco Packaging & Kulhads', category_type: 'packaging', is_demo: true, created_at: now };
    await db.inventory_categories.bulkPut([invCatRaw, invCatPrep, invCatPack]);

    const demoInventoryItems: InventoryItem[] = [
      // Raw Materials
      { id: 'demo_inv_butter', business_id: businessId, category_id: 'demo_invcat_raw', name: 'Amul Butter (Table Blocks)', code: 'RAW-BUT-01', category_type: 'raw_material', base_unit: 'kg', min_stock_alert: 20, cost_per_unit: 480.00, is_active: true, is_demo: true, created_at: now },
      { id: 'demo_inv_potatoes', business_id: businessId, category_id: 'demo_invcat_raw', name: 'Potatoes (A-Grade Agra)', code: 'RAW-POT-02', category_type: 'raw_material', base_unit: 'kg', min_stock_alert: 50, cost_per_unit: 25.00, is_active: true, is_demo: true, created_at: now },
      { id: 'demo_inv_chana', business_id: businessId, category_id: 'demo_invcat_raw', name: 'Kabuli Chana (Grade-A White)', code: 'RAW-CHN-03', category_type: 'raw_material', base_unit: 'kg', min_stock_alert: 30, cost_per_unit: 95.00, is_active: true, is_demo: true, created_at: now },
      { id: 'demo_inv_oil', business_id: businessId, category_id: 'demo_invcat_raw', name: 'Refined Sunflower Cooking Oil', code: 'RAW-OIL-04', category_type: 'raw_material', base_unit: 'ltr', min_stock_alert: 25, cost_per_unit: 135.00, is_active: true, is_demo: true, created_at: now },
      { id: 'demo_inv_curd', business_id: businessId, category_id: 'demo_invcat_raw', name: 'Fresh Milk & Set Curd (Dahi)', code: 'RAW-CRD-05', category_type: 'raw_material', base_unit: 'kg', min_stock_alert: 15, cost_per_unit: 60.00, is_active: true, is_demo: true, created_at: now },

      // Prepared Food Batches (Cooked at BASE-01)
      { id: 'demo_inv_bhaji_prep', business_id: businessId, category_id: 'demo_invcat_prep', name: 'Cooked Bhaji (Base Kitchen)', code: 'PRP-BHJ-01', category_type: 'prepared_food', base_unit: 'kg', min_stock_alert: 15, cost_per_unit: 110.00, is_active: true, is_demo: true, created_at: now },
      { id: 'demo_inv_chole_prep', business_id: businessId, category_id: 'demo_invcat_prep', name: 'Prepared Pindi Chole Gravy', code: 'PRP-CHL-02', category_type: 'prepared_food', base_unit: 'kg', min_stock_alert: 15, cost_per_unit: 120.00, is_active: true, is_demo: true, created_at: now },
      { id: 'demo_inv_papdi_prep', business_id: businessId, category_id: 'demo_invcat_prep', name: 'Crispy Papdi (Fried Flat)', code: 'PRP-PAP-03', category_type: 'prepared_food', base_unit: 'kg', min_stock_alert: 10, cost_per_unit: 95.00, is_active: true, is_demo: true, created_at: now },
      { id: 'demo_inv_tikki_mix', business_id: businessId, category_id: 'demo_invcat_prep', name: 'Prepped Aloo Tikki Base Mix', code: 'PRP-TIK-04', category_type: 'prepared_food', base_unit: 'kg', min_stock_alert: 20, cost_per_unit: 80.00, is_active: true, is_demo: true, created_at: now },
      { id: 'demo_inv_imli_chutney', business_id: businessId, category_id: 'demo_invcat_prep', name: 'Sweet Jaggery Imli Saunth', code: 'PRP-IML-05', category_type: 'prepared_food', base_unit: 'ltr', min_stock_alert: 10, cost_per_unit: 85.00, is_active: true, is_demo: true, created_at: now },

      // Packaging
      { id: 'demo_inv_puris_box', business_id: businessId, category_id: 'demo_invcat_pack', name: 'Golgappa Puris (Box of 500)', code: 'PKG-PUR-01', category_type: 'packaging', base_unit: 'box', min_stock_alert: 10, cost_per_unit: 250.00, is_active: true, is_demo: true, created_at: now },
      { id: 'demo_inv_bowls', business_id: businessId, category_id: 'demo_invcat_pack', name: 'Biodegradable Chaat Bowls', code: 'PKG-BWL-02', category_type: 'packaging', base_unit: 'pc', min_stock_alert: 500, cost_per_unit: 1.80, is_active: true, is_demo: true, created_at: now },
      { id: 'demo_inv_kulhads', business_id: businessId, category_id: 'demo_invcat_pack', name: 'Clay Earthen Kulhads (200ml)', code: 'PKG-KLH-03', category_type: 'packaging', base_unit: 'pc', min_stock_alert: 300, cost_per_unit: 3.50, is_active: true, is_demo: true, created_at: now },
    ];
    await db.inventory_items.bulkPut(demoInventoryItems);

    // ---------------- 3. BALANCES ACROSS THE 4 PHYSICAL SITES ----------------
    const demoBalances: InventoryBalance[] = [
      // Central Store Room (STOR-02)
      { id: 'bal_stor_butter', business_id: businessId, location_id: 'loc_stor_02', inventory_item_id: 'demo_inv_butter', available_quantity: 140, in_transit_quantity: 0, last_updated: now },
      { id: 'bal_stor_potatoes', business_id: businessId, location_id: 'loc_stor_02', inventory_item_id: 'demo_inv_potatoes', available_quantity: 480, in_transit_quantity: 0, last_updated: now },
      { id: 'bal_stor_chana', business_id: businessId, location_id: 'loc_stor_02', inventory_item_id: 'demo_inv_chana', available_quantity: 150, in_transit_quantity: 0, last_updated: now },
      { id: 'bal_stor_oil', business_id: businessId, location_id: 'loc_stor_02', inventory_item_id: 'demo_inv_oil', available_quantity: 90, in_transit_quantity: 0, last_updated: now },
      { id: 'bal_stor_puris', business_id: businessId, location_id: 'loc_stor_02', inventory_item_id: 'demo_inv_puris_box', available_quantity: 35, in_transit_quantity: 6, last_updated: now },
      { id: 'bal_stor_bowls', business_id: businessId, location_id: 'loc_stor_02', inventory_item_id: 'demo_inv_bowls', available_quantity: 5000, in_transit_quantity: 0, last_updated: now },

      // Base Kitchen (BASE-01)
      { id: 'bal_base_butter', business_id: businessId, location_id: 'loc_base_01', inventory_item_id: 'demo_inv_butter', available_quantity: 35, in_transit_quantity: 0, last_updated: now },
      { id: 'bal_base_potatoes', business_id: businessId, location_id: 'loc_base_01', inventory_item_id: 'demo_inv_potatoes', available_quantity: 160, in_transit_quantity: 0, last_updated: now },
      { id: 'bal_base_tikki_mix', business_id: businessId, location_id: 'loc_base_01', inventory_item_id: 'demo_inv_tikki_mix', available_quantity: 52, in_transit_quantity: 0, last_updated: now },
      { id: 'bal_base_bhaji', business_id: businessId, location_id: 'loc_base_01', inventory_item_id: 'demo_inv_bhaji_prep', available_quantity: 48, in_transit_quantity: 20, last_updated: now },
      { id: 'bal_base_chole', business_id: businessId, location_id: 'loc_base_01', inventory_item_id: 'demo_inv_chole_prep', available_quantity: 45, in_transit_quantity: 25, last_updated: now },
      { id: 'bal_base_papdi', business_id: businessId, location_id: 'loc_base_01', inventory_item_id: 'demo_inv_papdi_prep', available_quantity: 30, in_transit_quantity: 0, last_updated: now },
      { id: 'bal_base_chutney', business_id: businessId, location_id: 'loc_base_01', inventory_item_id: 'demo_inv_imli_chutney', available_quantity: 25, in_transit_quantity: 0, last_updated: now },

      // Shahpura Street Outlet (SHAH-03)
      { id: 'bal_shah_bhaji', business_id: businessId, location_id: 'loc_shah_03', inventory_item_id: 'demo_inv_bhaji_prep', available_quantity: 22, in_transit_quantity: 0, last_updated: now },
      { id: 'bal_shah_chole', business_id: businessId, location_id: 'loc_shah_03', inventory_item_id: 'demo_inv_chole_prep', available_quantity: 18, in_transit_quantity: 0, last_updated: now },
      { id: 'bal_shah_papdi', business_id: businessId, location_id: 'loc_shah_03', inventory_item_id: 'demo_inv_papdi_prep', available_quantity: 14, in_transit_quantity: 0, last_updated: now },
      { id: 'bal_shah_tikki_mix', business_id: businessId, location_id: 'loc_shah_03', inventory_item_id: 'demo_inv_tikki_mix', available_quantity: 12, in_transit_quantity: 0, last_updated: now },
      { id: 'bal_shah_puris', business_id: businessId, location_id: 'loc_shah_03', inventory_item_id: 'demo_inv_puris_box', available_quantity: 8, in_transit_quantity: 0, last_updated: now },
      { id: 'bal_shah_kulhad', business_id: businessId, location_id: 'loc_shah_03', inventory_item_id: 'demo_inv_kulhads', available_quantity: 220, in_transit_quantity: 0, last_updated: now },

      // Tukisssz Kasa, 11 No. Food Court (11NO-04)
      { id: 'bal_11no_bhaji', business_id: businessId, location_id: 'loc_11no_04', inventory_item_id: 'demo_inv_bhaji_prep', available_quantity: 16, in_transit_quantity: 0, last_updated: now },
      { id: 'bal_11no_chole', business_id: businessId, location_id: 'loc_11no_04', inventory_item_id: 'demo_inv_chole_prep', available_quantity: 14, in_transit_quantity: 0, last_updated: now },
      { id: 'bal_11no_papdi', business_id: businessId, location_id: 'loc_11no_04', inventory_item_id: 'demo_inv_papdi_prep', available_quantity: 10, in_transit_quantity: 0, last_updated: now },
      { id: 'bal_11no_puris', business_id: businessId, location_id: 'loc_11no_04', inventory_item_id: 'demo_inv_puris_box', available_quantity: 6, in_transit_quantity: 0, last_updated: now },
    ];
    await db.inventory_balances.bulkPut(demoBalances);

    // ---------------- 4. SUPPLIERS DIRECTORY (6 VENDORS) ----------------
    const demoSuppliers: Supplier[] = [
      { id: 'demo_sup_dairy', business_id: businessId, name: 'Bhopal Central Dairy & Amul Agency', contact_person: 'Rameshwar Sharma', phone: '9826199881', address: 'Berasia Road Mandi, Bhopal', gstin: '23AAAAA0000A1Z5', payment_terms: 'Weekly Net 7', opening_balance: 0, current_outstanding: 14200.00, is_active: true, notes: 'Supplies daily fresh milk, paneer, and Amul butter blocks', is_demo: true, created_at: now },
      { id: 'demo_sup_mandi', business_id: businessId, name: 'Karond Wholesale Sabzi Mandi', contact_person: 'Mohan Lal Sahu', phone: '9826288772', address: 'Wholesale Mandi Gate 2, Karond, Bhopal', payment_terms: 'Cash on Delivery', opening_balance: 0, current_outstanding: 0, is_active: true, notes: 'Bulk potatoes, onions, coriander, green chilies, tomatoes', is_demo: true, created_at: now },
      { id: 'demo_sup_packaging', business_id: businessId, name: 'EcoPack India Disposables', contact_person: 'Gaurav Aggarwal', phone: '9826377663', address: 'MP Nagar Zone 1, Bhopal', gstin: '23BBBBB1111B2Z6', payment_terms: '15 Days Credit', opening_balance: 5000, current_outstanding: 8500.00, is_active: true, notes: 'Bio bowls, wooden spoons, takeaway bags, puris', is_demo: true, created_at: now },
      { id: 'demo_sup_spices', business_id: businessId, name: 'Shree Ram Spices & Grains Mart', contact_person: 'Kamal Kishore', phone: '9826455441', address: 'Jumerati Bazar, Bhopal', gstin: '23CCCCC2222C3Z7', payment_terms: '30 Days Credit', opening_balance: 0, current_outstanding: 10000.00, is_active: true, notes: 'Kabuli Chana, Besan, Hing, Cumin, Red Chili Powder', is_demo: true, created_at: now },
      { id: 'demo_sup_oils', business_id: businessId, name: 'Malwa Edible Oils & Ghee Depot', contact_person: 'Suresh Patidar', phone: '9826566552', address: 'Chhola Road, Bhopal', gstin: '23DDDDD3333D4Z8', payment_terms: '10 Days Credit', opening_balance: 0, current_outstanding: 13500.00, is_active: true, notes: 'Refined sunflower oil tins and cooking medium', is_demo: true, created_at: now },
      { id: 'demo_sup_gas', business_id: businessId, name: 'Bansal Commercial Gas Agency', contact_person: 'Deepak Bansal', phone: '9826677883', address: 'Hamidia Road, Bhopal', payment_terms: 'Cash on Delivery', opening_balance: 0, current_outstanding: 0, is_active: true, notes: '19kg commercial LPG refills for kitchen', is_demo: true, created_at: now },
    ];
    await db.suppliers.bulkPut(demoSuppliers);

    // ---------------- 5. PURCHASES / VENDOR BILLS (6 BILLS WITH VARIOUS STATUSES) ----------------
    const demoPurchases: Purchase[] = [
      { id: 'demo_purch_01', client_tx_id: 'tx_pch_001', business_id: businessId, supplier_id: 'demo_sup_dairy', receiving_location_id: 'loc_stor_02', invoice_number: 'INV-AMUL-4402', invoice_date: twoDaysAgoDate, total_amount: 19200.00, tax_amount: 960.00, discount_amount: 0, paid_amount: 5000.00, outstanding_balance: 14200.00, payment_status: 'partially_paid', notes: '40 kg Amul Table Butter blocks', created_at: twoDaysAgoDate, is_demo: true },
      { id: 'demo_purch_02', client_tx_id: 'tx_pch_002', business_id: businessId, supplier_id: 'demo_sup_packaging', receiving_location_id: 'loc_stor_02', invoice_number: 'INV-ECO-8891', invoice_date: yesterdayDate, total_amount: 8500.00, tax_amount: 425.00, discount_amount: 0, paid_amount: 0, outstanding_balance: 8500.00, payment_status: 'unpaid', notes: '15 Boxes Golgappa Puris & 3000 Bio Bowls', created_at: yesterdayDate, is_demo: true },
      { id: 'demo_purch_03', client_tx_id: 'tx_pch_003', business_id: businessId, supplier_id: 'demo_sup_mandi', receiving_location_id: 'loc_stor_02', invoice_number: 'INV-MND-1204', invoice_date: yesterdayDate, total_amount: 15000.00, tax_amount: 0, discount_amount: 0, paid_amount: 15000.00, outstanding_balance: 0, payment_status: 'paid', notes: '500kg Agra Potatoes & 100kg Onions', created_at: yesterdayDate, is_demo: true },
      { id: 'demo_purch_04', client_tx_id: 'tx_pch_004', business_id: businessId, supplier_id: 'demo_sup_spices', receiving_location_id: 'loc_stor_02', invoice_number: 'INV-RAM-3310', invoice_date: todayDate, total_amount: 18500.00, tax_amount: 925.00, discount_amount: 0, paid_amount: 8500.00, outstanding_balance: 10000.00, payment_status: 'partially_paid', notes: '150kg Kabuli Chana & 50kg Besan', created_at: todayDate, is_demo: true },
      { id: 'demo_purch_05', client_tx_id: 'tx_pch_005', business_id: businessId, supplier_id: 'demo_sup_oils', receiving_location_id: 'loc_stor_02', invoice_number: 'INV-MLW-7721', invoice_date: todayDate, total_amount: 13500.00, tax_amount: 675.00, discount_amount: 0, paid_amount: 0, outstanding_balance: 13500.00, payment_status: 'unpaid', notes: '10 Tins Refined Sunflower Cooking Oil', created_at: todayDate, is_demo: true },
      { id: 'demo_purch_06', client_tx_id: 'tx_pch_006', business_id: businessId, supplier_id: 'demo_sup_gas', receiving_location_id: 'loc_base_01', invoice_number: 'INV-GAS-9012', invoice_date: todayDate, total_amount: 7200.00, tax_amount: 360.00, discount_amount: 0, paid_amount: 7200.00, outstanding_balance: 0, payment_status: 'paid', notes: '4 Commercial 19kg LPG Cylinders for kitchen', created_at: todayDate, is_demo: true }
    ];
    await db.purchases.bulkPut(demoPurchases);

    // Supplier Payment Vouchers
    const demoSupplierPayments: SupplierPayment[] = [
      { id: 'demo_spay_01', business_id: businessId, purchase_id: 'demo_purch_01', supplier_id: 'demo_sup_dairy', amount: 5000.00, payment_method: 'bank_transfer', payment_date: yesterdayDate, reference_id: 'NEFT-HDFC-99128', notes: 'Partial advance clearing for Butter invoice', created_at: yesterdayDate, is_demo: true },
      { id: 'demo_spay_02', business_id: businessId, purchase_id: 'demo_purch_03', supplier_id: 'demo_sup_mandi', amount: 15000.00, payment_method: 'cash', payment_date: yesterdayDate, reference_id: 'CASH-VOUCH-44', notes: 'Cash paid to Mandi truck driver on unload', created_at: yesterdayDate, is_demo: true },
      { id: 'demo_spay_03', business_id: businessId, purchase_id: 'demo_purch_04', supplier_id: 'demo_sup_spices', amount: 8500.00, payment_method: 'upi', payment_date: todayDate, reference_id: 'UPI-SPICE-9921', notes: 'Advance token transfer for Chana delivery', created_at: todayDate, is_demo: true },
      { id: 'demo_spay_04', business_id: businessId, purchase_id: 'demo_purch_06', supplier_id: 'demo_sup_gas', amount: 7200.00, payment_method: 'cash', payment_date: todayDate, reference_id: 'CASH-GAS-88', notes: 'Full cash payment for commercial cylinders', created_at: todayDate, is_demo: true },
    ];
    await db.supplier_payments.bulkPut(demoSupplierPayments);

    // ---------------- 6. OPERATIONAL & CREDIT EXPENSES (7 CASES & CATEGORIES) ----------------
    const demoExpenses: Expense[] = [
      { id: 'demo_exp_gas', client_tx_id: 'tx_exp_001', business_id: businessId, location_id: 'loc_base_01', category_id: 'exp_cat_gas', description: '2 Commercial LPG Gas Cylinder refills for Base Kitchen', amount: 3600.00, payment_method: 'cash', payment_status: 'paid', amount_paid: 3600.00, outstanding_balance: 0, vendor_name: 'Bharat Gas Agency', expense_date: todayDate, created_at: todayDate, is_demo: true },
      { id: 'demo_exp_repair', client_tx_id: 'tx_exp_002', business_id: businessId, location_id: 'loc_shah_03', category_id: 'exp_cat_maint', description: 'Deep Freezer compressor gas recharge & tawa repair', amount: 1800.00, payment_method: 'bank_transfer', payment_status: 'unpaid', amount_paid: 0, outstanding_balance: 1800.00, due_date: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0], vendor_name: 'Bhopal Refrigeration Repairs', expense_date: todayDate, created_at: todayDate, is_demo: true },
      { id: 'demo_exp_wages', client_tx_id: 'tx_exp_003', business_id: businessId, location_id: 'loc_shah_03', category_id: 'exp_cat_wages', description: 'Daily helper shift overtime allowance', amount: 450.00, payment_method: 'cash', payment_status: 'paid', amount_paid: 450.00, outstanding_balance: 0, expense_date: todayDate, created_at: todayDate, is_demo: true },
      { id: 'demo_exp_clean', client_tx_id: 'tx_exp_004', business_id: businessId, location_id: 'loc_base_01', category_id: 'exp_cat_misc', description: 'Kitchen floor cleaning chemicals, sanitizers & scouring pads', amount: 620.00, payment_method: 'upi', payment_status: 'paid', amount_paid: 620.00, outstanding_balance: 0, vendor_name: 'CleanWell Traders', expense_date: yesterdayDate, created_at: yesterdayDate, is_demo: true },
      { id: 'demo_exp_rent', client_tx_id: 'tx_exp_005', business_id: businessId, location_id: 'loc_11no_04', category_id: 'exp_cat_rent', description: 'Monthly Kiosk common area maintenance & electricity share', amount: 2500.00, payment_method: 'bank_transfer', payment_status: 'unpaid', amount_paid: 0, outstanding_balance: 2500.00, due_date: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0], vendor_name: '11 No. Food Court Association', expense_date: todayDate, created_at: todayDate, is_demo: true },
      { id: 'demo_exp_tape', client_tx_id: 'tx_exp_006', business_id: businessId, location_id: 'loc_shah_03', category_id: 'exp_cat_pack', description: 'Printed Chaat Kulture branded parcel tape & takeaway bags', amount: 1200.00, payment_method: 'upi', payment_status: 'paid', amount_paid: 1200.00, outstanding_balance: 0, vendor_name: 'PackPrint Bhopal', expense_date: yesterdayDate, created_at: yesterdayDate, is_demo: true },
      { id: 'demo_exp_sanitation', client_tx_id: 'tx_exp_007', business_id: businessId, location_id: 'loc_shah_03', category_id: 'exp_cat_misc', description: 'Municipal solid waste clearance and night sanitation fee', amount: 350.00, payment_method: 'cash', payment_status: 'paid', amount_paid: 350.00, outstanding_balance: 0, expense_date: todayDate, created_at: todayDate, is_demo: true },
    ];
    await db.expenses.bulkPut(demoExpenses);

    // ---------------- 7. KITCHEN PRODUCTION BATCHES (6 BATCHES AT BASE-01) ----------------
    const demoProductionBatches: ProductionRecord[] = [
      { id: 'demo_prod_01', client_tx_id: 'tx_prd_001', business_id: businessId, location_id: 'loc_base_01', batch_number: 'BATCH-BK-2026-1108', inventory_item_id: 'demo_inv_tikki_mix', item_name: 'Prepped Aloo Tikki Base Mix', quantity_produced: 52.0, unit: 'kg', production_date: todayDate, notes: 'Boiled potatoes (48kg) + Spices (5.5kg). Cooking yield +2.4% variance. Head Chef: Ramesh', created_at: todayDate, is_demo: true },
      { id: 'demo_prod_02', client_tx_id: 'tx_prd_002', business_id: businessId, location_id: 'loc_base_01', batch_number: 'BATCH-BK-2026-1109', inventory_item_id: 'demo_inv_bhaji_prep', item_name: 'Cooked Bhaji (Base Kitchen)', quantity_produced: 45.0, unit: 'kg', production_date: todayDate, notes: 'Slow cooked vegetable mash with Amul butter batch for Shahpura and 11 No. outlets.', created_at: todayDate, is_demo: true },
      { id: 'demo_prod_03', client_tx_id: 'tx_prd_003', business_id: businessId, location_id: 'loc_base_01', batch_number: 'BATCH-BK-2026-1110', inventory_item_id: 'demo_inv_chole_prep', item_name: 'Prepared Pindi Chole Gravy', quantity_produced: 40.0, unit: 'kg', production_date: yesterdayDate, notes: 'Slow-simmered tea-infused black chole gravy with authentic anardana masala.', created_at: yesterdayDate, is_demo: true },
      { id: 'demo_prod_04', client_tx_id: 'tx_prd_004', business_id: businessId, location_id: 'loc_base_01', batch_number: 'BATCH-BK-2026-1111', inventory_item_id: 'demo_inv_imli_chutney', item_name: 'Sweet Jaggery Imli Saunth', quantity_produced: 25.0, unit: 'ltr', production_date: yesterdayDate, notes: 'Seeded tamarind pulp cooked with jaggery, ginger powder, and roasted cumin.', created_at: yesterdayDate, is_demo: true },
      { id: 'demo_prod_05', client_tx_id: 'tx_prd_005', business_id: businessId, location_id: 'loc_base_01', batch_number: 'BATCH-BK-2026-1112', inventory_item_id: 'demo_inv_papdi_prep', item_name: 'Crispy Papdi (Fried Flat)', quantity_produced: 30.0, unit: 'kg', production_date: twoDaysAgoDate, notes: 'Crispy fried whole-wheat & ajwain flat papdis for sev puri & dahi chaat.', created_at: twoDaysAgoDate, is_demo: true },
      { id: 'demo_prod_06', client_tx_id: 'tx_prd_006', business_id: businessId, location_id: 'loc_base_01', batch_number: 'BATCH-BK-2026-1113', inventory_item_id: 'demo_inv_curd', item_name: 'Fresh Milk & Set Curd (Dahi)', quantity_produced: 35.0, unit: 'kg', production_date: todayDate, notes: 'Chilled sweetened curd blended with sugar and elaichi essence for outlet dispensers.', created_at: todayDate, is_demo: true },
    ];
    await db.production_records.bulkPut(demoProductionBatches);

    // ---------------- 8. STOCK REQUESTS / INDENTS (6 DIFFERENT CASES) ----------------
    const demoStockRequests: StockRequest[] = [
      {
        id: 'demo_req_01', client_tx_id: 'tx_req_001', business_id: businessId, request_number: 'REQ-SHAH-101', from_location_id: 'loc_shah_03', to_location_id: 'loc_base_01', request_type: 'next_day', required_date: todayDate, status: 'submitted', notes: 'Weekend evening rush requirement for Shahpura', created_at: todayDate, updated_at: todayDate, is_demo: true,
        items: [
          { id: 'demo_rqi_1', stock_request_id: 'demo_req_01', inventory_item_id: 'demo_inv_bhaji_prep', item_name: 'Cooked Bhaji', requested_quantity: 20, approved_quantity: 20, dispatched_quantity: 0, received_quantity: 0, unit: 'kg' },
          { id: 'demo_rqi_2', stock_request_id: 'demo_req_01', inventory_item_id: 'demo_inv_chole_prep', item_name: 'Prepared Chole', requested_quantity: 25, approved_quantity: 25, dispatched_quantity: 0, received_quantity: 0, unit: 'kg' },
        ]
      },
      {
        id: 'demo_req_02', client_tx_id: 'tx_req_002', business_id: businessId, request_number: 'REQ-SHAH-102', from_location_id: 'loc_shah_03', to_location_id: 'loc_base_01', request_type: 'same_day_urgent', required_date: todayDate, status: 'approved', notes: 'Afternoon urgent top-up of Papdi and Chutneys', created_at: todayDate, updated_at: todayDate, is_demo: true,
        items: [
          { id: 'demo_rqi_3', stock_request_id: 'demo_req_02', inventory_item_id: 'demo_inv_papdi_prep', item_name: 'Crispy Papdi', requested_quantity: 15, approved_quantity: 15, dispatched_quantity: 0, received_quantity: 0, unit: 'kg' },
          { id: 'demo_rqi_4', stock_request_id: 'demo_req_02', inventory_item_id: 'demo_inv_imli_chutney', item_name: 'Imli Chutney', requested_quantity: 10, approved_quantity: 10, dispatched_quantity: 0, received_quantity: 0, unit: 'ltr' },
        ]
      },
      {
        id: 'demo_req_03', client_tx_id: 'tx_req_003', business_id: businessId, request_number: 'REQ-11NO-103', from_location_id: 'loc_11no_04', to_location_id: 'loc_base_01', request_type: 'next_day', required_date: todayDate, status: 'dispatched', notes: 'Food court regular replenishment', created_at: yesterdayDate, updated_at: todayDate, is_demo: true,
        items: [
          { id: 'demo_rqi_5', stock_request_id: 'demo_req_03', inventory_item_id: 'demo_inv_tikki_mix', item_name: 'Aloo Tikki Mix', requested_quantity: 18, approved_quantity: 18, dispatched_quantity: 18, received_quantity: 0, unit: 'kg' },
        ]
      },
      {
        id: 'demo_req_04', client_tx_id: 'tx_req_004', business_id: businessId, request_number: 'REQ-11NO-104', from_location_id: 'loc_11no_04', to_location_id: 'loc_stor_02', request_type: 'next_day', required_date: yesterdayDate, status: 'received', notes: 'Packaging and Puri supply from central warehouse', created_at: twoDaysAgoDate, updated_at: yesterdayDate, is_demo: true,
        items: [
          { id: 'demo_rqi_6', stock_request_id: 'demo_req_04', inventory_item_id: 'demo_inv_puris_box', item_name: 'Golgappa Puris', requested_quantity: 5, approved_quantity: 5, dispatched_quantity: 5, received_quantity: 5, unit: 'box' },
          { id: 'demo_rqi_7', stock_request_id: 'demo_req_04', inventory_item_id: 'demo_inv_bowls', item_name: 'Chaat Bowls', requested_quantity: 1000, approved_quantity: 1000, dispatched_quantity: 1000, received_quantity: 1000, unit: 'pc' },
        ]
      },
      {
        id: 'demo_req_05', client_tx_id: 'tx_req_005', business_id: businessId, request_number: 'REQ-SHAH-105', from_location_id: 'loc_shah_03', to_location_id: 'loc_stor_02', request_type: 'next_day', required_date: yesterdayDate, status: 'partially_received', notes: 'Central Store dispatched with short receipt', created_at: twoDaysAgoDate, updated_at: yesterdayDate, is_demo: true,
        items: [
          { id: 'demo_rqi_8', stock_request_id: 'demo_req_05', inventory_item_id: 'demo_inv_kulhads', item_name: 'Clay Kulhads', requested_quantity: 300, approved_quantity: 300, dispatched_quantity: 300, received_quantity: 260, unit: 'pc', notes: '40 kulhads cracked during transit' },
        ]
      },
      {
        id: 'demo_req_06', client_tx_id: 'tx_req_006', business_id: businessId, request_number: 'REQ-BASE-106', from_location_id: 'loc_base_01', to_location_id: 'loc_stor_02', request_type: 'same_day_urgent', required_date: todayDate, status: 'rejected', notes: 'Store currently out of stock for special chaat masala batch', created_at: todayDate, updated_at: todayDate, is_demo: true,
        items: [
          { id: 'demo_rqi_9', stock_request_id: 'demo_req_06', inventory_item_id: 'demo_inv_butter', item_name: 'Table Butter Extra', requested_quantity: 50, approved_quantity: 0, dispatched_quantity: 0, received_quantity: 0, unit: 'kg' },
        ]
      }
    ];
    await db.stock_requests.bulkPut(demoStockRequests);

    // ---------------- 9. DISPATCHES & CHALLANS (6 DIFFERENT CASES) ----------------
    const demoDispatches: Dispatch[] = [
      {
        id: 'demo_dsp_01', client_tx_id: 'tx_dsp_001', business_id: businessId, challan_number: 'CHL-BK-201', stock_request_id: 'demo_req_01', from_location_id: 'loc_base_01', to_location_id: 'loc_shah_03', status: 'in_transit', dispatch_date: now, notes: 'Driver: Ramesh (Van MP-04-AB-1234). Dispatched from Base Kitchen.', created_at: now, is_demo: true,
        items: [
          { id: 'demo_dspi_1', dispatch_id: 'demo_dsp_01', inventory_item_id: 'demo_inv_bhaji_prep', item_name: 'Cooked Bhaji', requested_quantity: 20, dispatched_quantity: 20, received_quantity: 0, damaged_or_missing_quantity: 0, unit: 'kg' },
          { id: 'demo_dspi_2', dispatch_id: 'demo_dsp_01', inventory_item_id: 'demo_inv_chole_prep', item_name: 'Prepared Chole', requested_quantity: 25, dispatched_quantity: 25, received_quantity: 0, damaged_or_missing_quantity: 0, unit: 'kg' },
        ]
      },
      {
        id: 'demo_dsp_02', client_tx_id: 'tx_dsp_002', business_id: businessId, challan_number: 'CHL-BK-202', stock_request_id: 'demo_req_03', from_location_id: 'loc_base_01', to_location_id: 'loc_11no_04', status: 'received', dispatch_date: yesterdayDate, received_date: yesterdayDate, dispatched_by: 'Chef Ramesh', received_by: 'Supervisor Deepak', notes: 'Accepted 100% in pristine condition', created_at: yesterdayDate, is_demo: true,
        items: [
          { id: 'demo_dspi_3', dispatch_id: 'demo_dsp_02', inventory_item_id: 'demo_inv_tikki_mix', item_name: 'Aloo Tikki Mix', requested_quantity: 18, dispatched_quantity: 18, received_quantity: 18, damaged_or_missing_quantity: 0, unit: 'kg' },
        ]
      },
      {
        id: 'demo_dsp_03', client_tx_id: 'tx_dsp_003', business_id: businessId, challan_number: 'CHL-STR-203', stock_request_id: 'demo_req_05', from_location_id: 'loc_stor_02', to_location_id: 'loc_shah_03', status: 'discrepancy', dispatch_date: yesterdayDate, received_date: yesterdayDate, dispatched_by: 'Store Lead Prakash', received_by: 'Outlet Staff Sunil', notes: '1 Box of Puris arrived shattered due to bumpy transit', created_at: yesterdayDate, is_demo: true,
        items: [
          { id: 'demo_dspi_4', dispatch_id: 'demo_dsp_03', inventory_item_id: 'demo_inv_puris_box', item_name: 'Golgappa Puris', requested_quantity: 6, dispatched_quantity: 6, received_quantity: 5, damaged_or_missing_quantity: 1, unit: 'box', discrepancy_reason: '1 box crushed in delivery van' },
        ]
      },
      {
        id: 'demo_dsp_04', client_tx_id: 'tx_dsp_004', business_id: businessId, challan_number: 'CHL-STR-204', from_location_id: 'loc_stor_02', to_location_id: 'loc_base_01', status: 'received', dispatch_date: twoDaysAgoDate, received_date: twoDaysAgoDate, dispatched_by: 'Store Lead Prakash', received_by: 'Chef Ramesh', notes: 'Raw material bulk transfer for weekly prep', created_at: twoDaysAgoDate, is_demo: true,
        items: [
          { id: 'demo_dspi_5', dispatch_id: 'demo_dsp_04', inventory_item_id: 'demo_inv_potatoes', item_name: 'Agra Potatoes', requested_quantity: 200, dispatched_quantity: 200, received_quantity: 200, damaged_or_missing_quantity: 0, unit: 'kg' },
          { id: 'demo_dspi_6', dispatch_id: 'demo_dsp_04', inventory_item_id: 'demo_inv_oil', item_name: 'Sunflower Oil', requested_quantity: 30, dispatched_quantity: 30, received_quantity: 30, damaged_or_missing_quantity: 0, unit: 'ltr' },
        ]
      },
      {
        id: 'demo_dsp_05', client_tx_id: 'tx_dsp_005', business_id: businessId, challan_number: 'CHL-BK-205', stock_request_id: 'demo_req_02', from_location_id: 'loc_base_01', to_location_id: 'loc_shah_03', status: 'partially_received', dispatch_date: todayDate, received_date: todayDate, dispatched_by: 'Chef Ramesh', received_by: 'Manager Amit', notes: 'Papdi accepted; Chutney carboy pending evening batch', created_at: todayDate, is_demo: true,
        items: [
          { id: 'demo_dspi_7', dispatch_id: 'demo_dsp_05', inventory_item_id: 'demo_inv_papdi_prep', item_name: 'Crispy Papdi', requested_quantity: 15, dispatched_quantity: 15, received_quantity: 15, damaged_or_missing_quantity: 0, unit: 'kg' },
          { id: 'demo_dspi_8', dispatch_id: 'demo_dsp_05', inventory_item_id: 'demo_inv_imli_chutney', item_name: 'Imli Chutney', requested_quantity: 10, dispatched_quantity: 5, received_quantity: 5, damaged_or_missing_quantity: 0, unit: 'ltr' },
        ]
      },
      {
        id: 'demo_dsp_06', client_tx_id: 'tx_dsp_006', business_id: businessId, challan_number: 'CHL-STR-206', stock_request_id: 'demo_req_04', from_location_id: 'loc_stor_02', to_location_id: 'loc_11no_04', status: 'in_transit', dispatch_date: now, notes: 'Evening eco-disposables run for Food Court', created_at: now, is_demo: true,
        items: [
          { id: 'demo_dspi_9', dispatch_id: 'demo_dsp_06', inventory_item_id: 'demo_inv_bowls', item_name: 'Chaat Bowls', requested_quantity: 1000, dispatched_quantity: 1000, received_quantity: 0, damaged_or_missing_quantity: 0, unit: 'pc' },
          { id: 'demo_dspi_10', dispatch_id: 'demo_dsp_06', inventory_item_id: 'demo_inv_kulhads', item_name: 'Clay Kulhads', requested_quantity: 200, dispatched_quantity: 200, received_quantity: 0, damaged_or_missing_quantity: 0, unit: 'pc' },
        ]
      }
    ];
    await db.dispatches.bulkPut(demoDispatches);

    // ---------------- 10. WASTAGE & SPOILAGE (6 DIFFERENT REASON CODES & CONDITIONS) ----------------
    const demoWastageRecords: WastageRecord[] = [
      { id: 'demo_wst_01', client_tx_id: 'tx_wst_001', business_id: businessId, location_id: 'loc_shah_03', inventory_item_id: 'demo_inv_puris_box', item_name: 'Golgappa Puris (Box of 500)', quantity: 1, unit: 'box', reason: 'damage', status: 'approved', approved_by: 'Owner / Manager', notes: 'Box crushed in delivery transit; puris shattered. Logged to wastage, not added to available stock.', created_at: yesterdayDate, is_demo: true },
      { id: 'demo_wst_02', client_tx_id: 'tx_wst_002', business_id: businessId, location_id: 'loc_shah_03', inventory_item_id: 'demo_inv_curd', item_name: 'Fresh Milk & Set Curd (Dahi)', quantity: 3.5, unit: 'kg', reason: 'spoilage', status: 'approved', approved_by: 'Manager Amit', notes: 'Chilled curd soured due to overnight chiller power fluctuation.', created_at: yesterdayDate, is_demo: true },
      { id: 'demo_wst_03', client_tx_id: 'tx_wst_003', business_id: businessId, location_id: 'loc_base_01', inventory_item_id: 'demo_inv_tikki_mix', item_name: 'Prepped Aloo Tikki Base Mix', quantity: 1.8, unit: 'kg', reason: 'preparation_wastage', status: 'approved', approved_by: 'Chef Ramesh', notes: 'Overcooked burnt patties during trial batch frying on new tawa.', created_at: todayDate, is_demo: true },
      { id: 'demo_wst_04', client_tx_id: 'tx_wst_004', business_id: businessId, location_id: 'loc_11no_04', inventory_item_id: 'demo_inv_imli_chutney', item_name: 'Sweet Jaggery Imli Saunth', quantity: 2.0, unit: 'ltr', reason: 'spillage', status: 'pending', notes: 'Counter staff accidentally knocked over 2-litre dispenser jug during 7 PM peak rush.', created_at: todayDate, is_demo: true },
      { id: 'demo_wst_05', client_tx_id: 'tx_wst_005', business_id: businessId, location_id: 'loc_shah_03', inventory_item_id: 'demo_inv_bhaji_prep', item_name: 'Cooked Bhaji', quantity: 2.5, unit: 'kg', reason: 'spoilage', status: 'approved', approved_by: 'Manager Amit', notes: 'Batch passed 24-hour freshness threshold; safely discarded to ensure food quality.', created_at: yesterdayDate, is_demo: true },
      { id: 'demo_wst_06', client_tx_id: 'tx_wst_006', business_id: businessId, location_id: 'loc_base_01', inventory_item_id: 'demo_inv_potatoes', item_name: 'Potatoes (A-Grade Agra)', quantity: 3.0, unit: 'kg', reason: 'other', status: 'approved', approved_by: 'Chef Ramesh', notes: 'Black-heart spoiled potatoes discarded upon bag peeling inspection.', created_at: twoDaysAgoDate, is_demo: true },
    ];
    await db.wastage_records.bulkPut(demoWastageRecords);

    // ---------------- 11. SALES & POS ORDERS (7 DIFFERENT CHANNELS, TENDERS & CONDITIONS) ----------------
    const demoSales: Sale[] = [
      // 1. Walk-in Cash Bill at Shahpura
      {
        id: 'demo_sale_1', client_tx_id: 'tx_demo_001', business_id: businessId, location_id: 'loc_shah_03', order_number: 'CK-SHAH-1048', channel: 'walk_in', gross_amount: 152.38, tax_amount: 7.62, discount_amount: 0, net_amount: 160.00, payment_status: 'completed', created_at: new Date(Date.now() - 3600000 * 4).toISOString(), is_demo: true,
        items: [
          { id: 'demo_sitem_1', sale_id: 'demo_sale_1', menu_item_id: 'demo_menu_pp', item_name: 'Special Pani Puri (6 Pcs)', quantity: 2, unit_price: 50.00, tax_rate: 5.00, tax_amount: 4.76, total_price: 100.00, is_complimentary: false, created_at: now },
          { id: 'demo_sitem_2', sale_id: 'demo_sale_1', menu_item_id: 'demo_menu_sp', item_name: 'Sev Puri Mumbai Style', quantity: 1, unit_price: 60.00, tax_rate: 5.00, tax_amount: 2.86, total_price: 60.00, is_complimentary: false, created_at: now },
        ],
        payments: [
          { id: 'demo_pay_1', sale_id: 'demo_sale_1', payment_method: 'cash', amount: 160.00, created_at: now }
        ]
      },
      // 2. 100% UPI Bill at Shahpura
      {
        id: 'demo_sale_2', client_tx_id: 'tx_demo_002', business_id: businessId, location_id: 'loc_shah_03', order_number: 'CK-SHAH-1049', channel: 'walk_in', gross_amount: 264.76, tax_amount: 13.24, discount_amount: 0, net_amount: 278.00, payment_status: 'completed', created_at: new Date(Date.now() - 3600000 * 3).toISOString(), is_demo: true,
        items: [
          { id: 'demo_sitem_3', sale_id: 'demo_sale_2', menu_item_id: 'demo_menu_pb', item_name: 'Pav Bhaji (Amul Butter)', quantity: 2, unit_price: 99.00, tax_rate: 5.00, tax_amount: 9.43, total_price: 198.00, is_complimentary: false, created_at: now },
          { id: 'demo_sitem_4', sale_id: 'demo_sale_2', menu_item_id: 'demo_menu_chaas', item_name: 'Special Masala Chaas (Kulhad)', quantity: 2, unit_price: 40.00, tax_rate: 5.00, tax_amount: 3.81, total_price: 80.00, is_complimentary: false, created_at: now },
        ],
        payments: [
          { id: 'demo_pay_2', sale_id: 'demo_sale_2', payment_method: 'upi', amount: 278.00, reference_id: 'UPI994411', created_at: now }
        ]
      },
      // 3. 50/50 Split Tender (Cash + UPI) at Shahpura
      {
        id: 'demo_sale_3', client_tx_id: 'tx_demo_003', business_id: businessId, location_id: 'loc_shah_03', order_number: 'CK-SHAH-1050', channel: 'walk_in', gross_amount: 285.71, tax_amount: 14.29, discount_amount: 0, net_amount: 300.00, payment_status: 'completed', created_at: new Date(Date.now() - 3600000 * 2).toISOString(), is_demo: true,
        items: [
          { id: 'demo_sitem_5', sale_id: 'demo_sale_3', menu_item_id: 'demo_menu_cb', item_name: 'Chole Bhature (2 Pcs)', quantity: 2, unit_price: 120.00, tax_rate: 5.00, tax_amount: 11.43, total_price: 240.00, is_complimentary: false, created_at: now },
          { id: 'demo_sitem_6', sale_id: 'demo_sale_3', menu_item_id: 'demo_menu_sp', item_name: 'Sev Puri Mumbai Style', quantity: 1, unit_price: 60.00, tax_rate: 5.00, tax_amount: 2.86, total_price: 60.00, is_complimentary: false, created_at: now },
        ],
        payments: [
          { id: 'demo_pay_3a', sale_id: 'demo_sale_3', payment_method: 'cash', amount: 150.00, created_at: now },
          { id: 'demo_pay_3b', sale_id: 'demo_sale_3', payment_method: 'upi', amount: 150.00, reference_id: 'UPI771122', created_at: now },
        ]
      },
      // 4. Online Zomato Order at 11 No. Food Court
      {
        id: 'demo_sale_4', client_tx_id: 'tx_demo_004', business_id: businessId, location_id: 'loc_11no_04', order_number: 'CK-11NO-201', channel: 'zomato', gross_amount: 463.81, tax_amount: 23.19, discount_amount: 0, net_amount: 487.00, payment_status: 'completed', created_at: new Date(Date.now() - 3600000 * 1.5).toISOString(), is_demo: true,
        items: [
          { id: 'demo_sitem_7', sale_id: 'demo_sale_4', menu_item_id: 'demo_menu_pb', item_name: 'Pav Bhaji (Amul Butter)', quantity: 3, unit_price: 119.00, tax_rate: 5.00, tax_amount: 17.00, total_price: 357.00, is_complimentary: false, created_at: now },
          { id: 'demo_sitem_8', sale_id: 'demo_sale_4', menu_item_id: 'demo_menu_pp', item_name: 'Special Pani Puri (6 Pcs)', quantity: 2, unit_price: 65.00, tax_rate: 5.00, tax_amount: 6.19, total_price: 130.00, is_complimentary: false, created_at: now },
        ],
        payments: [
          { id: 'demo_pay_4', sale_id: 'demo_sale_4', payment_method: 'other', amount: 487.00, reference_id: 'ZOM-49120', created_at: now }
        ]
      },
      // 5. Online Swiggy Order at 11 No. Food Court
      {
        id: 'demo_sale_5', client_tx_id: 'tx_demo_005', business_id: businessId, location_id: 'loc_11no_04', order_number: 'CK-11NO-202', channel: 'swiggy', gross_amount: 398.10, tax_amount: 19.90, discount_amount: 0, net_amount: 418.00, payment_status: 'completed', created_at: new Date(Date.now() - 3600000 * 1).toISOString(), is_demo: true,
        items: [
          { id: 'demo_sitem_9', sale_id: 'demo_sale_5', menu_item_id: 'demo_menu_at', item_name: 'Kurkure Aloo Tikki Chaat', quantity: 2, unit_price: 105.00, tax_rate: 5.00, tax_amount: 10.00, total_price: 210.00, is_complimentary: false, created_at: now },
          { id: 'demo_sitem_10', sale_id: 'demo_sale_5', menu_item_id: 'demo_menu_dp', item_name: 'Dahi Papdi Chaat', quantity: 2, unit_price: 99.00, tax_rate: 5.00, tax_amount: 9.43, total_price: 198.00, is_complimentary: false, created_at: now },
          { id: 'demo_sitem_11', sale_id: 'demo_sale_5', menu_item_id: 'demo_menu_chaas', item_name: 'Masala Chaas', quantity: 1, unit_price: 50.00, tax_rate: 5.00, tax_amount: 2.38, total_price: 50.00, is_complimentary: false, created_at: now },
        ],
        payments: [
          { id: 'demo_pay_5', sale_id: 'demo_sale_5', payment_method: 'other', amount: 418.00, reference_id: 'SWIG-88219', created_at: now }
        ]
      },
      // 6. VIP Complimentary Promo Order (₹0 Payable) at Shahpura
      {
        id: 'demo_sale_6', client_tx_id: 'tx_demo_006', business_id: businessId, location_id: 'loc_shah_03', order_number: 'CK-SHAH-1051', channel: 'walk_in', gross_amount: 175.00, tax_amount: 0, discount_amount: 175.00, discount_type: 'fixed', discount_reason: 'VIP Food Critic & Food Blogger Promotion', discount_authorized_by: 'Owner', net_amount: 0.00, payment_status: 'completed', created_at: new Date(Date.now() - 1800000).toISOString(), is_demo: true,
        items: [
          { id: 'demo_sitem_12', sale_id: 'demo_sale_6', menu_item_id: 'demo_menu_at', item_name: 'Kurkure Aloo Tikki Chaat', quantity: 1, unit_price: 90.00, tax_rate: 0, tax_amount: 0, total_price: 0, is_complimentary: true, complimentary_reason: 'Food Review Promo', complimentary_authorized_by: 'Owner', created_at: now },
          { id: 'demo_sitem_13', sale_id: 'demo_sale_6', menu_item_id: 'demo_menu_dp', item_name: 'Dahi Papdi Chaat', quantity: 1, unit_price: 85.00, tax_rate: 0, tax_amount: 0, total_price: 0, is_complimentary: true, complimentary_reason: 'Food Review Promo', complimentary_authorized_by: 'Owner', created_at: now },
        ],
        payments: [
          { id: 'demo_pay_6', sale_id: 'demo_sale_6', payment_method: 'cash', amount: 0, created_at: now }
        ]
      },
      // 7. Partially Refunded Order at Shahpura
      {
        id: 'demo_sale_7', client_tx_id: 'tx_demo_007', business_id: businessId, location_id: 'loc_shah_03', order_number: 'CK-SHAH-1052', channel: 'walk_in', gross_amount: 209.52, tax_amount: 10.48, discount_amount: 0, net_amount: 220.00, payment_status: 'partially_refunded', notes: 'Customer returned 1 plate chaas due to spill; ₹40 refunded by cashier.', created_at: new Date(Date.now() - 900000).toISOString(), is_demo: true,
        items: [
          { id: 'demo_sitem_14', sale_id: 'demo_sale_7', menu_item_id: 'demo_menu_at', item_name: 'Kurkure Aloo Tikki Chaat', quantity: 2, unit_price: 90.00, tax_rate: 5.00, tax_amount: 8.57, total_price: 180.00, is_complimentary: false, created_at: now },
          { id: 'demo_sitem_15', sale_id: 'demo_sale_7', menu_item_id: 'demo_menu_chaas', item_name: 'Special Masala Chaas', quantity: 1, unit_price: 40.00, tax_rate: 5.00, tax_amount: 1.90, total_price: 40.00, is_complimentary: false, created_at: now },
        ],
        payments: [
          { id: 'demo_pay_7', sale_id: 'demo_sale_7', payment_method: 'cash', amount: 220.00, created_at: now }
        ]
      }
    ];
    await db.sales.bulkPut(demoSales);

    // ---------------- 12. DAILY CLOSINGS & CASH DRAWERS (5 SHIFT CASES) ----------------
    const demoDailyClosings: DailyClosing[] = [
      // Shift 1: Finalised yesterday at Shahpura
      {
        id: 'demo_close_yesterday_shah', business_id: businessId, location_id: 'loc_shah_03', closing_date: yesterdayDate, status: 'finalised', sales_status: 'completed', cash_status: 'completed', upi_status: 'completed', zomato_status: 'completed', swiggy_status: 'completed', expenses_status: 'completed', stock_status: 'completed', wastage_status: 'completed', receiving_status: 'completed', dispatch_status: 'completed', notes_status: 'completed', final_submission_status: 'completed', completed_sections_count: 12, notes: 'Shift balanced cleanly. Physical cash counted and handed over to owner.', submitted_by: 'Outlet Manager Amit', submitted_at: yesterdayDate + 'T23:45:00.000Z', created_at: yesterdayDate, updated_at: yesterdayDate, is_demo: true,
      },
      // Shift 2: Finalised yesterday at 11 No. Food Court
      {
        id: 'demo_close_yesterday_11no', business_id: businessId, location_id: 'loc_11no_04', closing_date: yesterdayDate, status: 'finalised', sales_status: 'completed', cash_status: 'completed', upi_status: 'completed', zomato_status: 'completed', swiggy_status: 'completed', expenses_status: 'completed', stock_status: 'completed', wastage_status: 'completed', receiving_status: 'completed', dispatch_status: 'completed', notes_status: 'completed', final_submission_status: 'completed', completed_sections_count: 12, notes: 'Food court counter closing complete. High online Zomato and Swiggy volume.', submitted_by: 'Supervisor Deepak', submitted_at: yesterdayDate + 'T23:30:00.000Z', created_at: yesterdayDate, updated_at: yesterdayDate, is_demo: true,
      },
      // Shift 3: Submitted today at Shahpura
      {
        id: 'demo_close_today_shah', business_id: businessId, location_id: 'loc_shah_03', closing_date: todayDate, status: 'submitted', sales_status: 'completed', cash_status: 'completed', upi_status: 'completed', zomato_status: 'completed', swiggy_status: 'completed', expenses_status: 'completed', stock_status: 'completed', wastage_status: 'completed', receiving_status: 'completed', dispatch_status: 'completed', notes_status: 'completed', final_submission_status: 'completed', completed_sections_count: 12, notes: 'Evening shift closing submitted for review.', submitted_by: 'Outlet Staff Sunil', submitted_at: now, created_at: todayDate, updated_at: now, is_demo: true,
      },
      // Shift 4: In-progress today at 11 No. Food Court
      {
        id: 'demo_close_today_11no', business_id: businessId, location_id: 'loc_11no_04', closing_date: todayDate, status: 'in_progress', sales_status: 'completed', cash_status: 'in_progress', upi_status: 'completed', zomato_status: 'completed', swiggy_status: 'in_progress', expenses_status: 'not_started', stock_status: 'in_progress', wastage_status: 'completed', receiving_status: 'not_started', dispatch_status: 'not_started', notes_status: 'not_started', final_submission_status: 'not_started', completed_sections_count: 5, notes: 'Counting cash drawer currently.', created_at: todayDate, updated_at: now, is_demo: true,
      },
      // Shift 5: Reopened historical closing at Shahpura
      {
        id: 'demo_close_two_days_shah', business_id: businessId, location_id: 'loc_shah_03', closing_date: twoDaysAgoDate, status: 'reopened', sales_status: 'completed', cash_status: 'completed', upi_status: 'completed', zomato_status: 'completed', swiggy_status: 'completed', expenses_status: 'attention_required', stock_status: 'completed', wastage_status: 'completed', receiving_status: 'completed', dispatch_status: 'completed', notes_status: 'completed', final_submission_status: 'attention_required', completed_sections_count: 10, notes: 'Reopened closing.', reopened_by: 'Super Admin (Owner)', reopened_at: now, reopen_reason: 'Super Admin reopened shift to record late ₹450 helper allowance voucher that was missed on night closing.', created_at: twoDaysAgoDate, updated_at: now, is_demo: true,
      }
    ];
    await db.daily_closings.bulkPut(demoDailyClosings);

    // Cash Closing drawers
    const demoCashClosings: CashClosing[] = [
      { id: 'demo_cclose_01', business_id: businessId, location_id: 'loc_shah_03', closing_date: yesterdayDate, opening_cash: 2000.00, cash_sales: 14500.00, other_cash_receipts: 0, cash_expenses: 450.00, cash_refunds: 0, cash_transferred_to_owner: 14000.00, expected_closing_cash: 2050.00, physical_closing_cash: 2050.00, difference: 0, notes: 'Zero discrepancy. Cash float kept at ₹2,000 for next morning.', created_by: 'Manager Amit', created_at: yesterdayDate, is_demo: true },
      { id: 'demo_cclose_02', business_id: businessId, location_id: 'loc_11no_04', closing_date: yesterdayDate, opening_cash: 1500.00, cash_sales: 9200.00, other_cash_receipts: 0, cash_expenses: 200.00, cash_refunds: 0, cash_transferred_to_owner: 9000.00, expected_closing_cash: 1500.00, physical_closing_cash: 1500.00, difference: 0, notes: 'Drawer balanced. ₹9,000 deposited into owner collection bag.', created_by: 'Supervisor Deepak', created_at: yesterdayDate, is_demo: true },
    ];
    await db.cash_closings.bulkPut(demoCashClosings);

    // ---------------- 13. CASH TRANSFERRED TO OWNER (CAPITAL WITHDRAWALS) ----------------
    const demoCashTransfers: CashTransferToOwner[] = [
      { id: 'demo_ctx_01', business_id: businessId, from_location_id: 'loc_shah_03', recipient_name: 'Owner (Mr. Agrawal)', amount: 14000.00, transfer_date: yesterdayDate, payment_method: 'cash_handover', reference_number: 'HANDOVER-2026-YEST', is_confirmed: true, recorded_by: 'Manager Amit', created_at: yesterdayDate, is_demo: true },
      { id: 'demo_ctx_02', business_id: businessId, from_location_id: 'loc_11no_04', recipient_name: 'Owner (Mr. Agrawal)', amount: 9000.00, transfer_date: yesterdayDate, payment_method: 'cash_handover', reference_number: 'HANDOVER-11NO-01', is_confirmed: true, recorded_by: 'Supervisor Deepak', created_at: yesterdayDate, is_demo: true },
      { id: 'demo_ctx_03', business_id: businessId, from_location_id: 'loc_shah_03', recipient_name: 'Owner Current A/C', amount: 12000.00, transfer_date: twoDaysAgoDate, payment_method: 'bank_deposit', reference_number: 'HDFC-DEP-99120', is_confirmed: true, recorded_by: 'Manager Amit', created_at: twoDaysAgoDate, is_demo: true },
    ];
    await db.cash_transfers_to_owner.bulkPut(demoCashTransfers);

    // ---------------- 14. PHYSICAL STOCK RECOUNTS & AUDITS (5 CASES) ----------------
    const demoStockCounts: StockCount[] = [
      { id: 'demo_sc_01', business_id: businessId, location_id: 'loc_shah_03', count_date: yesterdayDate, inventory_item_id: 'demo_inv_puris_box', opening_stock: 12, receipts_and_transfers_in: 0, production_output: 0, transfers_out: 0, wastage: 1, other_consumption: 3, expected_closing: 8, physical_closing: 8, variance: 0, variance_flagged: false, notes: 'Physical count matches ledger expectations perfectly.', counted_by: 'Outlet Staff Sunil', created_at: yesterdayDate, is_demo: true },
      { id: 'demo_sc_02', business_id: businessId, location_id: 'loc_base_01', count_date: yesterdayDate, inventory_item_id: 'demo_inv_butter', opening_stock: 40, receipts_and_transfers_in: 0, production_output: 0, transfers_out: 0, wastage: 0, other_consumption: 5, expected_closing: 35, physical_closing: 34.5, variance: -0.5, variance_flagged: false, notes: 'Minor 500g trim loss on hot butter slab slicing.', counted_by: 'Chef Ramesh', created_at: yesterdayDate, is_demo: true },
      { id: 'demo_sc_03', business_id: businessId, location_id: 'loc_11no_04', count_date: yesterdayDate, inventory_item_id: 'demo_inv_bowls', opening_stock: 600, receipts_and_transfers_in: 0, production_output: 0, transfers_out: 0, wastage: 0, other_consumption: 180, expected_closing: 420, physical_closing: 420, variance: 0, variance_flagged: false, notes: 'Disposables inventory reconciled.', counted_by: 'Supervisor Deepak', created_at: yesterdayDate, is_demo: true },
      { id: 'demo_sc_04', business_id: businessId, location_id: 'loc_stor_02', count_date: yesterdayDate, inventory_item_id: 'demo_inv_potatoes', opening_stock: 680, receipts_and_transfers_in: 0, production_output: 0, transfers_out: 200, wastage: 0, other_consumption: 0, expected_closing: 480, physical_closing: 480, variance: 0, variance_flagged: false, notes: 'Warehouse potato stack physical bag count verified.', counted_by: 'Store Lead Prakash', created_at: yesterdayDate, is_demo: true },
      { id: 'demo_sc_05', business_id: businessId, location_id: 'loc_shah_03', count_date: yesterdayDate, inventory_item_id: 'demo_inv_tikki_mix', opening_stock: 15, receipts_and_transfers_in: 0, production_output: 0, transfers_out: 0, wastage: 0, other_consumption: 3, expected_closing: 12, physical_closing: 10.8, variance: -1.2, variance_flagged: true, notes: 'Discrepancy investigated: 1.2 kg patty breakages logged late in kitchen.', counted_by: 'Manager Amit', created_at: yesterdayDate, is_demo: true }
    ];
    await db.stock_counts.bulkPut(demoStockCounts);

    // ---------------- 15. AUDIT LOG RECORD ----------------
    await db.audit_logs.put({
      id: 'audit_' + Date.now(),
      business_id: businessId,
      action: 'LOAD_FULL_SANDBOX_DEMO_DATA',
      entity: 'testing_sandbox',
      reason: 'User loaded complete multi-role demo data in Testing Sandbox with 5-6 distinct cases per operational module',
      created_at: now,
    });

    return true;
  },

  // Purge ONLY demo records (Guarantees zero loss of real business configuration)
  async purgeDemoData() {
    await db.transaction('rw', [
      db.menu_categories,
      db.menu_items,
      db.inventory_categories,
      db.inventory_items,
      db.inventory_balances,
      db.inventory_movements,
      db.suppliers,
      db.purchases,
      db.supplier_payments,
      db.expenses,
      db.expense_payments,
      db.sales,
      db.stock_requests,
      db.production_records,
      db.dispatches,
      db.wastage_records,
      db.daily_closings,
      db.cash_closings,
      db.cash_transfers_to_owner,
      db.stock_counts,
      db.audit_logs,
    ], async () => {
      await Promise.all([
        db.menu_categories.filter(i => !!i.is_demo).delete(),
        db.menu_items.filter(i => !!i.is_demo).delete(),
        db.inventory_categories.filter(i => !!i.is_demo).delete(),
        db.inventory_items.filter(i => !!i.is_demo).delete(),
        db.inventory_balances.filter(i => !!i.id.startsWith('bal_')).delete(),
        db.inventory_movements.filter(i => !!i.is_demo).delete(),
        db.suppliers.filter(i => !!i.is_demo).delete(),
        db.purchases.filter(i => !!i.is_demo).delete(),
        db.supplier_payments.filter(i => !!i.is_demo).delete(),
        db.expenses.filter(i => !!i.is_demo).delete(),
        db.expense_payments.filter(i => !!i.is_demo).delete(),
        db.sales.filter(i => !!i.is_demo).delete(),
        db.stock_requests.filter(i => !!i.is_demo).delete(),
        db.production_records.filter(i => !!i.is_demo).delete(),
        db.dispatches.filter(i => !!i.is_demo).delete(),
        db.wastage_records.filter(i => !!i.is_demo).delete(),
        db.daily_closings.filter(i => !!i.is_demo).delete(),
        db.cash_closings.filter(i => !!i.is_demo).delete(),
        db.cash_transfers_to_owner.filter(i => !!i.is_demo).delete(),
        db.stock_counts.filter(i => !!i.is_demo).delete(),
      ]);

      await db.audit_logs.put({
        id: 'audit_purge_' + Date.now(),
        business_id: 'biz_chaatkulture_01',
        action: 'PURGE_DEMO_DATA',
        entity: 'testing_sandbox',
        reason: 'User executed safe purge of test records. Live master configurations preserved.',
        created_at: new Date().toISOString(),
      });
    });

    return true;
  },
};
