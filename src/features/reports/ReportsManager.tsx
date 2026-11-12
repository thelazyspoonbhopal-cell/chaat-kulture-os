import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { reportsRepo, SalesReportSummary, EstimatedPLReport, DateRangeFilter } from '../../lib/dal/reportsRepo';
import { Location } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import {
  TrendingUp,
  DollarSign,
  PieChart,
  Calendar,
  Layers,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Building2,
  FileSpreadsheet,
} from 'lucide-react';

export const ReportsManager: React.FC = () => {
  const { locations } = useApp();

  // Tab State
  const [activeTab, setActiveTab] = useState<'sales' | 'pl'>('sales');

  // Date Range State
  const todayStr = new Date().toISOString().substring(0, 10);
  const thirtyDaysAgoStr = new Date(Date.now() - 30 * 86400000).toISOString().substring(0, 10);

  const [datePreset, setDatePreset] = useState<'today' | '7days' | '30days' | 'custom'>('30days');
  const [startDate, setStartDate] = useState<string>(thirtyDaysAgoStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');

  const [salesReport, setSalesReport] = useState<SalesReportSummary | null>(null);
  const [plReport, setPLReport] = useState<EstimatedPLReport | null>(null);
  const [loading, setLoading] = useState(true);

  // Set presets
  const handlePresetChange = (preset: 'today' | '7days' | '30days' | 'custom') => {
    setDatePreset(preset);
    const today = new Date().toISOString().substring(0, 10);
    if (preset === 'today') {
      setStartDate(today);
      setEndDate(today);
    } else if (preset === '7days') {
      const d = new Date(Date.now() - 7 * 86400000).toISOString().substring(0, 10);
      setStartDate(d);
      setEndDate(today);
    } else if (preset === '30days') {
      const d = new Date(Date.now() - 30 * 86400000).toISOString().substring(0, 10);
      setStartDate(d);
      setEndDate(today);
    }
  };

  useEffect(() => {
    loadReports();
  }, [startDate, endDate, selectedLocationId]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const filter: DateRangeFilter = {
        startDate,
        endDate,
        locationId: selectedLocationId,
      };

      const [sRep, plRep] = await Promise.all([
        reportsRepo.getSalesReport(filter),
        reportsRepo.getEstimatedPL(filter),
      ]);

      setSalesReport(sRep);
      setPLReport(plRep);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header & Filter Controls */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-neutral-100 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-amber-500" />
              Business Intelligence & Analytics
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              Multi-outlet sales performance, channel contribution, top items, and estimated P&L.
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex bg-neutral-950 p-1 rounded-xl border border-neutral-800 self-start md:self-auto">
            <button
              onClick={() => setActiveTab('sales')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'sales'
                  ? 'bg-amber-500 text-neutral-950 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Sales Analytics
            </button>
            <button
              onClick={() => setActiveTab('pl')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'pl'
                  ? 'bg-amber-500 text-neutral-950 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Estimated Profit & Loss
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="pt-4 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
            <button
              onClick={() => handlePresetChange('today')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                datePreset === 'today' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => handlePresetChange('7days')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                datePreset === '7days' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => handlePresetChange('30days')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                datePreset === '30days' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Last 30 Days
            </button>
            <button
              onClick={() => setDatePreset('custom')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                datePreset === 'custom' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Custom
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Custom Dates */}
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                aria-label="Start date"
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1 text-xs text-neutral-200 focus:outline-none focus:border-amber-500/50"
              />
              <span className="text-neutral-500">to</span>
              <input
                type="date"
                aria-label="End date"
                value={endDate}
                onChange={e => {
                  setEndDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1 text-xs text-neutral-200 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            {/* Location Filter */}
            <select
              aria-label="Filter by location"
              value={selectedLocationId}
              onChange={e => setSelectedLocationId(e.target.value)}
              className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1 text-xs text-neutral-200 focus:outline-none focus:border-amber-500/50"
            >
              <option value="all">All Locations</option>
              {locations.map((loc: Location) => (
                <option key={loc.id} value={loc.id}>
                  {loc.code} — {loc.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-neutral-500 text-sm">Compiling intelligence data...</div>
      ) : activeTab === 'sales' ? (
        /* SALES ANALYTICS TAB */
        <div className="space-y-6">
          {/* Key Metric Tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <span className="text-neutral-400 text-xs block mb-1">Net Realised Revenue</span>
              <span className="text-2xl font-bold text-emerald-400">
                ₹{(salesReport?.netSales || 0).toLocaleString()}
              </span>
              <span className="text-[11px] text-neutral-500 block mt-1">
                Gross: ₹{(salesReport?.grossSales || 0).toLocaleString()}
              </span>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <span className="text-neutral-400 text-xs block mb-1">Total Orders</span>
              <span className="text-2xl font-bold text-neutral-100">
                {salesReport?.totalOrders || 0}
              </span>
              <span className="text-[11px] text-neutral-500 block mt-1">
                Avg Value: ₹{Math.round(salesReport?.averageOrderValue || 0)}
              </span>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <span className="text-neutral-400 text-xs block mb-1">Discounts & Promos</span>
              <span className="text-2xl font-bold text-amber-400">
                ₹{(salesReport?.discountTotal || 0).toLocaleString()}
              </span>
              <span className="text-[11px] text-neutral-500 block mt-1">
                {salesReport?.grossSales ? ((salesReport.discountTotal / salesReport.grossSales) * 100).toFixed(1) : 0}% of Gross
              </span>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <span className="text-neutral-400 text-xs block mb-1">GST / Tax Output</span>
              <span className="text-2xl font-bold text-blue-400">
                ₹{(salesReport?.taxTotal || 0).toLocaleString()}
              </span>
              <span className="text-[11px] text-neutral-500 block mt-1">Configurable rate</span>
            </div>
          </div>

          {/* Multi-Outlet Comparison */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-500" />
              Outlet Performance Comparison
            </h3>

            {Object.keys(salesReport?.locationBreakdown || {}).length === 0 ? (
              <div className="text-center py-6 text-neutral-500 text-xs">No outlet sales recorded in this period.</div>
            ) : (
              <div className="space-y-3">
                {Object.entries(salesReport?.locationBreakdown || {}).map(([locId, data]) => {
                  const maxTotal = Math.max(...Object.values(salesReport!.locationBreakdown).map(l => l.total), 1);
                  const pct = Math.round((data.total / maxTotal) * 100);

                  return (
                    <div key={locId} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-neutral-200">
                          {data.code} — {data.name}
                        </span>
                        <span className="font-semibold text-emerald-400">
                          ₹{data.total.toLocaleString()}{' '}
                          <span className="text-neutral-500 font-normal">({data.orderCount} orders)</span>
                        </span>
                      </div>
                      <div className="w-full bg-neutral-950 rounded-full h-2 overflow-hidden border border-neutral-800">
                        <div className="bg-amber-500 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Channel & Payment Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Channel Breakdown */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-400" />
                Sales Channel Distribution
              </h3>

              <div className="space-y-2 text-xs">
                {Object.entries(salesReport?.channelBreakdown || {}).map(([channel, data]) => (
                  <div key={channel} className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800 flex justify-between items-center">
                    <span className="capitalize text-neutral-300 font-medium">
                      {channel.replace('_', ' ')} ({data.count} orders)
                    </span>
                    <span className="font-semibold text-neutral-100">
                      ₹{data.total.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Mode Distribution */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-blue-400" />
                Payment Mode Breakdown
              </h3>

              <div className="space-y-2 text-xs">
                {Object.entries(salesReport?.paymentBreakdown || {}).map(([method, total]) => (
                  <div key={method} className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800 flex justify-between items-center">
                    <span className="capitalize text-neutral-300 font-medium">{method}</span>
                    <span className="font-semibold text-neutral-100">₹{total.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Selling Dishes */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              Top Selling Dishes & Menu Items
            </h3>

            {salesReport?.topItems.length === 0 ? (
              <div className="text-center py-6 text-neutral-500 text-xs">No items sold in this period.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-950 text-neutral-400 uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Rank & Item Name</th>
                      <th className="p-3 text-right">Quantity Sold</th>
                      <th className="p-3 text-right">Revenue Contribution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {salesReport?.topItems.map((item, idx) => (
                      <tr key={item.itemName} className="hover:bg-neutral-800/30">
                        <td className="p-3 font-medium text-neutral-200 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-neutral-800 text-[10px] font-bold flex items-center justify-center text-neutral-400">
                            {idx + 1}
                          </span>
                          {item.itemName}
                        </td>
                        <td className="p-3 text-right font-medium text-neutral-300">
                          {item.quantity} plates
                        </td>
                        <td className="p-3 text-right font-semibold text-emerald-400">
                          ₹{item.revenue.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ESTIMATED PROFIT & LOSS TAB */
        <div className="space-y-6">
          {/* Key P&L Summary Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <span className="text-neutral-400 text-xs block mb-1">Net Realised Revenue</span>
              <span className="text-2xl font-bold text-neutral-100">
                ₹{(plReport?.revenue.netRevenue || 0).toLocaleString()}
              </span>
              <span className="text-[11px] text-emerald-400 block mt-1 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" /> Gross sales minus discounts
              </span>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <span className="text-neutral-400 text-xs block mb-1">Gross Operating Profit</span>
              <span
                className={`text-2xl font-bold ${
                  (plReport?.grossProfit || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                ₹{(plReport?.grossProfit || 0).toLocaleString()}
              </span>
              <span className="text-[11px] text-neutral-400 block mt-1">
                Margin: {(plReport?.grossMarginPct || 0).toFixed(1)}%
              </span>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <span className="text-neutral-400 text-xs block mb-1">Estimated Net Profit / (Loss)</span>
              <span
                className={`text-2xl font-bold ${
                  (plReport?.estimatedNetProfit || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                ₹{(plReport?.estimatedNetProfit || 0).toLocaleString()}
              </span>
              <span className="text-[11px] text-neutral-400 block mt-1">
                Net Margin: {(plReport?.netMarginPct || 0).toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Detailed Financial Statement (Income Statement format) */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-neutral-100 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-amber-500" />
                Income Statement ({startDate} to {endDate})
              </h3>
              <Badge variant="default" size="sm">
                Local-First Compiled
              </Badge>
            </div>

            <div className="space-y-4 text-xs">
              {/* 1. Operating Revenue */}
              <div className="border border-neutral-800 rounded-xl p-4 space-y-2 bg-neutral-950">
                <div className="font-semibold text-neutral-200 text-sm flex items-center justify-between pb-2 border-b border-neutral-800">
                  <span>1. Operating Revenue</span>
                  <span className="text-emerald-400 font-bold">
                    ₹{(plReport?.revenue.netRevenue || 0).toLocaleString()}
                  </span>
                </div>
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-neutral-400">
                    <span>Gross Sales Receipts:</span>
                    <span className="text-neutral-200 font-medium">
                      ₹{(plReport?.revenue.grossSales || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>Less: Customer Discounts & Promotions:</span>
                    <span className="text-amber-400 font-medium">
                      -₹{(plReport?.revenue.discounts || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>Less: Refunds Processed:</span>
                    <span className="text-red-400 font-medium">
                      -₹{(plReport?.revenue.refunds || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Cost of Goods Sold */}
              <div className="border border-neutral-800 rounded-xl p-4 space-y-2 bg-neutral-950">
                <div className="font-semibold text-neutral-200 text-sm flex items-center justify-between pb-2 border-b border-neutral-800">
                  <span>2. Cost of Goods Sold (Inward Purchases & Supplies)</span>
                  <span className="text-amber-400 font-bold">
                    -₹{(plReport?.costOfGoods.totalCOGS || 0).toLocaleString()}
                  </span>
                </div>
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-neutral-400">
                    <span>Raw Material & Inward Purchases:</span>
                    <span className="text-neutral-200 font-medium">
                      ₹{(plReport?.costOfGoods.totalPurchases || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>Tracked Spoilage & Wastage Loss:</span>
                    <span className="text-neutral-400 font-medium">
                      ₹{(plReport?.costOfGoods.totalWastageCost || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Gross Profit Summary Line */}
              <div className="bg-neutral-800/60 p-3 rounded-lg flex justify-between items-center text-sm font-bold text-neutral-100">
                <span>GROSS OPERATING PROFIT:</span>
                <span className={(plReport?.grossProfit || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  ₹{(plReport?.grossProfit || 0).toLocaleString()}
                </span>
              </div>

              {/* 3. Operating Expenses */}
              <div className="border border-neutral-800 rounded-xl p-4 space-y-2 bg-neutral-950">
                <div className="font-semibold text-neutral-200 text-sm flex items-center justify-between pb-2 border-b border-neutral-800">
                  <span>3. Operational & Outlet Expenses</span>
                  <span className="text-red-400 font-bold">
                    -₹{(plReport?.expenses.totalOperatingExpenses || 0).toLocaleString()}
                  </span>
                </div>
                <div className="space-y-1.5 pt-1">
                  {Object.keys(plReport?.expenses.byCategory || {}).length === 0 ? (
                    <div className="text-neutral-500 py-1">No operational expenses recorded in this period.</div>
                  ) : (
                    Object.entries(plReport?.expenses.byCategory || {}).map(([cat, amt]) => (
                      <div key={cat} className="flex justify-between text-neutral-400">
                        <span>{cat}:</span>
                        <span className="text-neutral-200 font-medium">₹{amt.toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Net Profit Summary Line */}
              <div className="bg-neutral-800 p-4 rounded-xl flex justify-between items-center text-base font-bold text-neutral-100 border border-neutral-700">
                <span>ESTIMATED NET PROFIT / (LOSS):</span>
                <span
                  className={`text-xl ${
                    (plReport?.estimatedNetProfit || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  ₹{(plReport?.estimatedNetProfit || 0).toLocaleString()}
                </span>
              </div>

              {/* Dedicated Owner Handover / Equity Separation Note */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3.5 flex items-start gap-3">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="text-blue-200 font-semibold">
                    Owner Cash Transferred: ₹{(plReport?.cashTransfersToOwner || 0).toLocaleString()} (Excluded from Expenses)
                  </div>
                  <p className="text-blue-300 text-[11px]">
                    Per PRD Section 13 accounting rules, cash handed over to the owner is an equity draw / capital withdrawal, not an operating expense. It is correctly separated and does not penalize your operational net margin.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
