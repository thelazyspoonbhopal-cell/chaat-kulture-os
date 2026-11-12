import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { db } from '../../lib/db';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  TrendingUp,
  CreditCard,
  Banknote,
  Receipt,
  Boxes,
  Truck,
  CheckSquare,
  AlertTriangle,
  Store,
} from 'lucide-react';
import type { Sale, Location } from '../../types';

export const OwnerCommandCentre: React.FC = () => {
  const { locations, isTestMode, setActiveTab } = useApp();
  const [sales, setSales] = useState<Sale[]>([]);
  const [totalSales, setTotalSales] = useState<number>(0);
  const [cashSales, setCashSales] = useState<number>(0);
  const [upiSales, setUpiSales] = useState<number>(0);
  const [pendingDispatches, setPendingDispatches] = useState<number>(0);

  useEffect(() => {
    const fetchDashboardMetrics = async () => {
      const allSales = await db.sales.toArray();
      setSales(allSales);

      let total = 0;
      let cash = 0;
      let upi = 0;

      allSales.forEach(s => {
        total += s.net_amount;
        s.payments?.forEach(p => {
          if (p.payment_method === 'cash') cash += p.amount;
          if (p.payment_method === 'upi') upi += p.amount;
        });
      });

      setTotalSales(total);
      setCashSales(cash);
      setUpiSales(upi);

      const inTransit = await db.dispatches.where('status').equals('in_transit').count();
      setPendingDispatches(inTransit);
    };

    fetchDashboardMetrics();
  }, [isTestMode]);

  return (
    <div className="space-y-6">
      {/* Top Welcome & Mode Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 bg-gradient-to-r from-slate-900 to-slate-900/60 border border-slate-800 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-orange-400">
              Live Operations Monitoring
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-black text-white mt-1">
            Owner Command Centre — Chaat Kulture
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Consolidated overview across Base Kitchen, Central Store Room, Shahpura, and 11 No. Stop.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isTestMode ? (
            <Badge variant="warning" size="md">
              🧪 Demonstration Mode Active
            </Badge>
          ) : (
            <Badge variant="success" size="md">
              ✨ 100% Production Ready Masters
            </Badge>
          )}
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Total Sales */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Today's Net Sales</span>
            <TrendingUp className="w-4 h-4 text-orange-400" />
          </div>
          <div className="text-xl md:text-2xl font-black text-white">
            ₹{totalSales.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400">
            {sales.length} orders recorded across outlets
          </div>
        </div>

        {/* Cash Collections */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Cash Collections</span>
            <Banknote className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl md:text-2xl font-black text-emerald-400 font-mono">
            ₹{cashSales.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400">Drawer physical audit required</div>
        </div>

        {/* UPI Collections */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Merchant UPI / QR</span>
            <CreditCard className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl md:text-2xl font-black text-blue-400 font-mono">
            ₹{upiSales.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400">Direct settlement to bank</div>
        </div>

        {/* Pending Dispatches */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">In-Transit Dispatches</span>
            <Truck className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl md:text-2xl font-black text-amber-400">
            {pendingDispatches} Challans
          </div>
          <div className="text-[11px] text-slate-400">Awaiting outlet receiving check</div>
        </div>
      </div>

      {/* 4 Separate Locations Live Operations Status */}
      <div className="space-y-3">
        <h3 className="font-bold text-sm text-white flex items-center gap-2">
          <Store className="w-4 h-4 text-orange-400" />
          <span>Four Locations Operations Status</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {locations.map(loc => (
            <div
              key={loc.id}
              className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3 flex flex-col justify-between hover:border-slate-700 transition-all"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold font-mono text-orange-400 bg-orange-950/60 px-2 py-0.5 rounded border border-orange-800/60">
                    {loc.code}
                  </span>
                  <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                  </span>
                </div>
                <h4 className="font-bold text-sm text-white mt-2">{loc.name}</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">{loc.address}</p>
              </div>

              <div className="pt-3 border-t border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Type:</span>
                  <span className="font-bold text-white uppercase text-[10px] tracking-wider">
                    {loc.type.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Stock Ledgers:</span>
                  <span className="font-mono text-emerald-400 font-bold">Independent</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Action Navigation Tiles */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
        <h3 className="font-bold text-sm text-white">Quick Workflow Shortcuts</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <button
            onClick={() => setActiveTab('admin')}
            className="p-3 bg-slate-950 border border-slate-800 hover:border-orange-500/60 rounded-xl text-left transition-all group"
          >
            <Boxes className="w-5 h-5 text-orange-400 mb-1 group-hover:scale-110 transition-transform" />
            <div className="font-bold text-white">Master Data Hub</div>
            <div className="text-[10px] text-slate-400">Configure dishes & inventory</div>
          </button>

          <button
            onClick={() => setActiveTab('checkpoint')}
            className="p-3 bg-slate-950 border border-slate-800 hover:border-emerald-500/60 rounded-xl text-left transition-all group"
          >
            <CheckSquare className="w-5 h-5 text-emerald-400 mb-1 group-hover:scale-110 transition-transform" />
            <div className="font-bold text-white">Phase 1 Checkpoints</div>
            <div className="text-[10px] text-slate-400">Run verification checklist</div>
          </button>

          <button
            onClick={() => setActiveTab('pos')}
            className="p-3 bg-slate-950 border border-slate-800 hover:border-blue-500/60 rounded-xl text-left transition-all group"
          >
            <Receipt className="w-5 h-5 text-blue-400 mb-1 group-hover:scale-110 transition-transform" />
            <div className="font-bold text-white">Sales POS Billing</div>
            <div className="text-[10px] text-slate-400">Rapid counter order punching</div>
          </button>

          <button
            onClick={() => setActiveTab('admin')}
            className="p-3 bg-slate-950 border border-slate-800 hover:border-amber-500/60 rounded-xl text-left transition-all group"
          >
            <Store className="w-5 h-5 text-amber-400 mb-1 group-hover:scale-110 transition-transform" />
            <div className="font-bold text-white">4 Locations Config</div>
            <div className="text-[10px] text-slate-400">Kitchen & Store settings</div>
          </button>
        </div>
      </div>
    </div>
  );
};
