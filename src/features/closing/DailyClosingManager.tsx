import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { dailyClosingRepo, DayClosingLiveStats } from '../../lib/dal/dailyClosingRepo';
import { inventoryRepo } from '../../lib/dal/inventoryRepo';
import { cashTransfersRepo } from '../../lib/dal/cashTransfersRepo';
import { DailyClosing, CashClosing, StockCount, InventoryItem, SectionStatus, Location } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { CashTransfersModal } from './CashTransfersModal';
import { ReopenClosingModal } from './ReopenClosingModal';
import { RevisionsHistoryModal } from './RevisionsHistoryModal';
import {
  CheckCircle,
  AlertTriangle,
  Clock,
  Lock,
  LockOpen,
  DollarSign,
  TrendingUp,
  Smartphone,
  Truck,
  Package,
  FileText,
  RotateCcw,
  History,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  CreditCard,
  ShoppingBag,
} from 'lucide-react';

export const DailyClosingManager: React.FC = () => {
  const { locations, currentLocation, accessibleLocations, setLocation } = useApp();

  // Date selection (default today YYYY-MM-DD)
  const todayStr = new Date().toISOString().substring(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const [closing, setClosing] = useState<DailyClosing | null>(null);
  const [stats, setStats] = useState<DayClosingLiveStats | null>(null);
  const [trackedItems, setTrackedItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Cash Closing Form State
  const [openingCash, setOpeningCash] = useState<number>(1000);
  const [otherCashReceipts, setOtherCashReceipts] = useState<number>(0);
  const [physicalCash, setPhysicalCash] = useState<string>('');
  const [cashNotes, setCashNotes] = useState<string>('');

  // UPI Reconciliation Form State
  const [reportedUpi, setReportedUpi] = useState<string>('');
  const [upiNotes, setUpiNotes] = useState<string>('');

  // Zomato & Swiggy State
  const [zomatoReportedSales, setZomatoReportedSales] = useState<string>('');
  const [zomatoReportedOrders, setZomatoReportedOrders] = useState<string>('');
  const [swiggyReportedSales, setSwiggyReportedSales] = useState<string>('');
  const [swiggyReportedOrders, setSwiggyReportedOrders] = useState<string>('');

  // Stock Counts State (item_id -> physical count string)
  const [stockCounts, setStockCounts] = useState<Record<string, string>>({});
  const [itemBalances, setItemBalances] = useState<Record<string, number>>({});

  // Handover Notes
  const [handoverNotes, setHandoverNotes] = useState<string>('');

  // Modals
  const [isCashTransfersOpen, setIsCashTransfersOpen] = useState(false);
  const [isReopenOpen, setIsReopenOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Collapsible sections state
  const [expandedSection, setExpandedSection] = useState<number | null>(null);

  useEffect(() => {
    if (currentLocation) {
      loadDayClosing();
    }
  }, [currentLocation?.id, selectedDate]);

  const loadDayClosing = async () => {
    if (!currentLocation) return;
    setLoading(true);

    try {
      // 1. Get or create daily closing
      const closingRecord = await dailyClosingRepo.getOrCreateDailyClosing(currentLocation.id, selectedDate);
      setClosing(closingRecord);
      setHandoverNotes(closingRecord.notes || '');

      // 2. Calculate live statistics
      const liveStats = await dailyClosingRepo.calculateLiveStats(currentLocation.id, selectedDate);
      setStats(liveStats);

      // 3. Load existing cash closing
      const existingCash = await dailyClosingRepo.getCashClosing(currentLocation.id, selectedDate);
      if (existingCash) {
        setOpeningCash(existingCash.opening_cash);
        setOtherCashReceipts(existingCash.other_cash_receipts);
        setPhysicalCash(existingCash.physical_closing_cash.toString());
        setCashNotes(existingCash.notes || '');
      } else {
        // Defaults
        setPhysicalCash('');
      }

      // 4. Load inventory items & balances
      const items = await inventoryRepo.getItems();
      setTrackedItems(items.filter(i => i.is_active));

      const balances = await inventoryRepo.getBalancesByLocation(currentLocation.id);
      const locBalances: Record<string, number> = {};
      for (const b of balances) {
        locBalances[b.inventory_item_id] = b.available_quantity;
      }
      setItemBalances(locBalances);

      // 5. Load stock counts if already recorded
      const existingCounts = await dailyClosingRepo.getStockCounts(currentLocation.id, selectedDate);
      const countsMap: Record<string, string> = {};
      for (const c of existingCounts) {
        countsMap[c.inventory_item_id] = c.physical_closing.toString();
      }
      setStockCounts(countsMap);
    } catch (err) {
      console.error('Error loading closing:', err);
    } finally {
      setLoading(false);
    }
  };

  const isFinalized = closing?.status === 'finalised';

  // Section status helper
  const getSectionStatusBadge = (status: SectionStatus) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success" size="sm">Completed</Badge>;
      case 'in_progress':
        return <Badge variant="warning" size="sm">In Progress</Badge>;
      case 'attention_required':
        return <Badge variant="danger" size="sm">Attention</Badge>;
      default:
        return <Badge variant="default" size="sm">Pending</Badge>;
    }
  };

  // Section 1: Mark Sales Verified
  const handleVerifySales = async () => {
    if (!closing) return;
    const updated = await dailyClosingRepo.updateSectionStatus(closing.id, 'sales_status', 'completed');
    if (updated) setClosing(updated);
  };

  // Section 2: Save Cash Closing
  const handleSaveCashClosing = async () => {
    if (!closing || !currentLocation || !stats) return;
    const pCash = parseFloat(physicalCash);
    if (isNaN(pCash)) {
      alert('Please enter a valid physical cash count.');
      return;
    }

    const expected =
      openingCash +
      stats.sales.cashSales +
      otherCashReceipts -
      stats.expenses.totalCashExpenses -
      stats.sales.refundsTotal -
      stats.cashTransfers.totalTransferredToOwner;

    const diff = pCash - expected;

    await dailyClosingRepo.saveCashClosing({
      location_id: currentLocation.id,
      closing_date: selectedDate,
      opening_cash: openingCash,
      cash_sales: stats.sales.cashSales,
      other_cash_receipts: otherCashReceipts,
      cash_expenses: stats.expenses.totalCashExpenses,
      cash_refunds: stats.sales.refundsTotal,
      cash_transferred_to_owner: stats.cashTransfers.totalTransferredToOwner,
      expected_closing_cash: expected,
      physical_closing_cash: pCash,
      difference: diff,
      notes: cashNotes,
      created_by: 'Staff',
    });

    const status: SectionStatus = Math.abs(diff) > 100 ? 'attention_required' : 'completed';
    const updated = await dailyClosingRepo.updateSectionStatus(closing.id, 'cash_status', status);
    if (updated) setClosing(updated);
  };

  // Section 3: Confirm UPI
  const handleConfirmUpi = async () => {
    if (!closing || !stats) return;
    const rUpi = parseFloat(reportedUpi);
    const expected = stats.sales.upiSales;
    const diff = isNaN(rUpi) ? 0 : rUpi - expected;

    const status: SectionStatus = Math.abs(diff) > 50 ? 'attention_required' : 'completed';
    const updated = await dailyClosingRepo.updateSectionStatus(closing.id, 'upi_status', status);
    if (updated) setClosing(updated);
  };

  // Section 4: Confirm Zomato
  const handleConfirmZomato = async () => {
    if (!closing) return;
    const updated = await dailyClosingRepo.updateSectionStatus(closing.id, 'zomato_status', 'completed');
    if (updated) setClosing(updated);
  };

  // Section 5: Confirm Swiggy
  const handleConfirmSwiggy = async () => {
    if (!closing) return;
    const updated = await dailyClosingRepo.updateSectionStatus(closing.id, 'swiggy_status', 'completed');
    if (updated) setClosing(updated);
  };

  // Section 6: Confirm Expenses
  const handleConfirmExpenses = async () => {
    if (!closing) return;
    const updated = await dailyClosingRepo.updateSectionStatus(closing.id, 'expenses_status', 'completed');
    if (updated) setClosing(updated);
  };

  // Section 7: Save Physical Stock Counts
  const handleSaveStockCounts = async () => {
    if (!closing || !currentLocation) return;

    for (const item of trackedItems) {
      const pCountStr = stockCounts[item.id];
      if (pCountStr !== undefined && pCountStr.trim() !== '') {
        const pCount = parseFloat(pCountStr) || 0;
        const expected = itemBalances[item.id] || 0;
        const variance = pCount - expected;

        await dailyClosingRepo.saveStockCount({
          daily_closing_id: closing.id,
          location_id: currentLocation.id,
          count_date: selectedDate,
          inventory_item_id: item.id,
          opening_stock: expected,
          receipts_and_transfers_in: 0,
          production_output: 0,
          transfers_out: 0,
          wastage: 0,
          other_consumption: 0,
          expected_closing: expected,
          physical_closing: pCount,
          variance: variance,
          variance_flagged: variance !== 0,
          counted_by: 'Staff',
        });
      }
    }

    const updated = await dailyClosingRepo.updateSectionStatus(closing.id, 'stock_status', 'completed');
    if (updated) setClosing(updated);
  };

  // Section 8: Confirm Wastage
  const handleConfirmWastage = async () => {
    if (!closing) return;
    const updated = await dailyClosingRepo.updateSectionStatus(closing.id, 'wastage_status', 'completed');
    if (updated) setClosing(updated);
  };

  // Section 9: Confirm Receiving
  const handleConfirmReceiving = async () => {
    if (!closing) return;
    const updated = await dailyClosingRepo.updateSectionStatus(closing.id, 'receiving_status', 'completed');
    if (updated) setClosing(updated);
  };

  // Section 10: Confirm Dispatch
  const handleConfirmDispatch = async () => {
    if (!closing) return;
    const updated = await dailyClosingRepo.updateSectionStatus(closing.id, 'dispatch_status', 'completed');
    if (updated) setClosing(updated);
  };

  // Section 11: Save Notes
  const handleSaveNotes = async () => {
    if (!closing) return;
    const updated = await dailyClosingRepo.updateSectionStatus(closing.id, 'notes_status', 'completed');
    if (updated) setClosing(updated);
  };

  // Section 12: Finalize and Lock Closing
  const handleFinalize = async () => {
    if (!closing) return;
    if (closing.completed_sections_count < 8) {
      if (!confirm(`Only ${closing.completed_sections_count} of 12 sections have been verified. Do you still wish to submit and finalize?`)) {
        return;
      }
    }

    const updated = await dailyClosingRepo.finalizeDailyClosing(closing.id, 'Closing Manager', handoverNotes);
    setClosing(updated);
  };

  const toggleSection = (idx: number) => {
    setExpandedSection(prev => (prev === idx ? null : idx));
  };

  if (!currentLocation) {
    return <div className="p-8 text-neutral-400">Please select an active location.</div>;
  }

  // Calculate live expected cash for drawer formula
  const currentCashSales = stats?.sales.cashSales || 0;
  const currentCashExpenses = stats?.expenses.totalCashExpenses || 0;
  const currentRefunds = stats?.sales.refundsTotal || 0;
  const currentOwnerTransfers = stats?.cashTransfers.totalTransferredToOwner || 0;
  const expectedCashCalculated =
    openingCash + currentCashSales + otherCashReceipts - currentCashExpenses - currentRefunds - currentOwnerTransfers;

  const physicalCashNum = parseFloat(physicalCash) || 0;
  const cashDifference = physicalCashNum - expectedCashCalculated;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Banner & Location/Date Switcher */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-neutral-100 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-500" />
                12-Section Daily Closing
              </h2>
              {closing?.status === 'finalised' ? (
                <Badge variant="success" size="md" className="gap-1 flex items-center">
                  <Lock className="w-3.5 h-3.5" /> Finalised & Locked
                </Badge>
              ) : closing?.status === 'reopened' ? (
                <Badge variant="danger" size="md" className="gap-1 flex items-center">
                  <LockOpen className="w-3.5 h-3.5" /> Reopened for Revision
                </Badge>
              ) : (
                <Badge variant="warning" size="md" className="gap-1 flex items-center">
                  <Clock className="w-3.5 h-3.5" /> In Progress
                </Badge>
              )}
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              End-of-day reconciliation protocol across sales, physical drawer, digital channels, and night stock.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Location selector */}
            <div className="w-48">
              <select
                aria-label="Select location"
                value={currentLocation.id}
                onChange={e => {
                  const loc = accessibleLocations.find((l: Location) => l.id === e.target.value);
                  if (loc) setLocation(loc);
                }}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-amber-500/50"
              >
                {accessibleLocations.map((loc: Location) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.code} — {loc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date selector */}
            <input
              type="date"
              aria-label="Closing date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-amber-500/50"
            />

            {/* Action buttons */}
            {isFinalized && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsReopenOpen(true)}
                className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Reopen Closing
              </Button>
            )}

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsHistoryOpen(true)}
              className="text-xs"
            >
              <History className="w-3.5 h-3.5 mr-1" />
              Revisions
            </Button>
          </div>
        </div>

        {/* Reopen notice if currently reopened */}
        {closing?.status === 'reopened' && (
          <div className="mt-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Reopened by {closing.reopened_by}:</strong> {closing.reopen_reason}
              </span>
            </div>
            <span className="text-[11px] text-neutral-400">
              {closing.reopened_at ? new Date(closing.reopened_at).toLocaleTimeString() : ''}
            </span>
          </div>
        )}

        {/* Progress bar */}
        <div className="mt-5 pt-4 border-t border-neutral-800/80">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-neutral-400 font-medium">Reconciliation Progress</span>
            <span className="font-semibold text-neutral-200">
              {closing?.completed_sections_count || 0} / 12 Sections Completed
            </span>
          </div>
          <div className="w-full bg-neutral-950 rounded-full h-2 overflow-hidden border border-neutral-800">
            <div
              className="bg-amber-500 h-full transition-all duration-300"
              style={{ width: `${(((closing?.completed_sections_count || 0) / 12) * 100).toFixed(0)}%` }}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-neutral-500 text-sm">Loading closing records...</div>
      ) : (
        <div className="space-y-4">
          {/* SECTION 1: SALES SUMMARY */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <div
              onClick={() => toggleSection(1)}
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-neutral-800/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-neutral-800 text-neutral-300 text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                    Sales Summary (Gross, Discounts, Net & Channel Breakdown)
                  </h3>
                  <span className="text-xs text-neutral-400">
                    Gross: ₹{stats?.sales.grossSales.toLocaleString()} • Net: ₹{stats?.sales.netSales.toLocaleString()} • {stats?.sales.totalOrders} Orders
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getSectionStatusBadge(closing?.sales_status || 'not_started')}
                {expandedSection === 1 ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
              </div>
            </div>

            {expandedSection === 1 && (
              <div className="p-4 pt-0 border-t border-neutral-800/60 mt-2 space-y-4 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800">
                    <span className="text-neutral-400 block">Gross Sales</span>
                    <span className="text-sm font-semibold text-neutral-200">₹{stats?.sales.grossSales.toLocaleString()}</span>
                  </div>
                  <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800">
                    <span className="text-neutral-400 block">Discounts Given</span>
                    <span className="text-sm font-semibold text-amber-400">₹{stats?.sales.discountTotal.toLocaleString()}</span>
                  </div>
                  <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800">
                    <span className="text-neutral-400 block">Refunds</span>
                    <span className="text-sm font-semibold text-red-400">₹{stats?.sales.refundsTotal.toLocaleString()}</span>
                  </div>
                  <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800">
                    <span className="text-neutral-400 block">Net Realised Sales</span>
                    <span className="text-sm font-semibold text-emerald-400">₹{stats?.sales.netSales.toLocaleString()}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Channel Breakdown */}
                  <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800">
                    <h4 className="font-semibold text-neutral-300 mb-2">Sales by Channel</h4>
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Dine-in / Walk-in:</span>
                        <span className="font-medium text-neutral-200">₹{(stats?.sales.channelBreakdown.walk_in || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Zomato:</span>
                        <span className="font-medium text-neutral-200">₹{(stats?.sales.channelBreakdown.zomato || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Swiggy:</span>
                        <span className="font-medium text-neutral-200">₹{(stats?.sales.channelBreakdown.swiggy || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Breakdown */}
                  <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800">
                    <h4 className="font-semibold text-neutral-300 mb-2">Sales by Payment Mode</h4>
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Cash Collections:</span>
                        <span className="font-medium text-emerald-400">₹{(stats?.sales.cashSales || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-400">UPI / QR Collections:</span>
                        <span className="font-medium text-blue-400">₹{(stats?.sales.upiSales || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Card / Others:</span>
                        <span className="font-medium text-neutral-200">₹{(stats?.sales.cardSales || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {!isFinalized && (
                  <div className="flex justify-end pt-2">
                    <Button variant="primary" size="sm" onClick={handleVerifySales}>
                      <CheckCircle className="w-3.5 h-3.5 mr-1" />
                      Verify Sales Summary
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 2: CASH DRAWER CLOSING (Formula verification) */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <div
              onClick={() => toggleSection(2)}
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-neutral-800/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-neutral-800 text-neutral-300 text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    Cash Drawer Closing (Formula: Opening + Cash Sales + Receipts - Expenses - Refunds - Owner Transfers)
                  </h3>
                  <span className="text-xs text-neutral-400">
                    Expected Cash: ₹{expectedCashCalculated.toLocaleString()} • Counted: ₹{(parseFloat(physicalCash) || 0).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getSectionStatusBadge(closing?.cash_status || 'not_started')}
                {expandedSection === 2 ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
              </div>
            </div>

            {expandedSection === 2 && (
              <div className="p-4 pt-0 border-t border-neutral-800/60 mt-2 space-y-4 text-xs">
                {/* Cash Drawer Computation Formula Card */}
                <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-neutral-400 block mb-1">Opening Cash (₹)</label>
                      <Input
                        type="number"
                        disabled={isFinalized}
                        value={openingCash}
                        onChange={e => setOpeningCash(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <label className="text-neutral-400 block mb-1">(+) Cash Sales (₹)</label>
                      <Input type="text" disabled value={currentCashSales.toLocaleString()} />
                    </div>
                    <div>
                      <label className="text-neutral-400 block mb-1">(+) Other Cash Receipts (₹)</label>
                      <Input
                        type="number"
                        disabled={isFinalized}
                        value={otherCashReceipts}
                        onChange={e => setOtherCashReceipts(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-neutral-400 block mb-1">(-) Cash Expenses (₹)</label>
                      <Input type="text" disabled value={currentCashExpenses.toLocaleString()} />
                    </div>
                    <div>
                      <label className="text-neutral-400 block mb-1">(-) Cash Refunds (₹)</label>
                      <Input type="text" disabled value={currentRefunds.toLocaleString()} />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-neutral-400">(-) Transferred to Owner (₹)</label>
                        <button
                          type="button"
                          onClick={() => setIsCashTransfersOpen(true)}
                          className="text-[11px] text-amber-400 hover:underline"
                        >
                          Manage
                        </button>
                      </div>
                      <Input type="text" disabled value={currentOwnerTransfers.toLocaleString()} />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-neutral-400 block">Calculated Expected Cash</span>
                      <span className="text-base font-bold text-neutral-100">
                        ₹{expectedCashCalculated.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div>
                        <label className="text-neutral-400 block mb-1">Physical Cash Counted (₹)</label>
                        <Input
                          type="number"
                          disabled={isFinalized}
                          value={physicalCash}
                          onChange={e => setPhysicalCash(e.target.value)}
                          placeholder="Count drawer cash"
                          className="w-40 font-semibold text-emerald-400"
                        />
                      </div>

                      <div className="text-right">
                        <span className="text-neutral-400 block">Variance</span>
                        <span
                          className={`text-sm font-bold ${
                            cashDifference === 0
                              ? 'text-emerald-400'
                              : cashDifference > 0
                              ? 'text-blue-400'
                              : 'text-red-400'
                          }`}
                        >
                          {cashDifference > 0 ? `+₹${cashDifference.toLocaleString()} (Surplus)` : cashDifference < 0 ? `-₹${Math.abs(cashDifference).toLocaleString()} (Shortage)` : '₹0 (Balanced)'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {!isFinalized && (
                  <div className="flex justify-between items-center pt-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsCashTransfersOpen(true)}
                    >
                      Record Cash Handover to Owner
                    </Button>
                    <Button variant="primary" size="sm" onClick={handleSaveCashClosing}>
                      <CheckCircle className="w-3.5 h-3.5 mr-1" />
                      Save & Confirm Cash Drawer
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 3: UPI RECONCILIATION */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <div
              onClick={() => toggleSection(3)}
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-neutral-800/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-neutral-800 text-neutral-300 text-xs font-bold flex items-center justify-center">
                  3
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-blue-400" />
                    UPI / Digital Reconciliation (QR Soundbox & Merchant Settlement)
                  </h3>
                  <span className="text-xs text-neutral-400">
                    System Expected: ₹{(stats?.sales.upiSales || 0).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getSectionStatusBadge(closing?.upi_status || 'not_started')}
                {expandedSection === 3 ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
              </div>
            </div>

            {expandedSection === 3 && (
              <div className="p-4 pt-0 border-t border-neutral-800/60 mt-2 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800">
                    <span className="text-neutral-400 block mb-1">Expected UPI Sales (POS)</span>
                    <span className="text-lg font-bold text-blue-400">
                      ₹{(stats?.sales.upiSales || 0).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <label className="text-neutral-400 block mb-1">
                      Merchant App Settlement / QR Soundbox Total (₹)
                    </label>
                    <Input
                      type="number"
                      disabled={isFinalized}
                      value={reportedUpi}
                      onChange={e => setReportedUpi(e.target.value)}
                      placeholder="Enter verified merchant app total"
                    />
                  </div>
                </div>

                {!isFinalized && (
                  <div className="flex justify-end pt-2">
                    <Button variant="primary" size="sm" onClick={handleConfirmUpi}>
                      <CheckCircle className="w-3.5 h-3.5 mr-1" />
                      Confirm UPI Reconciliation
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 4 & 5: ZOMATO & SWIGGY RECONCILIATIONS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ZOMATO */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-300 text-[11px] font-bold flex items-center justify-center">
                    4
                  </span>
                  Zomato Partner Reconciliation
                </h3>
                {getSectionStatusBadge(closing?.zomato_status || 'not_started')}
              </div>
              <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800 text-xs flex justify-between">
                <span className="text-neutral-400">POS Zomato Sales:</span>
                <span className="font-semibold text-neutral-200">
                  ₹{(stats?.sales.channelBreakdown.zomato || 0).toLocaleString()}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Input
                  type="number"
                  disabled={isFinalized}
                  placeholder="App Sales (₹)"
                  value={zomatoReportedSales}
                  onChange={e => setZomatoReportedSales(e.target.value)}
                />
                <Input
                  type="number"
                  disabled={isFinalized}
                  placeholder="Order Count"
                  value={zomatoReportedOrders}
                  onChange={e => setZomatoReportedOrders(e.target.value)}
                />
              </div>
              {!isFinalized && (
                <div className="flex justify-end">
                  <Button variant="secondary" size="sm" onClick={handleConfirmZomato}>
                    Confirm Zomato
                  </Button>
                </div>
              )}
            </div>

            {/* SWIGGY */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-300 text-[11px] font-bold flex items-center justify-center">
                    5
                  </span>
                  Swiggy Partner Reconciliation
                </h3>
                {getSectionStatusBadge(closing?.swiggy_status || 'not_started')}
              </div>
              <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800 text-xs flex justify-between">
                <span className="text-neutral-400">POS Swiggy Sales:</span>
                <span className="font-semibold text-neutral-200">
                  ₹{(stats?.sales.channelBreakdown.swiggy || 0).toLocaleString()}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Input
                  type="number"
                  disabled={isFinalized}
                  placeholder="App Sales (₹)"
                  value={swiggyReportedSales}
                  onChange={e => setSwiggyReportedSales(e.target.value)}
                />
                <Input
                  type="number"
                  disabled={isFinalized}
                  placeholder="Order Count"
                  value={swiggyReportedOrders}
                  onChange={e => setSwiggyReportedOrders(e.target.value)}
                />
              </div>
              {!isFinalized && (
                <div className="flex justify-end">
                  <Button variant="secondary" size="sm" onClick={handleConfirmSwiggy}>
                    Confirm Swiggy
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 6: EXPENSES REVIEW */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <div
              onClick={() => toggleSection(6)}
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-neutral-800/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-neutral-800 text-neutral-300 text-xs font-bold flex items-center justify-center">
                  6
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-purple-400" />
                    Expenses Review (All payments made from outlet today)
                  </h3>
                  <span className="text-xs text-neutral-400">
                    Total: ₹{(stats?.expenses.totalExpenses || 0).toLocaleString()} ({stats?.expenses.count} expenses logged)
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getSectionStatusBadge(closing?.expenses_status || 'not_started')}
                {expandedSection === 6 ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
              </div>
            </div>

            {expandedSection === 6 && (
              <div className="p-4 pt-0 border-t border-neutral-800/60 mt-2 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800">
                    <span className="text-neutral-400 block">Cash Expenses Paid</span>
                    <span className="text-sm font-semibold text-neutral-200">
                      ₹{(stats?.expenses.totalCashExpenses || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800">
                    <span className="text-neutral-400 block">Digital / UPI Expenses Paid</span>
                    <span className="text-sm font-semibold text-neutral-200">
                      ₹{(stats?.expenses.totalDigitalExpenses || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                {!isFinalized && (
                  <div className="flex justify-end pt-2">
                    <Button variant="primary" size="sm" onClick={handleConfirmExpenses}>
                      <CheckCircle className="w-3.5 h-3.5 mr-1" />
                      Confirm Expenses Review
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 7: PHYSICAL STOCK NIGHT COUNT */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <div
              onClick={() => toggleSection(7)}
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-neutral-800/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-neutral-800 text-neutral-300 text-xs font-bold flex items-center justify-center">
                  7
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
                    <Package className="w-4 h-4 text-amber-500" />
                    Physical Stock Night Count (Closing count with real variance calculation)
                  </h3>
                  <span className="text-xs text-neutral-400">
                    {trackedItems.length} active inventory items tracked at this location
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getSectionStatusBadge(closing?.stock_status || 'not_started')}
                {expandedSection === 7 ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
              </div>
            </div>

            {expandedSection === 7 && (
              <div className="p-4 pt-0 border-t border-neutral-800/60 mt-2 space-y-4 text-xs">
                {trackedItems.length === 0 ? (
                  <div className="text-center py-6 text-neutral-500">
                    No active inventory items found. Add items via Inventory Master or Testing Sandbox.
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-72 overflow-y-auto border border-neutral-800 rounded-lg">
                    <table className="w-full text-left">
                      <thead className="bg-neutral-950 text-neutral-400 uppercase text-[10px] sticky top-0">
                        <tr>
                          <th className="p-2.5">Item Name</th>
                          <th className="p-2.5 text-center">Category</th>
                          <th className="p-2.5 text-right">System Expected</th>
                          <th className="p-2.5 text-right w-36">Physical Count</th>
                          <th className="p-2.5 text-right">Variance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800">
                        {trackedItems.map(item => {
                          const expected = itemBalances[item.id] || 0;
                          const pVal = stockCounts[item.id] !== undefined ? parseFloat(stockCounts[item.id]) : NaN;
                          const variance = isNaN(pVal) ? 0 : pVal - expected;

                          return (
                            <tr key={item.id} className="hover:bg-neutral-800/30">
                              <td className="p-2.5 font-medium text-neutral-200">
                                {item.name}
                                <span className="text-neutral-500 text-[10px] block">{item.code}</span>
                              </td>
                              <td className="p-2.5 text-center text-neutral-400 capitalize text-[11px]">
                                {item.category_type.replace('_', ' ')}
                              </td>
                              <td className="p-2.5 text-right font-medium text-neutral-300">
                                {expected} {item.base_unit}
                              </td>
                              <td className="p-2.5 text-right">
                                <Input
                                  type="number"
                                  step="any"
                                  disabled={isFinalized}
                                  value={stockCounts[item.id] || ''}
                                  onChange={e => {
                                    setStockCounts({
                                      ...stockCounts,
                                      [item.id]: e.target.value,
                                    });
                                  }}
                                  placeholder="Night count"
                                  className="text-right text-xs py-1"
                                />
                              </td>
                              <td className="p-2.5 text-right font-medium">
                                {!isNaN(pVal) ? (
                                  <span
                                    className={
                                      variance === 0
                                        ? 'text-emerald-400'
                                        : variance > 0
                                        ? 'text-blue-400'
                                        : 'text-red-400'
                                    }
                                  >
                                    {variance > 0 ? `+${variance}` : variance} {item.base_unit}
                                  </span>
                                ) : (
                                  <span className="text-neutral-600">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {!isFinalized && (
                  <div className="flex justify-end pt-2">
                    <Button variant="primary" size="sm" onClick={handleSaveStockCounts}>
                      <CheckCircle className="w-3.5 h-3.5 mr-1" />
                      Save Stock Counts
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 8, 9, 10: WASTAGE, RECEIVING, DISPATCH CONFIRMATIONS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* WASTAGE */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-neutral-800 text-neutral-300 text-[10px] font-bold flex items-center justify-center">
                    8
                  </span>
                  Wastage Verified
                </h3>
                {getSectionStatusBadge(closing?.wastage_status || 'not_started')}
              </div>
              <div className="text-xs text-neutral-400">
                Total logged today: <strong className="text-neutral-200">{stats?.wastage.totalItemsWasted || 0} units</strong> ({stats?.wastage.count} records)
              </div>
              {!isFinalized && (
                <div className="flex justify-end">
                  <Button variant="secondary" size="sm" onClick={handleConfirmWastage}>
                    Confirm
                  </Button>
                </div>
              )}
            </div>

            {/* RECEIVING */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-neutral-800 text-neutral-300 text-[10px] font-bold flex items-center justify-center">
                    9
                  </span>
                  Receiving Verified
                </h3>
                {getSectionStatusBadge(closing?.receiving_status || 'not_started')}
              </div>
              <div className="text-xs text-neutral-400">
                Inward challans received: <strong className="text-neutral-200">{stats?.transfersIn.receivedChallansCount || 0} challans</strong>
              </div>
              {!isFinalized && (
                <div className="flex justify-end">
                  <Button variant="secondary" size="sm" onClick={handleConfirmReceiving}>
                    Confirm
                  </Button>
                </div>
              )}
            </div>

            {/* DISPATCH */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-neutral-800 text-neutral-300 text-[10px] font-bold flex items-center justify-center">
                    10
                  </span>
                  Dispatches Verified
                </h3>
                {getSectionStatusBadge(closing?.dispatch_status || 'not_started')}
              </div>
              <div className="text-xs text-neutral-400">
                Outward dispatches sent: <strong className="text-neutral-200">{stats?.transfersOut.dispatchedChallansCount || 0} challans</strong>
              </div>
              {!isFinalized && (
                <div className="flex justify-end">
                  <Button variant="secondary" size="sm" onClick={handleConfirmDispatch}>
                    Confirm
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 11: CLOSING & SHIFT HANDOVER NOTES */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-300 text-[11px] font-bold flex items-center justify-center">
                  11
                </span>
                Closing & Shift Handover Notes
              </h3>
              {getSectionStatusBadge(closing?.notes_status || 'not_started')}
            </div>
            <textarea
              rows={3}
              disabled={isFinalized}
              value={handoverNotes}
              onChange={e => setHandoverNotes(e.target.value)}
              placeholder="Enter remarks for the next morning shift, any machine maintenance or cash variances..."
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500/50"
            />
            {!isFinalized && (
              <div className="flex justify-end">
                <Button variant="secondary" size="sm" onClick={handleSaveNotes}>
                  Save Notes
                </Button>
              </div>
            )}
          </div>

          {/* SECTION 12: FINAL SUBMISSION LOCK */}
          <div className="bg-neutral-900 border border-amber-500/30 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-neutral-100 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-500 text-neutral-950 text-xs font-bold flex items-center justify-center">
                    12
                  </span>
                  Final Submission & Day Lock
                </h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Once finalized, daily entries for {currentLocation.name} ({selectedDate}) are locked against casual tampering.
                </p>
              </div>
              {getSectionStatusBadge(closing?.final_submission_status || 'not_started')}
            </div>

            {isFinalized ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-xs text-emerald-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>
                    <strong>Locked and Finalised</strong> by {closing.submitted_by} on{' '}
                    {closing.submitted_at ? new Date(closing.submitted_at).toLocaleString() : 'N/A'}.
                  </span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsReopenOpen(true)}
                  className="text-amber-400 border-amber-500/30"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reopen Protocol
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-neutral-400">
                  {closing?.completed_sections_count || 0} of 12 sections verified.
                </div>
                <Button
                  variant="primary"
                  onClick={handleFinalize}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                >
                  <Lock className="w-4 h-4 mr-1.5" />
                  Finalize & Lock Daily Closing
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <CashTransfersModal
        isOpen={isCashTransfersOpen}
        onClose={() => setIsCashTransfersOpen(false)}
        location={currentLocation}
        closingDate={selectedDate}
        onTransferRecorded={loadDayClosing}
      />

      {closing && (
        <ReopenClosingModal
          isOpen={isReopenOpen}
          onClose={() => setIsReopenOpen(false)}
          closingId={closing.id}
          onReopened={loadDayClosing}
        />
      )}

      {closing && (
        <RevisionsHistoryModal
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          closingId={closing.id}
        />
      )}
    </div>
  );
};
