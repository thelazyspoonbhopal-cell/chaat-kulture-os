import * as XLSX from 'xlsx';
import React, { useState, useRef } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sparkles,
  ArrowRight,
  Info,
} from 'lucide-react';
import {
  parseMenuExcelFile,
  downloadMenuExcelTemplate,
  type MenuExcelParseResult,
  type ParsedMenuItemRow,
} from '../../lib/excel/menuExcelParser';
import { menuRepo } from '../../lib/dal/menuRepo';
import type { MenuCategory, MenuItem } from '../../types';

interface MenuExcelUploaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: MenuCategory[];
  items: MenuItem[];
  onImportComplete: () => Promise<void>;
  showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const MenuExcelUploaderModal: React.FC<MenuExcelUploaderModalProps> = ({
  isOpen,
  onClose,
  categories,
  items,
  onImportComplete,
  showToast,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [parseResult, setParseResult] = useState<MenuExcelParseResult | null>(null);

  const resetState = () => {
    setFileName('');
    setParseResult(null);
    setIsProcessing(false);
    setIsImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      showToast('Please upload an Excel (.xlsx, .xls) or CSV (.csv) file', 'error');
      return;
    }

    setFileName(file.name);
    setIsProcessing(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const result = parseMenuExcelFile(workbook, categories, items);
      setParseResult(result);

      if (result.hasErrors) {
        showToast(
          `Processed with issues: ${result.errorRows} errors found across ${result.totalRows} rows.`,
          'warning'
        );
      } else {
        showToast(
          `Successfully verified ${result.validRows} dishes ready for import!`,
          'success'
        );
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to parse Excel file', 'error');
      setParseResult(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!parseResult || parseResult.validRows === 0) return;

    setIsImporting(true);
    try {
      // 1. Create missing categories
      const categoryMap = new Map<string, string>();
      categories.forEach(c => categoryMap.set(c.name.trim().toLowerCase(), c.id));

      for (const catName of parseResult.newCategories) {
        const lower = catName.trim().toLowerCase();
        if (!categoryMap.has(lower)) {
          const created = await menuRepo.addCategory(catName);
          categoryMap.set(lower, created.id);
        }
      }

      // 2. Prepare and import valid menu items
      const existingItemsByCode = new Map<string, MenuItem>();
      const existingItemsByName = new Map<string, MenuItem>();
      items.forEach(i => {
        if (i.code) existingItemsByCode.set(i.code.trim().toLowerCase(), i);
        existingItemsByName.set(i.name.trim().toLowerCase(), i);
      });

      const validItems = parseResult.items.filter(r => r.isValid);
      let createdCount = 0;
      let updatedCount = 0;

      for (const row of validItems) {
        const catId =
          categoryMap.get(row.categoryName.trim().toLowerCase()) ||
          categories[0]?.id ||
          'mcat_chaat';

        const codeLower = row.code.trim().toLowerCase();
        const existing =
          existingItemsByCode.get(codeLower) ||
          existingItemsByName.get(row.name.trim().toLowerCase());

        if (existing) {
          await menuRepo.updateMenuItem(existing.id, {
            name: row.name,
            code: row.code,
            category_id: catId,
            base_price: row.basePrice,
            tax_rate: row.taxRate,
            is_tax_inclusive: row.isTaxInclusive,
            channel_prices: {
              walk_in: row.basePrice,
              zomato: row.zomatoPrice,
              swiggy: row.swiggyPrice,
            },
            description: row.description,
          });
          updatedCount++;
        } else {
          await menuRepo.addMenuItem({
            business_id: 'biz_chaatkulture_01',
            name: row.name,
            code: row.code,
            category_id: catId,
            base_price: row.basePrice,
            tax_rate: row.taxRate,
            is_tax_inclusive: row.isTaxInclusive,
            channel_prices: {
              walk_in: row.basePrice,
              zomato: row.zomatoPrice,
              swiggy: row.swiggyPrice,
            },
            description: row.description,
            is_available: true,
            sort_order: items.length + createdCount + 1,
          });
          createdCount++;
        }
      }

      // 3. Immediately trigger cloud sync to push all menu items to GitHub Gist
      await menuRepo.syncMenuToCloud();

      showToast(
        `Successfully imported ${createdCount} new dishes and updated ${updatedCount} existing dishes! Synced to cloud.`,
        'success'
      );

      await onImportComplete();
      resetState();
      onClose();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to import menu items', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        resetState();
        onClose();
      }}
      title="Upload Menu Dishes & Pricing by Excel"
      maxWidth="xl"
    >
      <div className="space-y-6">
        {/* Banner with Download Template */}
        <div className="bg-gradient-to-r from-orange-950/40 via-slate-900 to-slate-900 border border-orange-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Bulk Upload Menu via Spreadsheet</span>
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                  Cloud Synced
                </span>
              </h4>
              <p className="text-xs text-slate-400">
                Upload your menu with dishes, categories, base prices, GST rates, and channel delivery pricing.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={downloadMenuExcelTemplate}
            className="shrink-0 flex items-center gap-1.5 text-xs text-orange-400 border-orange-500/30 hover:bg-orange-500/10"
          >
            <Download className="w-4 h-4" />
            <span>Download Sample Template</span>
          </Button>
        </div>

        {/* Upload Drop Zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
            fileName
              ? 'border-orange-500/50 bg-orange-950/10'
              : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-900/40'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-orange-400">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                {fileName ? fileName : 'Click to select or drop menu spreadsheet (.xlsx, .xls, .csv)'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically detects column headers, auto-generates item codes, and syncs across all devices
              </p>
            </div>
            {isProcessing && (
              <div className="flex items-center gap-2 text-xs text-orange-400 mt-2 font-medium">
                <div className="w-3.5 h-3.5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                <span>Reading and validating spreadsheet dishes...</span>
              </div>
            )}
          </div>
        </div>

        {/* Verification Summary */}
        {parseResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
                <span className="text-[11px] font-medium text-slate-400">Total Rows</span>
                <p className="text-lg font-bold text-white mt-0.5">{parseResult.totalRows}</p>
              </div>

              <div className="bg-slate-950/60 border border-emerald-500/20 p-3 rounded-xl">
                <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Valid Dishes
                </span>
                <p className="text-lg font-bold text-emerald-400 mt-0.5">{parseResult.validRows}</p>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
                <span className="text-[11px] font-medium text-amber-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> New Categories
                </span>
                <p className="text-lg font-bold text-amber-300 mt-0.5">
                  {parseResult.newCategories.length}
                </p>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
                <span className="text-[11px] font-medium text-sky-400">Update Existing</span>
                <p className="text-lg font-bold text-sky-300 mt-0.5">
                  {parseResult.existingDuplicates}
                </p>
              </div>
            </div>

            {/* Dishes Preview List */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                <h5 className="text-xs font-bold text-white tracking-wide uppercase">
                  Menu Items Preview ({parseResult.items.length})
                </h5>
                <span className="text-xs text-slate-400">
                  {parseResult.validRows} valid &bull; {parseResult.errorRows} errors
                </span>
              </div>

              <div className="max-h-64 overflow-y-auto divide-y divide-slate-850 text-xs">
                {parseResult.items.map((row, idx) => (
                  <div
                    key={idx}
                    className={`p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                      !row.isValid ? 'bg-rose-950/20' : 'hover:bg-slate-900/40'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {row.code}
                        </span>
                        <span className="font-bold text-white text-xs">{row.name}</span>
                        <Badge variant="default" size="sm">
                          {row.categoryName}
                        </Badge>
                        {row.willAutoCreateCategory && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            +New Category
                          </span>
                        )}
                        {row.alreadyExistsInDb && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                            Update
                          </span>
                        )}
                      </div>

                      {/* Pricing pills */}
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                        <span>
                          Base: <strong className="text-white">₹{row.basePrice}</strong>
                        </span>
                        <span>
                          GST: <strong className="text-slate-300">{row.taxRate}%</strong> ({row.isTaxInclusive ? 'Incl' : 'Excl'})
                        </span>
                        {row.zomatoPrice && (
                          <span>
                            Zomato: <strong className="text-rose-400">₹{row.zomatoPrice}</strong>
                          </span>
                        )}
                        {row.swiggyPrice && (
                          <span>
                            Swiggy: <strong className="text-amber-400">₹{row.swiggyPrice}</strong>
                          </span>
                        )}
                      </div>

                      {/* Warnings / Errors */}
                      {row.errors.length > 0 && (
                        <p className="text-[11px] text-rose-400 font-medium flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5 shrink-0" />
                          {row.errors.join('; ')}
                        </p>
                      )}
                      {row.warnings.length > 0 && row.errors.length === 0 && (
                        <p className="text-[11px] text-amber-400 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          {row.warnings.join('; ')}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {row.isValid ? (
                        <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Ready
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-rose-400 flex items-center gap-1">
                          <XCircle className="w-4 h-4" /> Error
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              resetState();
              onClose();
            }}
          >
            Cancel
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleConfirmImport}
            disabled={!parseResult || parseResult.validRows === 0 || isImporting}
            className="flex items-center gap-2"
          >
            {isImporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Importing & Syncing to Cloud...</span>
              </>
            ) : (
              <>
                <span>Import {parseResult ? `${parseResult.validRows} Dishes` : 'Dishes'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
