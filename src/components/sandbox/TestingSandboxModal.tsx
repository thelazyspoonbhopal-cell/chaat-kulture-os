import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  Database,
  Sparkles,
  Trash2,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  ChefHat,
  ShoppingCart,
  Receipt,
  LayoutDashboard
} from 'lucide-react';

export const TestingSandboxModal: React.FC = () => {
  const {
    isSandboxModalOpen,
    setIsSandboxModalOpen,
    demoStats,
    loadDemoData,
    purgeDemoData,
    isTestMode,
  } = useApp();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState<boolean>(false);

  const handleLoad = async () => {
    setIsLoading(true);
    await loadDemoData();
    setIsLoading(false);
  };

  const handlePurge = async () => {
    setIsLoading(true);
    await purgeDemoData();
    setIsLoading(false);
    setShowPurgeConfirm(false);
  };

  return (
    <Modal
      isOpen={isSandboxModalOpen}
      onClose={() => {
        setIsSandboxModalOpen(false);
        setShowPurgeConfirm(false);
      }}
      title="Testing Sandbox & Multi-Role Demonstration Manager"
      subtitle="Loads realistic end-to-end operational and financial data for all roles across all 4 locations"
      maxWidth="2xl"
    >
      <div className="space-y-6">
        {/* Status Card */}
        <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-orange-400" />
              <span className="font-bold text-sm text-white">Database Environment State</span>
            </div>
            {isTestMode ? (
              <Badge variant="warning" size="md">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                Full Multi-Role Demo Active
              </Badge>
            ) : (
              <Badge variant="success" size="md">
                <CheckCircle2 className="w-3.5 h-3.5" />
                100% Clean Masters
              </Badge>
            )}
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            {isTestMode
              ? 'Complete operational demo records are loaded across all 4 physical locations. You can test as Super Admin, Manager, Kitchen Manager, or Outlet Staff. Every demo record is strictly tagged with is_demo: true.'
              : 'Your database has zero mock items. Click below to load realistic chaat recipes, raw materials, supplier bills, batch yields, transfers, and sales to test all roles.'}
          </p>

          {/* Counts Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-center text-xs">
            <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-semibold">Menu Dishes</span>
              <span className="font-bold text-white text-sm">
                {demoStats.realMenu}{' '}
                {demoStats.demoMenu > 0 && (
                  <span className="text-amber-400 text-xs">({demoStats.demoMenu} demo)</span>
                )}
              </span>
            </div>
            <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-semibold">Inventory SKUs</span>
              <span className="font-bold text-white text-sm">
                {demoStats.realInv}{' '}
                {demoStats.demoInv > 0 && (
                  <span className="text-amber-400 text-xs">({demoStats.demoInv} demo)</span>
                )}
              </span>
            </div>
            <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-semibold">Suppliers</span>
              <span className="font-bold text-white text-sm">
                {demoStats.realSuppliers}{' '}
                {demoStats.demoSuppliers > 0 && (
                  <span className="text-amber-400 text-xs">({demoStats.demoSuppliers} demo)</span>
                )}
              </span>
            </div>
            <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-semibold">Test Orders</span>
              <span className="font-bold text-white text-sm">
                {demoStats.demoSales > 0 ? (
                  <span className="text-amber-400">{demoStats.demoSales} bills</span>
                ) : (
                  '0 bills'
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Role-Specific Capabilities Included */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
            What Data is Included for Each Role:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-orange-400">
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>👑 Super Admin / Owner</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                4-Location stock matrix, channel revenue breakdown, gross margin analytics, supplier payables ledger, and ₹14,000 cash transfer to owner.
              </p>
            </div>

            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-blue-400">
                <Receipt className="w-3.5 h-3.5" />
                <span>👔 General / Outlet Manager</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Purchase invoices (Amul, EcoPack), credit expenses (refrigeration maintenance), 12-section shift closing, and stock discrepancy audit.
              </p>
            </div>

            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                <ChefHat className="w-3.5 h-3.5" />
                <span>🍳 Kitchen Manager (BASE-01)</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Batch yield production (52kg Tikki mix, 45kg Bhaji), raw material consumption variance, and outbound dispatch to outlets.
              </p>
            </div>

            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-purple-400">
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>🏪 Outlet Staff (Cashier)</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Counter POS quick-billing, split tenders (Cash + UPI), Zomato orders, inbound stock receiving with transit damage logging.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        {!showPurgeConfirm ? (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="primary"
                onClick={handleLoad}
                isLoading={isLoading}
                className="flex-1"
              >
                <Sparkles className="w-4 h-4" />
                <span>Load Complete Multi-Role Demo Data</span>
              </Button>

              <Button
                variant="danger"
                onClick={() => setShowPurgeConfirm(true)}
                disabled={!demoStats.hasDemoData || isLoading}
                className="flex-1"
              >
                <Trash2 className="w-4 h-4" />
                <span>Safe Purge Test Data</span>
              </Button>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Zero-Risk Guarantee:</strong> Purging test data will <strong>only delete records tagged with <code>is_demo: true</code></strong>. Your real master items, four approved locations, unit conversions, and settings will never be touched.
              </span>
            </div>
          </div>
        ) : (
          /* Purge Confirmation Step */
          <div className="p-4 bg-rose-950/40 border border-rose-800/80 rounded-xl space-y-4 animate-in fade-in">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-rose-200 text-sm">Confirm Safe Purge of Demo Data?</h4>
                <p className="text-xs text-rose-300/80 mt-1">
                  This will remove all demo dishes, demo raw materials, test bills, simulated dispatches, batch yields, and test closings.
                  Your real business configuration, settings, and 4 locations will remain intact.
                </p>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowPurgeConfirm(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handlePurge}
                isLoading={isLoading}
              >
                Yes, Purge Test Records
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
