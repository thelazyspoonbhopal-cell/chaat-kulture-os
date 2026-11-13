import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  FileSpreadsheet,
  UploadCloud,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Receipt,
  Boxes,
  Building2,
  MapPin,
  CreditCard,
  Calendar,
  Layers,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import {
  parsePurchasesFromWorkbook,
  downloadPurchaseTemplate,
  type ParsedPurchaseInvoice,
  type ExcelParseResult,
} from '../../lib/excel/purchaseExcelParser';
import { purchasesRepo } from '../../lib/dal/purchasesRepo';
import { suppliersRepo } from '../../lib/dal/suppliersRepo';
import { inventoryRepo } from '../../lib/dal/inventoryRepo';
import { db } from '../../lib/db';
import type { Supplier, Location, InventoryItem, Purchase } from '../../types';

interface PurchaseExcelUploaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  locations: Location[];
  inventoryItems: InventoryItem[];
  purchases: Purchase[];
  onSuccess: () => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const PurchaseExcelUploaderModal: React.FC<PurchaseExcelUploaderModalProps> = ({
  isOpen,
  onClose,
  suppliers,
  locations,
  inventoryItems,
  purchases,
  onSuccess,
  showToast,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>('');
  const [parseResult, setParseResult] = useState<ExcelParseResult | null>(null);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>('');

  const handleDownloadTemplate = () => {
    try {
      downloadPurchaseTemplate({
        suppliers,
        locations,
        items: inventoryItems,
      });
      showToast('Official Chaat Kulture Purchase Template downloaded!', 'success');
    } catch (err: any) {
      console.error(err);
      showToast('Error generating template: ' + (err.message || 'Unknown error'), 'error');
    }
  };

  const processFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      showToast('Please upload an Excel (.xlsx, .xls) or CSV file.', 'warning');
      return;
    }

    setFileName(file.name);
    setIsProcessing(true);
    setProgressText('Reading spreadsheet data...');

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

      const result = parsePurchasesFromWorkbook(workbook, {
        existingSuppliers: suppliers,
        locations,
        existingItems: inventoryItems,
        existingPurchases: purchases,
      });

      setParseResult(result);
      if (result.invoices.length > 0) {
        setExpandedInvoiceId(result.invoices[0].id);
      }
      showToast(`Spreadsheet parsed: Found ${result.totalInvoices} invoice(s) with ${result.totalLineItems} item line(s).`, 'info');
    } catch (err: any) {
      console.error(err);
      setParseResult(null);
      showToast(err.message || 'Failed to parse spreadsheet file.', 'error');
    } finally {
      setIsProcessing(false);
      setProgressText('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleReset = () => {
    setFileName('');
    setParseResult(null);
    setExpandedInvoiceId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Commit all parsed purchases to Dexie DB
  const handleCommitPurchases = async () => {
    if (!parseResult || parseResult.invoices.length === 0) return;

    if (parseResult.hasErrors) {
      showToast('Please resolve validation errors in the sheet before inwarding.', 'error');
      return;
    }

    setIsProcessing(true);
    let createdCount = 0;

    try {
      // 1. Auto-create new suppliers if needed
      const supplierMap = new Map<string, string>(); // supplierName -> supplierId
      suppliers.forEach(s => supplierMap.set(s.name.trim().toLowerCase(), s.id));

      setProgressText('Checking and registering suppliers...');
      for (const inv of parseResult.invoices) {
        const supKey = inv.supplierName.trim().toLowerCase();
        if (!supplierMap.has(supKey)) {
          const newSup = await suppliersRepo.add({
            business_id: 'biz_chaatkulture_01',
            name: inv.supplierName.trim(),
            phone: '9826000000',
            opening_balance: 0,
            is_active: true,
            notes: 'Auto-registered via Excel Purchase Import',
          });
          supplierMap.set(supKey, newSup.id);
        }
      }

      // 2. Auto-create new inventory raw materials if needed
      const itemMap = new Map<string, InventoryItem>(); // key -> item
      inventoryItems.forEach(i => {
        if (i.code) itemMap.set(i.code.trim().toLowerCase(), i);
        itemMap.set(i.name.trim().toLowerCase(), i);
      });

      setProgressText('Verifying inventory catalog items...');
      for (const inv of parseResult.invoices) {
        for (const item of inv.items) {
          const itmCodeKey = item.itemCode ? item.itemCode.trim().toLowerCase() : '';
          const itmNameKey = item.itemName.trim().toLowerCase();

          let resolvedItem = (itmCodeKey && itemMap.get(itmCodeKey)) || itemMap.get(itmNameKey);

          if (!resolvedItem) {
            const newItem = await inventoryRepo.addItem({
              business_id: 'biz_chaatkulture_01',
              category_id: 'invcat_raw',
              name: item.itemName.trim(),
              code: item.itemCode ? item.itemCode.trim() : undefined,
              category_type: 'raw_material',
              base_unit: item.unit || 'unit',
              min_stock_alert: 10,
              cost_per_unit: item.rate,
              is_active: true,
              notes: 'Auto-created via Excel Purchase Import',
            });
            resolvedItem = newItem;
            if (newItem.code) itemMap.set(newItem.code.trim().toLowerCase(), newItem);
            itemMap.set(newItem.name.trim().toLowerCase(), newItem);
          }

          item.inventoryItemId = resolvedItem.id;
        }
      }

      // 3. Create all Purchase Invoices, auto-inward stock, and log ledgers
      setProgressText('Inwarding stock batches & creating purchase invoices...');
      for (const inv of parseResult.invoices) {
        const resolvedSupId = supplierMap.get(inv.supplierName.trim().toLowerCase()) || suppliers[0]?.id || 'sup_general';

        await purchasesRepo.createPurchase({
          business_id: 'biz_chaatkulture_01',
          supplier_id: resolvedSupId,
          receiving_location_id: inv.receivingLocationId,
          invoice_number: inv.invoiceNumber,
          invoice_date: inv.invoiceDate,
          paid_amount: inv.paidAmount,
          payment_method: inv.paymentMethod,
          notes: inv.notes || 'Imported via Excel Bulk Upload',
          created_by: 'Excel Import Assistant',
          items: inv.items.map(it => ({
            inventory_item_id: it.inventoryItemId || 'inv_raw',
            item_name: it.itemName,
            quantity: it.quantity,
            unit: it.unit,
            rate: it.rate,
            tax_amount: it.taxAmount,
            total_amount: it.totalAmount,
          })),
        });

        createdCount++;
      }

      showToast(`Successfully recorded and inwarded ${createdCount} purchase invoice(s)! Stock updated in store room.`, 'success');
      await onSuccess();
      handleReset();
      onClose();
    } catch (err: any) {
      console.error(err);
      showToast('Error recording purchases: ' + (err.message || 'Unknown database error'), 'error');
    } finally {
      setIsProcessing(false);
      setProgressText('');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isProcessing) {
          handleReset();
          onClose();
        }
      }}
      title="Upload Purchases by Excel / CSV"
      subtitle="Bulk inward vendor invoices, auto-update raw material inventory, and sync payables"
      maxWidth="4xl"
    >
      <div className="space-y-5">
        {/* Top Template & Instructions Banner */}
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-inner">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-400" />
              <span className="text-xs font-bold text-white">Smart Excel & CSV Importer</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-orange-950/80 text-orange-400 border border-orange-800 font-mono">
                Multi-Item Enabled
              </span>
            </div>
            <p className="text-[11px] text-slate-400 max-w-xl leading-relaxed">
              Rows with the same <strong>Invoice Number</strong> are automatically bundled into a single itemized bill. New vendors and raw materials are auto-registered if they don’t already exist!
            </p>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleDownloadTemplate}
            className="shrink-0 bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200 text-xs shadow-md"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400 mr-1.5" />
            <span>Download Sample Template</span>
          </Button>
        </div>

        {/* File Dropzone (shown when no result or resetting) */}
        {!parseResult && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-orange-500 bg-orange-950/20'
                : 'border-slate-700/80 hover:border-orange-500/50 hover:bg-slate-900/50 bg-slate-950/40'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />

            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-orange-600/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
                <FileSpreadsheet className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">
                  {fileName ? fileName : 'Choose an Excel file or drag & drop here'}
                </h4>
                <p className="text-xs text-slate-400">
                  Supports Microsoft Excel (<strong>.xlsx</strong>, <strong>.xls</strong>) and <strong>.csv</strong> spreadsheets
                </p>
              </div>
              <Button type="button" variant="primary" size="sm" className="pointer-events-none text-xs">
                <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
                <span>Browse File from Computer</span>
              </Button>
            </div>
          </div>
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="p-4 bg-orange-950/30 border border-orange-800/60 rounded-2xl flex items-center gap-3 animate-pulse">
            <RefreshCw className="w-5 h-5 text-orange-400 animate-spin shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-orange-300">Processing Purchases...</span>
              <p className="text-slate-400 text-[11px] mt-0.5">{progressText || 'Updating records...'}</p>
            </div>
          </div>
        )}

        {/* Parsed Results Preview */}
        {parseResult && (
          <div className="space-y-4">
            {/* KPI Summary Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Invoices</div>
                <div className="text-base font-black text-white mt-1 flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-orange-400" />
                  <span>{parseResult.totalInvoices}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total Items</div>
                <div className="text-base font-black text-white mt-1 flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-blue-400" />
                  <span>{parseResult.totalLineItems}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total Value</div>
                <div className="text-base font-black text-emerald-400 mt-1 font-mono">
                  ₹{parseResult.totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Paid Upfront</div>
                <div className="text-base font-black text-teal-400 mt-1 font-mono">
                  ₹{parseResult.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl col-span-2 sm:col-span-1">
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Payables Due</div>
                <div className="text-base font-black text-amber-400 mt-1 font-mono">
                  ₹{parseResult.totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Smart Detection Highlights */}
            <div className="flex flex-wrap gap-2 text-xs">
              {parseResult.newSuppliersCount > 0 && (
                <div className="px-3 py-1.5 bg-blue-950/40 border border-blue-800/60 rounded-xl text-blue-300 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>
                    <strong>{parseResult.newSuppliersCount}</strong> New Supplier(s) will be auto-registered
                  </span>
                </div>
              )}

              {parseResult.newItemsCount > 0 && (
                <div className="px-3 py-1.5 bg-indigo-950/40 border border-indigo-800/60 rounded-xl text-indigo-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span>
                    <strong>{parseResult.newItemsCount}</strong> New Raw Material(s) will be auto-cataloged
                  </span>
                </div>
              )}

              {parseResult.duplicateCount > 0 && (
                <div className="px-3 py-1.5 bg-amber-950/40 border border-amber-800/60 rounded-xl text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    <strong>{parseResult.duplicateCount}</strong> Existing invoice number(s) detected
                  </span>
                </div>
              )}

              {parseResult.hasErrors && (
                <div className="px-3 py-1.5 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Validation errors detected! Please review red entries below.</span>
                </div>
              )}
            </div>

            {/* Invoices Detailed Accordion List */}
            <div className="space-y-3 max-h-[42vh] overflow-y-auto pr-1">
              {parseResult.invoices.map((inv, idx) => {
                const isExpanded = expandedInvoiceId === inv.id;

                return (
                  <div
                    key={inv.id}
                    className={`border rounded-2xl overflow-hidden transition-all ${
                      !inv.isValid
                        ? 'bg-rose-950/20 border-rose-800/70'
                        : inv.alreadyExistsInDb
                        ? 'bg-slate-900 border-amber-800/60'
                        : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    {/* Invoice Card Header */}
                    <div
                      onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id)}
                      className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-800/50 transition-colors select-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-orange-950/60 border border-orange-800/50 flex items-center justify-center text-orange-400 font-mono font-bold text-xs">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-white text-xs">
                              {inv.invoiceNumber}
                            </span>
                            <span className="text-[11px] text-slate-400 font-medium">
                              • {inv.supplierName}
                            </span>
                            {inv.willAutoCreateSupplier && (
                              <Badge variant="info" className="text-[9px] px-1.5 py-0">
                                New Vendor
                              </Badge>
                            )}
                            {inv.alreadyExistsInDb && (
                              <Badge variant="warning" className="text-[9px] px-1.5 py-0">
                                Duplicate Invoice #
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-500" />
                              {inv.invoiceDate}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-500" />
                              {inv.receivingLocationName}
                            </span>
                            <span>{inv.items.length} item(s)</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-mono font-bold text-emerald-400 text-xs">
                            ₹{inv.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {inv.paymentStatus === 'paid' ? (
                              <span className="text-teal-400 font-semibold">Fully Paid</span>
                            ) : inv.paymentStatus === 'partially_paid' ? (
                              <span className="text-amber-400 font-semibold">
                                Paid ₹{inv.paidAmount} | Due ₹{inv.outstandingBalance}
                              </span>
                            ) : (
                              <span className="text-rose-400 font-semibold">Unpaid Dues</span>
                            )}
                          </div>
                        </div>

                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {/* Invoice Itemized Breakdown Drawer */}
                    {isExpanded && (
                      <div className="p-3.5 bg-slate-950/70 border-t border-slate-800 space-y-3">
                        {/* Warnings / Errors */}
                        {inv.errors.length > 0 && (
                          <div className="p-2.5 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs space-y-1">
                            {inv.errors.map((err, eIdx) => (
                              <div key={eIdx} className="flex items-center gap-1.5">
                                <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                <span>{err}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {inv.warnings.length > 0 && (
                          <div className="p-2 bg-amber-950/30 border border-amber-800/50 rounded-xl text-amber-300 text-[11px] space-y-0.5">
                            {inv.warnings.map((w, wIdx) => (
                              <div key={wIdx} className="flex items-center gap-1.5">
                                <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                                <span>{w}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Items Table */}
                        <div className="overflow-x-auto rounded-xl border border-slate-800">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-900 text-slate-400 font-semibold uppercase text-[10px]">
                              <tr>
                                <th className="py-2 px-3">Item / Material</th>
                                <th className="py-2 px-3">Code</th>
                                <th className="py-2 px-3 text-right">Quantity</th>
                                <th className="py-2 px-3 text-right">Rate</th>
                                <th className="py-2 px-3 text-right">Tax (%)</th>
                                <th className="py-2 px-3 text-right">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 text-slate-200">
                              {inv.items.map((it, itIdx) => (
                                <tr key={itIdx} className="hover:bg-slate-900/40">
                                  <td className="py-2 px-3">
                                    <div className="font-semibold text-white flex items-center gap-1.5">
                                      <span>{it.itemName}</span>
                                      {it.willAutoCreateItem && (
                                        <Badge variant="outline" className="text-[8px] px-1 py-0 bg-slate-800 text-slate-300">
                                          New Item
                                        </Badge>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 font-mono text-slate-400 text-[11px]">
                                    {it.itemCode || '—'}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-white">
                                    {it.quantity} <span className="text-[10px] text-slate-400 font-normal">{it.unit}</span>
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono text-slate-300">
                                    ₹{it.rate.toFixed(2)}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono text-slate-400">
                                    {it.taxRate > 0 ? `${it.taxRate}% (₹${it.taxAmount.toFixed(1)})` : '0%'}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400">
                                    ₹{it.totalAmount.toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Invoice Payment Details Footer */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-400">
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              Payment Mode: <strong className="text-white uppercase">{inv.paymentMethod.replace('_', ' ')}</strong>
                            </span>
                            {inv.notes && (
                              <span className="text-slate-500 italic">• Note: "{inv.notes}"</span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 font-mono">
                            <span>Gross: ₹{inv.totalGross.toFixed(2)}</span>
                            <span>Tax: ₹{inv.totalTax.toFixed(2)}</span>
                            <span className="text-white font-bold">Total Bill: ₹{inv.totalAmount.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Bottom Actions */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={isProcessing}
                className="text-slate-400 hover:text-white text-xs"
              >
                Choose Different File
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    handleReset();
                    onClose();
                  }}
                  disabled={isProcessing}
                  className="text-xs"
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleCommitPurchases}
                  disabled={isProcessing || parseResult.hasErrors || parseResult.totalInvoices === 0}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/40"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  <span>
                    {isProcessing
                      ? 'Inwarding Purchases...'
                      : `Confirm & Inward ${parseResult.totalInvoices} Invoice(s)`}
                  </span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
