import * as XLSX from 'xlsx';
import type { Supplier, Location, InventoryItem, Purchase } from '../../types';

export interface ParsedPurchaseItem {
  itemName: string;
  itemCode?: string;
  quantity: number;
  unit: string;
  rate: number;
  taxRate: number;
  taxAmount: number;
  subtotal: number;
  totalAmount: number;
  inventoryItemId?: string;
  willAutoCreateItem?: boolean;
}

export interface ParsedPurchaseInvoice {
  id: string; // temp client id
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  supplierName: string;
  supplierId?: string;
  willAutoCreateSupplier?: boolean;
  receivingLocationName: string;
  receivingLocationId: string;
  items: ParsedPurchaseItem[];
  totalGross: number;
  totalTax: number;
  totalAmount: number;
  paidAmount: number;
  outstandingBalance: number;
  paymentMethod: 'bank_transfer' | 'cash' | 'upi' | 'cheque';
  paymentStatus: 'paid' | 'partially_paid' | 'unpaid';
  notes?: string;
  warnings: string[];
  errors: string[];
  isValid: boolean;
  alreadyExistsInDb?: boolean;
}

export interface ExcelParseResult {
  invoices: ParsedPurchaseInvoice[];
  totalInvoices: number;
  totalLineItems: number;
  totalValue: number;
  totalPaid: number;
  totalOutstanding: number;
  newSuppliersCount: number;
  newItemsCount: number;
  duplicateCount: number;
  hasErrors: boolean;
}

// Clean and normalize keys from messy Excel headers
function normalizeHeaderKey(rawHeader: string): string {
  const clean = rawHeader.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  if (['invoicenumber', 'invoiceno', 'invno', 'invnum', 'billnumber', 'billno', 'billnum', 'invoice', 'bill'].includes(clean)) {
    return 'invoiceNumber';
  }
  if (['invoicedate', 'invdate', 'date', 'billdate', 'purchasedate'].includes(clean)) {
    return 'invoiceDate';
  }
  if (['suppliername', 'supplier', 'vendorname', 'vendor', 'partyname', 'party', 'supplierid'].includes(clean)) {
    return 'supplierName';
  }
  if (['receivinglocation', 'location', 'outlet', 'store', 'storeroom', 'branch', 'warehouse', 'receivinglocationid', 'locationname', 'locationcode'].includes(clean)) {
    return 'receivingLocation';
  }
  if (['itemname', 'item', 'rawmaterial', 'material', 'product', 'description', 'particulars'].includes(clean)) {
    return 'itemName';
  }
  if (['itemcode', 'code', 'sku', 'itemsku', 'inventorycode'].includes(clean)) {
    return 'itemCode';
  }
  if (['quantity', 'qty', 'amountqty', 'qnty', 'count'].includes(clean)) {
    return 'quantity';
  }
  if (['unit', 'uom', 'unitofmeasure', 'measure', 'baseunit'].includes(clean)) {
    return 'unit';
  }
  if (['unitrate', 'rate', 'price', 'unitprice', 'cost', 'purchaseprice', 'itemrate'].includes(clean)) {
    return 'rate';
  }
  if (['taxrate', 'taxratepct', 'taxratepercent', 'tax', 'taxpct', 'gst', 'gstpct', 'gstpercent', 'vat'].includes(clean)) {
    return 'taxRate';
  }
  if (['paidamount', 'paid', 'amountpaid', 'advancepaid', 'upfrontpayment', 'advance'].includes(clean)) {
    return 'paidAmount';
  }
  if (['paymentmethod', 'paymentmode', 'paymode', 'mode', 'payment', 'method'].includes(clean)) {
    return 'paymentMethod';
  }
  if (['notes', 'note', 'remarks', 'remark', 'comments', 'comment'].includes(clean)) {
    return 'notes';
  }

  return clean;
}

// Robust Date Normalizer
function parseExcelDate(val: any): string {
  const today = new Date().toISOString().split('T')[0];
  if (!val) return today;

  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, '0');
      const d = String(val.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return today;
  }

  if (typeof val === 'number') {
    // Excel Serial Number to JS Date
    const jsDate = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(jsDate.getTime())) {
      const y = jsDate.getFullYear();
      const m = String(jsDate.getMonth() + 1).padStart(2, '0');
      const d = String(jsDate.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return today;
  }

  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  
  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // MM/DD/YYYY or general parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return today;
}

// Parse Raw Excel Workbook data into validated Purchase Invoices
export function parsePurchasesFromWorkbook(
  workbook: XLSX.WorkBook,
  contextData: {
    existingSuppliers: Supplier[];
    locations: Location[];
    existingItems: InventoryItem[];
    existingPurchases: Purchase[];
  }
): ExcelParseResult {
  const { existingSuppliers, locations, existingItems, existingPurchases } = contextData;

  // Find the primary sheet (prefer one named 'purchase' or 'invoice', or fallback to the first sheet)
  let sheetName = workbook.SheetNames[0];
  const matchedSheet = workbook.SheetNames.find(s => 
    s.toLowerCase().includes('purchase') || s.toLowerCase().includes('invoice') || s.toLowerCase().includes('bill')
  );
  if (matchedSheet) {
    sheetName = matchedSheet;
  }

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error('No valid worksheet found in uploaded file.');
  }

  // Read as array of JSON objects with header row
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, {
    raw: false,
    defval: '',
  });

  if (rawRows.length === 0) {
    throw new Error('Uploaded sheet appears to be empty. Please verify data exists in the table.');
  }

  // Default Central Store Room
  const defaultLocation = locations.find(l => l.id === 'loc_stor_02') || locations[0];

  // Group raw rows by (Invoice Number + Supplier)
  const invoiceGroups = new Map<string, {
    invoiceNumber: string;
    invoiceDate: string;
    supplierName: string;
    receivingLocationStr: string;
    paidAmountStr: string;
    paymentMethodStr: string;
    notesStr: string;
    rawLines: Record<string, any>[];
  }>();

  rawRows.forEach((row, rowIndex) => {
    // Normalize headers
    const normalized: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) {
      const normKey = normalizeHeaderKey(key);
      normalized[normKey] = value;
    }

    const invNumRaw = String(normalized.invoiceNumber || '').trim();
    const supNameRaw = String(normalized.supplierName || '').trim();
    const itemNameRaw = String(normalized.itemName || '').trim();

    // Skip empty separator rows
    if (!invNumRaw && !supNameRaw && !itemNameRaw) {
      return;
    }

    // Auto-generate invoice number if missing but items exist
    const invNumber = invNumRaw || `INV-IMP-${rowIndex + 1}`;
    const supName = supNameRaw || 'General Vendor';

    const groupKey = `${invNumber.toLowerCase()}__${supName.toLowerCase()}`;

    if (!invoiceGroups.has(groupKey)) {
      invoiceGroups.set(groupKey, {
        invoiceNumber: invNumber,
        invoiceDate: parseExcelDate(normalized.invoiceDate),
        supplierName: supName,
        receivingLocationStr: String(normalized.receivingLocation || '').trim(),
        paidAmountStr: String(normalized.paidAmount || '0').trim(),
        paymentMethodStr: String(normalized.paymentMethod || '').trim(),
        notesStr: String(normalized.notes || '').trim(),
        rawLines: [],
      });
    }

    invoiceGroups.get(groupKey)!.rawLines.push(normalized);
  });

  const parsedInvoices: ParsedPurchaseInvoice[] = [];
  let totalInvoices = 0;
  let totalLineItems = 0;
  let totalValue = 0;
  let totalPaid = 0;
  let totalOutstanding = 0;
  let newSuppliersCount = 0;
  let newItemsCount = 0;
  let duplicateCount = 0;

  const seenNewSuppliers = new Set<string>();
  const seenNewItems = new Set<string>();

  invoiceGroups.forEach((group, index) => {
    const warnings: string[] = [];
    const errors: string[] = [];

    // 1. Resolve Supplier
    const trimmedSup = group.supplierName.trim();
    const matchedSup = existingSuppliers.find(
      s => s.name.trim().toLowerCase() === trimmedSup.toLowerCase() || s.id === trimmedSup
    );

    let supplierId: string | undefined = matchedSup?.id;
    let willAutoCreateSupplier = false;

    if (!matchedSup) {
      willAutoCreateSupplier = true;
      if (!seenNewSuppliers.has(trimmedSup.toLowerCase())) {
        seenNewSuppliers.add(trimmedSup.toLowerCase());
        newSuppliersCount++;
      }
      warnings.push(`New supplier "${trimmedSup}" will be automatically created in vendor registry.`);
    }

    // 2. Resolve Location
    const locStr = group.receivingLocationStr.toLowerCase();
    const matchedLoc = locations.find(
      l =>
        l.id.toLowerCase() === locStr ||
        l.code?.toLowerCase() === locStr ||
        l.name.toLowerCase().includes(locStr) ||
        locStr.includes(l.name.toLowerCase())
    ) || defaultLocation;

    const receivingLocationId = matchedLoc ? matchedLoc.id : 'loc_stor_02';
    const receivingLocationName = matchedLoc ? matchedLoc.name : 'Central Store Room';

    // 3. Check for Duplicate Invoices
    const isDuplicate = existingPurchases.some(
      p =>
        p.invoice_number.trim().toLowerCase() === group.invoiceNumber.trim().toLowerCase() &&
        (matchedSup ? p.supplier_id === matchedSup.id : true)
    );

    if (isDuplicate) {
      duplicateCount++;
      warnings.push(`Invoice #${group.invoiceNumber} already exists in records. Proceeding will add another record.`);
    }

    // 4. Parse Line Items
    let invoiceGross = 0;
    let invoiceTax = 0;
    const items: ParsedPurchaseItem[] = [];

    group.rawLines.forEach((line, lineIdx) => {
      const itmName = String(line.itemName || '').trim();
      const itmCode = String(line.itemCode || '').trim();

      if (!itmName && !itmCode) {
        errors.push(`Line ${lineIdx + 1}: Missing item name or code.`);
        return;
      }

      const qty = parseFloat(String(line.quantity || '0').replace(/[^0-9.-]/g, '')) || 0;
      const rate = parseFloat(String(line.rate || '0').replace(/[^0-9.-]/g, '')) || 0;
      const taxRate = parseFloat(String(line.taxRate || '0').replace(/[^0-9.-]/g, '')) || 0;
      const unit = String(line.unit || 'unit').trim().toLowerCase();

      if (qty <= 0) {
        errors.push(`Item "${itmName || itmCode}": Quantity must be greater than 0.`);
      }
      if (rate < 0) {
        errors.push(`Item "${itmName || itmCode}": Rate cannot be negative.`);
      }

      // Match item against existing inventory
      const matchedItem = existingItems.find(i => {
        if (itmCode && i.code && i.code.trim().toLowerCase() === itmCode.toLowerCase()) return true;
        if (itmName && i.name.trim().toLowerCase() === itmName.toLowerCase()) return true;
        return false;
      });

      let inventoryItemId: string | undefined = matchedItem?.id;
      let willAutoCreateItem = false;

      if (!matchedItem) {
        willAutoCreateItem = true;
        const itmKey = (itmCode || itmName).toLowerCase();
        if (!seenNewItems.has(itmKey)) {
          seenNewItems.add(itmKey);
          newItemsCount++;
        }
        warnings.push(`New Raw Material "${itmName || itmCode}" will be auto-created in Inventory.`);
      }

      const subtotal = Math.round(qty * rate * 100) / 100;
      const taxAmount = Math.round(((subtotal * taxRate) / 100) * 100) / 100;
      const itemTotal = subtotal + taxAmount;

      invoiceGross += subtotal;
      invoiceTax += taxAmount;

      items.push({
        itemName: matchedItem?.name || itmName || itmCode || 'Raw Material',
        itemCode: matchedItem?.code || itmCode || undefined,
        quantity: qty,
        unit: matchedItem?.base_unit || unit || 'unit',
        rate,
        taxRate,
        taxAmount,
        subtotal,
        totalAmount: itemTotal,
        inventoryItemId,
        willAutoCreateItem,
      });

      totalLineItems++;
    });

    const invoiceTotal = Math.round((invoiceGross + invoiceTax) * 100) / 100;
    const rawPaid = parseFloat(group.paidAmountStr.replace(/[^0-9.-]/g, '')) || 0;
    const paidAmount = Math.min(invoiceTotal, Math.max(0, rawPaid));
    const outstandingBalance = Math.max(0, invoiceTotal - paidAmount);

    let paymentMethod: 'bank_transfer' | 'cash' | 'upi' | 'cheque' = 'bank_transfer';
    const pmLower = group.paymentMethodStr.toLowerCase();
    if (pmLower.includes('cash')) paymentMethod = 'cash';
    else if (pmLower.includes('upi')) paymentMethod = 'upi';
    else if (pmLower.includes('cheque') || pmLower.includes('check')) paymentMethod = 'cheque';
    else paymentMethod = 'bank_transfer';

    const paymentStatus: 'paid' | 'partially_paid' | 'unpaid' =
      outstandingBalance === 0 ? 'paid' : paidAmount > 0 ? 'partially_paid' : 'unpaid';

    totalValue += invoiceTotal;
    totalPaid += paidAmount;
    totalOutstanding += outstandingBalance;
    totalInvoices++;

    parsedInvoices.push({
      id: `parsed_inv_${Date.now()}_${index}`,
      invoiceNumber: group.invoiceNumber,
      invoiceDate: group.invoiceDate,
      supplierName: trimmedSup,
      supplierId,
      willAutoCreateSupplier,
      receivingLocationName,
      receivingLocationId,
      items,
      totalGross: invoiceGross,
      totalTax: invoiceTax,
      totalAmount: invoiceTotal,
      paidAmount,
      outstandingBalance,
      paymentMethod,
      paymentStatus,
      notes: group.notesStr || undefined,
      warnings,
      errors,
      isValid: errors.length === 0 && items.length > 0,
      alreadyExistsInDb: isDuplicate,
    });
  });

  return {
    invoices: parsedInvoices,
    totalInvoices,
    totalLineItems,
    totalValue: Math.round(totalValue * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    newSuppliersCount,
    newItemsCount,
    duplicateCount,
    hasErrors: parsedInvoices.some(i => !i.isValid),
  };
}

// Generate & Download an official pre-formatted Excel template
export function downloadPurchaseTemplate(contextData: {
  suppliers: Supplier[];
  locations: Location[];
  items: InventoryItem[];
}) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Sample Invoices
  const sampleHeaders = [
    'Invoice Number',
    'Invoice Date (YYYY-MM-DD)',
    'Supplier Name',
    'Receiving Location',
    'Item Name',
    'Item Code',
    'Quantity',
    'Unit',
    'Unit Rate (₹)',
    'Tax Rate (%)',
    'Paid Amount (₹)',
    'Payment Method',
    'Notes',
  ];

  // Pick sample data from current DB or sensible defaults
  const sampleSup1 = contextData.suppliers[0]?.name || 'Metro Wholesale Bhopal';
  const sampleSup2 = contextData.suppliers[1]?.name || 'Amul Dairy Depot';
  const sampleLoc1 = contextData.locations.find(l => l.id === 'loc_stor_02')?.name || 'Central Store Room';
  const sampleLoc2 = contextData.locations.find(l => l.id !== 'loc_stor_02')?.name || 'Shahpura Street Outlet';

  const todayStr = new Date().toISOString().split('T')[0];

  const sampleRows = [
    // Invoice 1: Multi-line invoice (potatoes + onions)
    [
      'INV-2026-101',
      todayStr,
      sampleSup1,
      sampleLoc1,
      'Potatoes (Aloo)',
      'RAW-POTATO',
      100,
      'kg',
      25.0,
      0,
      2500.0,
      'bank_transfer',
      'Morning bulk raw vegetables batch',
    ],
    [
      'INV-2026-101',
      todayStr,
      sampleSup1,
      sampleLoc1,
      'Onions (Pyaaz)',
      'RAW-ONION',
      50,
      'kg',
      32.0,
      0,
      0,
      'bank_transfer',
      'Fresh red onions',
    ],
    // Invoice 2: Single-line invoice with GST and UPI payment
    [
      'INV-2026-102',
      todayStr,
      sampleSup2,
      sampleLoc2,
      'Amul Table Butter',
      'RAW-BUTTER',
      20,
      'kg',
      480.0,
      12,
      10752.0,
      'upi',
      'Butter bricks for pav bhaji and grilled sandwiches',
    ],
    // Invoice 3: Unpaid vendor bill (packaging supplies)
    [
      'INV-2026-103',
      todayStr,
      'Bhopal Eco Packagers',
      sampleLoc1,
      'Bio Disposable Plates',
      'PKG-PLATE-BIO',
      1500,
      'pc',
      1.8,
      18,
      0,
      'cheque',
      'Payment due in 15 days',
    ],
  ];

  const wsInvoices = XLSX.utils.aoa_to_sheet([sampleHeaders, ...sampleRows]);

  // Set column widths
  wsInvoices['!cols'] = [
    { wch: 16 }, // Invoice Number
    { wch: 22 }, // Date
    { wch: 25 }, // Supplier
    { wch: 24 }, // Location
    { wch: 24 }, // Item Name
    { wch: 14 }, // Item Code
    { wch: 10 }, // Qty
    { wch: 8 },  // Unit
    { wch: 14 }, // Rate
    { wch: 12 }, // Tax %
    { wch: 15 }, // Paid
    { wch: 16 }, // Pay Method
    { wch: 30 }, // Notes
  ];

  XLSX.utils.book_append_sheet(wb, wsInvoices, 'Purchase_Invoices');

  // Sheet 2: Reference Guide for copy-pasting
  const refRows: any[][] = [
    ['--- CHAAT KULTURE OS: MASTER DATA REFERENCE SHEET ---'],
    ['Use the exact names or codes below in your Excel sheet to link records accurately.'],
    [],
    ['=== RECEIVING LOCATIONS ==='],
    ['Location Name', 'Location Code', 'Type', 'Address'],
    ...contextData.locations.map(l => [l.name, l.code || l.id, l.type, l.address || '']),
    [],
    ['=== REGISTERED SUPPLIERS ==='],
    ['Supplier Name', 'Phone', 'GSTIN', 'Current Outstanding (₹)'],
    ...contextData.suppliers.map(s => [s.name, s.phone || '', s.gstin || '', s.current_outstanding || 0]),
    [],
    ['=== INVENTORY RAW MATERIALS & ITEMS ==='],
    ['Item Name', 'Item Code', 'Base Unit', 'Category'],
    ...contextData.items.slice(0, 50).map(i => [i.name, i.code || '', i.base_unit, i.category_type]),
    [],
    ['=== ACCEPTED PAYMENT METHODS ==='],
    ['cash', 'upi', 'bank_transfer', 'cheque'],
  ];

  const wsRef = XLSX.utils.aoa_to_sheet(refRows);
  wsRef['!cols'] = [
    { wch: 32 },
    { wch: 18 },
    { wch: 20 },
    { wch: 35 },
  ];

  XLSX.utils.book_append_sheet(wb, wsRef, 'Reference_Guide');

  // Download
  XLSX.writeFile(wb, 'chaat_kulture_purchase_template.xlsx');
}
