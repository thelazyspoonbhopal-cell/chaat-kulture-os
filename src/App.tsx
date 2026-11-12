import React from 'react';
import { useApp } from './context/AppContext';
import { AppShell } from './components/layout/AppShell';
import { OwnerCommandCentre } from './components/dashboard/OwnerCommandCentre';
import { MasterDataHub } from './components/admin/MasterDataHub';
import { Phase1Checklist } from './components/checkpoints/Phase1Checklist';

// Phase 2 Operational Features
import { SalesPOS } from './features/sales/SalesPOS';
import { InventoryLedgerView } from './features/inventory/InventoryLedgerView';
import { KitchenProduction } from './features/kitchen/KitchenProduction';
import { TransfersManager } from './features/transfers/TransfersManager';
import { WastageManager } from './features/wastage/WastageManager';

// Phase 3 Finance Features
import { PurchasesManager } from './features/purchases/PurchasesManager';
import { ExpensesManager } from './features/expenses/ExpensesManager';

// Phase 4 Management & Reporting Features
import { DailyClosingManager } from './features/closing/DailyClosingManager';
import { ReportsManager } from './features/reports/ReportsManager';
import { LoginPage } from './features/auth/LoginPage';

import { Button } from './components/ui/Button';
import { Lock, ArrowRight, ShieldAlert } from 'lucide-react';
import type { AppPermissionKey } from './types';

const TAB_PERMISSION_MAP: Record<string, AppPermissionKey> = {
  dashboard: 'view_dashboard',
  sales: 'manage_pos',
  inventory: 'view_inventory',
  kitchen: 'manage_kitchen',
  transfers: 'manage_transfers',
  wastage: 'manage_wastage',
  purchases: 'manage_purchases',
  expenses: 'manage_expenses',
  closing: 'manage_closing',
  reports: 'view_reports',
  admin: 'manage_master_data',
};

export const AppContent: React.FC = () => {
  const { activeTab, setActiveTab, currentRole, canAccess } = useApp();

  // Guard: check if current role has access to this tab
  const requiredPermission = TAB_PERMISSION_MAP[activeTab];
  if (requiredPermission && !canAccess(requiredPermission)) {
    return (
      <div className="max-w-md mx-auto my-16 bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center mx-auto shadow-inner">
          <Lock className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-extrabold text-white">Access Restricted by Super Admin</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Your active role <span className="font-extrabold text-orange-400 uppercase">{currentRole.replace('_', ' ')}</span> does not have permission to access the <span className="font-mono text-slate-300 font-semibold">{requiredPermission}</span> capability.
          </p>
        </div>
        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 flex items-center justify-center gap-2">
          <ShieldAlert className="w-4 h-4 text-orange-400 shrink-0" />
          <span>Contact the Super Admin to request access.</span>
        </div>
        <div className="pt-2">
          <Button
            onClick={() => {
              if (canAccess('manage_pos')) setActiveTab('sales');
              else if (canAccess('manage_kitchen')) setActiveTab('kitchen');
              else if (canAccess('view_inventory')) setActiveTab('inventory');
              else setActiveTab('checkpoint');
            }}
            className="w-full justify-center"
          >
            <span>Return to Permitted View</span>
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </div>
      </div>
    );
  }

  switch (activeTab) {
    case 'dashboard':
      return <OwnerCommandCentre />;

    case 'admin':
      return <MasterDataHub />;

    case 'checkpoint':
      return <Phase1Checklist />;

    // Phase 2 Operational Views
    case 'sales':
      return <SalesPOS />;

    case 'inventory':
      return <InventoryLedgerView />;

    case 'kitchen':
      return <KitchenProduction />;

    case 'transfers':
      return <TransfersManager />;

    case 'wastage':
      return <WastageManager />;

    // Phase 3 Finance Views
    case 'purchases':
      return <PurchasesManager />;

    case 'expenses':
      return <ExpensesManager />;

    // Phase 4 Management & Reporting Views
    case 'closing':
      return <DailyClosingManager />;

    case 'reports':
      return <ReportsManager />;

    default:
      return <OwnerCommandCentre />;
  }
};

export const App: React.FC = () => {
  const { isAuthenticated, refreshData, isUnassignedStaff, currentUser, logout } = useApp();

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={() => refreshData()} />;
  }

  // Explicit Zero-Fallback Guard: Block unassigned staff from seeing unauthorized data
  if (isUnassignedStaff) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-extrabold text-white">No Outlet Assigned</h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Hello <span className="text-white font-bold">{currentUser?.full_name}</span>, your account has not been assigned to any physical outlet or kitchen yet.
            </p>
            <p className="text-xs text-slate-400">
              Please contact your Super Admin to assign your designated outlet in Staff Settings before accessing POS or kitchen operations.
            </p>
          </div>
          <div className="pt-4">
            <Button onClick={logout} variant="secondary" className="w-full justify-center">
              Sign Out & Switch Account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <AppContent />
    </AppShell>
  );
};

export default App;
