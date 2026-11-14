import * as XLSX from 'xlsx';
import type { MenuCategory, MenuItem } from '../../types';

export interface ParsedMenuItemRow {
  rowIndex: number;
  name: string;
  code: string;
  categoryName: string;
  basePrice: number;
  taxRate: number;
  isTaxInclusive: boolean;
  zomatoPrice?: number;
  swiggyPrice?: number;
  description?: string;
  willAutoCreateCategory?: boolean;
  warnings: string[];
  errors: string[];
  isValid: boolean;
  alreadyExistsInDb?: boolean;
}

export interface MenuExcelParseResult {
  items: ParsedMenuItemRow[];
  totalRows: number;
  validRows: number;
  errorRows: number;
  newCategories: string[];
  existingDuplicates: number;
  hasErrors: boolean;
}

// Clean and normalize keys from messy Excel headers
function normalizeHeaderKey(rawHeader: string): string {
  const clean = rawHeader.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (['dishname', 'itemname', 'name', 'dish', 'item', 'title', 'particulars', 'menuitem'].includes(clean)) {
    return 'name';
  }
  if (['category', 'categoryname', 'cat', 'menucategory', 'group', 'section', 'type'].includes(clean)) {
    return 'category';
  }
  if (['itemcode', 'code', 'dishcode', 'sku', 'itemsku', 'itemid', 'dishid', 'shortcode'].includes(clean)) {
    return 'code';
  }
  if (['baseprice', 'price', 'rate', 'sellingprice', 'dineinprice', 'walkinprice', 'cost', 'mrp', 'amount'].includes(clean)) {
    return 'basePrice';
  }
  if (['taxrate', 'gstrate', 'gst', 'tax', 'gstpercentage', 'taxpercentage', 'gstpercent', 'taxpercent'].includes(clean)) {
    return 'taxRate';
  }
  if (['taxinclusive', 'istaxinclusive', 'taxtype', 'inclusive', 'gstinclusive'].includes(clean)) {
    return 'isTaxInclusive';
  }
  if (['zomatoprice', 'zomatorate', 'zomato', 'deliveryzomato'].includes(clean)) {
    return 'zomatoPrice';
  }
  if (['swiggyprice', 'swiggyrate', 'swiggy', 'deliveryswiggy'].includes(clean)) {
    return 'swiggyPrice';
  }
  if (['description', 'desc', 'details', 'itemdescription', 'notes', 'ingredients'].includes(clean)) {
    return 'description';
  }

  return clean;
}

export function parseMenuExcelFile(
  workbook: XLSX.WorkBook,
  existingCategories: MenuCategory[],
  existingItems: MenuItem[]
): MenuExcelParseResult {
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error('Excel workbook contains no readable sheets.');
  }

  // Parse rows as raw objects with header mapping
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, {
    raw: false,
    defval: '',
  });

  if (!rawRows || rawRows.length === 0) {
    throw new Error('The uploaded spreadsheet contains no data rows.');
  }

  // Map of existing names and codes for duplicate detection
  const existingCodeMap = new Map<string, MenuItem>();
  const existingNameMap = new Map<string, MenuItem>();
  existingItems.forEach(i => {
    if (i.code) existingCodeMap.set(i.code.trim().toLowerCase(), i);
    existingNameMap.set(i.name.trim().toLowerCase(), i);
  });

  const existingCategoryNames = new Set(
    existingCategories.map(c => c.name.trim().toLowerCase())
  );

  const seenCodesInFile = new Set<string>();
  const discoveredNewCategories = new Set<string>();
  const parsedRows: ParsedMenuItemRow[] = [];
  let existingDuplicatesCount = 0;

  rawRows.forEach((row, index) => {
    const rowNum = index + 2; // Excel row numbering (header = row 1)

    // Normalize keys in row
    const normalizedRow: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) {
      const cleanKey = normalizeHeaderKey(key);
      normalizedRow[cleanKey] = typeof value === 'string' ? value.trim() : value;
    }

    const name = String(normalizedRow['name'] || '').trim();
    let code = String(normalizedRow['code'] || '').trim().toUpperCase();
    let categoryName = String(normalizedRow['category'] || '').trim();
    const rawPrice = normalizedRow['basePrice'];
    const rawTaxRate = normalizedRow['taxRate'];
    const rawTaxInc = normalizedRow['isTaxInclusive'];
    const rawZomato = normalizedRow['zomatoPrice'];
    const rawSwiggy = normalizedRow['swiggyPrice'];
    const description = String(normalizedRow['description'] || '').trim();

    // If completely blank row, skip
    if (!name && !code && !rawPrice && !categoryName) {
      return;
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Validation 1: Item Name
    if (!name) {
      errors.push('Dish name is required');
    }

    // Default category if missing
    if (!categoryName) {
      categoryName = 'Chaat & Street Food';
      warnings.push('Category missing; defaulted to "Chaat & Street Food"');
    }

    // Check if category exists or will be created
    const catLower = categoryName.toLowerCase();
    const willAutoCreateCategory = !existingCategoryNames.has(catLower);
    if (willAutoCreateCategory) {
      discoveredNewCategories.add(categoryName);
    }

    // Validation 2: Price
    let basePrice = 0;
    if (rawPrice !== undefined && rawPrice !== '') {
      const parsed = parseFloat(String(rawPrice).replace(/[^0-9.-]/g, ''));
      if (isNaN(parsed) || parsed < 0) {
        errors.push(`Invalid price "${rawPrice}"`);
      } else {
        basePrice = Math.round(parsed * 100) / 100;
      }
    } else {
      errors.push('Base price is required');
    }

    // Tax rate (default 5.0%)
    let taxRate = 5.0;
    if (rawTaxRate !== undefined && rawTaxRate !== '') {
      const parsedTax = parseFloat(String(rawTaxRate).replace(/[^0-9.-]/g, ''));
      if (!isNaN(parsedTax) && parsedTax >= 0) {
        taxRate = parsedTax;
      }
    }

    // Tax inclusive (default true)
    let isTaxInclusive = true;
    if (rawTaxInc !== undefined && rawTaxInc !== '') {
      const lower = String(rawTaxInc).toLowerCase();
      if (lower === 'false' || lower === 'exclusive' || lower === 'no' || lower === 'excl') {
        isTaxInclusive = false;
      }
    }

    // Channel prices
    let zomatoPrice: number | undefined = undefined;
    if (rawZomato !== undefined && rawZomato !== '') {
      const parsedZ = parseFloat(String(rawZomato).replace(/[^0-9.-]/g, ''));
      if (!isNaN(parsedZ) && parsedZ > 0) zomatoPrice = parsedZ;
    }

    let swiggyPrice: number | undefined = undefined;
    if (rawSwiggy !== undefined && rawSwiggy !== '') {
      const parsedS = parseFloat(String(rawSwiggy).replace(/[^0-9.-]/g, ''));
      if (!isNaN(parsedS) && parsedS > 0) swiggyPrice = parsedS;
    }

    // Generate code if missing
    if (!code && name) {
      const words = name.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(Boolean);
      const prefix = words.map(w => w[0].toUpperCase()).join('').slice(0, 3) || 'DS';
      let candidate = `${prefix}-${String(rowNum - 1).padStart(2, '0')}`;
      let counter = rowNum;
      while (
        existingCodeMap.has(candidate.toLowerCase()) ||
        seenCodesInFile.has(candidate.toLowerCase())
      ) {
        candidate = `${prefix}-${String(counter++).padStart(2, '0')}`;
      }
      code = candidate;
      warnings.push(`Item code auto-generated: ${code}`);
    }

    // Duplicate checks
    const codeLower = code.toLowerCase();
    if (seenCodesInFile.has(codeLower)) {
      errors.push(`Duplicate item code "${code}" repeated within this file`);
    } else if (codeLower) {
      seenCodesInFile.add(codeLower);
    }

    const alreadyExistsInDb = existingCodeMap.has(codeLower) || existingNameMap.has(name.toLowerCase());
    if (alreadyExistsInDb) {
      existingDuplicatesCount++;
      warnings.push(`Matches existing dish in database ("${code}"). Existing item will be updated.`);
    }

    parsedRows.push({
      rowIndex: rowNum,
      name,
      code,
      categoryName,
      basePrice,
      taxRate,
      isTaxInclusive,
      zomatoPrice,
      swiggyPrice,
      description: description || undefined,
      willAutoCreateCategory,
      warnings,
      errors,
      isValid: errors.length === 0,
      alreadyExistsInDb,
    });
  });

  const validRows = parsedRows.filter(r => r.isValid).length;
  const errorRows = parsedRows.filter(r => !r.isValid).length;

  return {
    items: parsedRows,
    totalRows: parsedRows.length,
    validRows,
    errorRows,
    newCategories: Array.from(discoveredNewCategories),
    existingDuplicates: existingDuplicatesCount,
    hasErrors: errorRows > 0,
  };
}

/**
 * Generate and trigger download of a pre-formatted Excel template for menu items
 */
export function downloadMenuExcelTemplate() {
  const sampleData = [
    {
      'Dish Name': 'Special Butter Pav Bhaji',
      'Category': 'Pav & Breads',
      'Item Code': 'PB-01',
      'Base Price': 120,
      'GST Rate (%)': 5,
      'Tax Type (Inclusive/Exclusive)': 'Inclusive',
      'Zomato Price': 140,
      'Swiggy Price': 140,
      'Description': 'Authentic buttery Mumbai style Pav Bhaji served with 2 toasted pavs and onions',
    },
    {
      'Dish Name': 'Amritsari Chole Bhature',
      'Category': 'Pav & Breads',
      'Item Code': 'CB-01',
      'Base Price': 140,
      'GST Rate (%)': 5,
      'Tax Type (Inclusive/Exclusive)': 'Inclusive',
      'Zomato Price': 165,
      'Swiggy Price': 165,
      'Description': 'Rich spiced chickpeas served with two fluffy golden bhature and pickle',
    },
    {
      'Dish Name': 'Mumbai Sev Puri',
      'Category': 'Chaat & Street Food',
      'Item Code': 'SP-01',
      'Base Price': 80,
      'GST Rate (%)': 5,
      'Tax Type (Inclusive/Exclusive)': 'Inclusive',
      'Zomato Price': 95,
      'Swiggy Price': 95,
      'Description': 'Crisp puris loaded with potatoes, tangy chutneys, and fine nylon sev',
    },
    {
      'Dish Name': 'Dahi Papdi Chaat',
      'Category': 'Chaat & Street Food',
      'Item Code': 'DC-01',
      'Base Price': 90,
      'GST Rate (%)': 5,
      'Tax Type (Inclusive/Exclusive)': 'Inclusive',
      'Zomato Price': 105,
      'Swiggy Price': 105,
      'Description': 'Crisp papdi wafers topped with chilled spiced curd and saunth',
    },
    {
      'Dish Name': 'Crispy Pani Puri (6 Pcs)',
      'Category': 'Chaat & Street Food',
      'Item Code': 'PP-01',
      'Base Price': 50,
      'GST Rate (%)': 5,
      'Tax Type (Inclusive/Exclusive)': 'Inclusive',
      'Zomato Price': 65,
      'Swiggy Price': 65,
      'Description': 'Classic semolina puris with spicy mint water and tangy hing water',
    },
    {
      'Dish Name': 'Spiced Masala Chaas',
      'Category': 'Beverages & Drinks',
      'Item Code': 'MC-01',
      'Base Price': 40,
      'GST Rate (%)': 5,
      'Tax Type (Inclusive/Exclusive)': 'Inclusive',
      'Zomato Price': 50,
      'Swiggy Price': 50,
      'Description': 'Refreshing traditional buttermilk tempered with roasted cumin and mint',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 28 }, // Dish Name
    { wch: 20 }, // Category
    { wch: 12 }, // Item Code
    { wch: 12 }, // Base Price
    { wch: 14 }, // GST Rate
    { wch: 28 }, // Tax Type
    { wch: 14 }, // Zomato Price
    { wch: 14 }, // Swiggy Price
    { wch: 45 }, // Description
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Menu Template');

  XLSX.writeFile(workbook, 'Chaat_Kulture_Menu_Upload_Template.xlsx');
}
