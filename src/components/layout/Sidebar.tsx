import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  ChefHat,
  Truck,
  Receipt,
  FileSpreadsheet,
  CheckSquare,
  Settings,
  ShieldCheck,
  Lock,
  User,
  LogOut,
} from 'lucide-react';
import type { AppPermissionKey } from '../../types';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  permissionKey?: AppPermissionKey;
  badge?: string;
}

export const Sidebar: React.FC = () => {
  const { currentRole, activeTab, setActiveTab, canAccess, currentUser, logout } = useApp();

  const navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Owner Command Centre',
      icon: <LayoutDashboard className="w-4 h-4" />,
      permissionKey: 'view_dashboard',
      badge: 'Real-time',
    },
    {
      id: 'sales',
      label: 'Sales POS & Billing',
      icon: <ShoppingCart className="w-4 h-4" />,
      permissionKey: 'manage_pos',
    },
    {
      id: 'inventory',
      label: 'Inventory & Ledger',
      icon: <Boxes className="w-4 h-4" />,
      permissionKey: 'view_inventory',
    },
    {
      id: 'kitchen',
      label: 'Kitchen Production',
      icon: <ChefHat className="w-4 h-4" />,
      permissionKey: 'manage_kitchen',
    },
    {
      id: 'transfers',
      label: 'Indents & Dispatches',
      icon: <Truck className="w-4 h-4" />,
      permissionKey: 'manage_transfers',
    },
    {
      id: 'wastage',
      label: 'Wastage & Spoilage',
      icon: <Boxes className="w-4 h-4 text-rose-400" />,
      permissionKey: 'manage_wastage',
    },
    {
      id: 'purchases',
      label: 'Purchases & Suppliers',
      icon: <Receipt className="w-4 h-4" />,
      permissionKey: 'manage_purchases',
    },
    {
      id: 'expenses',
      label: currentRole === 'outlet_staff' || currentRole === 'kitchen_manager' ? 'Outlet Expenses & Bills' : 'Expenses & Credit',
      icon: <FileSpreadsheet className="w-4 h-4" />,
      permissionKey: 'manage_expenses',
    },
    {
      id: 'closing',
      label: '12-Section Daily Closing',
      icon: <CheckSquare className="w-4 h-4" />,
      permissionKey: 'manage_closing',
      badge: '12 Steps',
    },
    {
      id: 'reports',
      label: 'Analytics & P&L',
      icon: <FileSpreadsheet className="w-4 h-4 text-emerald-400" />,
      permissionKey: 'view_reports',
      badge: 'BI',
    },
    {
      id: 'admin',
      label: 'Admin Master Data Hub',
      icon: <Settings className="w-4 h-4" />,
      permissionKey: 'manage_master_data',
    },
    {
      id: 'checkpoint',
      label: 'Phase 1 Verification',
      icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
      badge: 'Checklist',
    },
  ];

  // Filter items using dynamic RBAC permissions
  const allowedNav = navItems.filter(item => {
    if (!item.permissionKey) return true; // Unrestricted utility items like verification
    return canAccess(item.permissionKey);
  });

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex-col justify-between hidden md:flex shrink-0">
      <div className="p-3 space-y-1">
        <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
          <span>Navigation Modules</span>
          {currentRole === 'owner' && (
            <span className="text-[10px] text-orange-400 font-mono flex items-center gap-1 font-bold">
              <Lock className="w-2.5 h-2.5" /> Super Admin
            </span>
          )}
        </div>

        {allowedNav.map(item => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-orange-600 text-white shadow-md shadow-orange-950/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className={isActive ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    isActive ? 'bg-orange-800/80 text-orange-200' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Logged In Staff Profile Card & RBAC Footer */}
      <div className="p-3 border-t border-slate-800/80 space-y-2">
        {currentUser && (
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0 pr-1">
              <div className="w-8 h-8 rounded-lg bg-orange-600/20 border border-orange-500/30 text-orange-400 flex items-center justify-center font-bold text-xs shrink-0">
                {currentUser.full_name
                  ? currentUser.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
                  : 'CK'}
              </div>
              <div className="min-w-0">
                <span className="font-bold text-white block leading-tight truncate text-xs">
                  {currentUser.full_name}
                </span>
                <span className="text-[10px] text-slate-400 font-mono block leading-tight truncate">
                  {currentUser.email || currentUser.phone || currentUser.id}
                </span>
              </div>
            </div>
            <button
              onClick={logout}
              className="p-1 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Access Scope</span>
            <span className="font-extrabold text-orange-400 capitalize">{currentRole.replace('_', ' ')}</span>
          </div>
          {currentRole === 'owner' ? (
            <button
              onClick={() => setActiveTab('admin')}
              className="text-[10px] px-2 py-1 rounded bg-orange-600/20 text-orange-300 border border-orange-500/40 font-bold hover:bg-orange-600/30 transition-colors"
            >
              Manage RBAC
            </button>
          ) : (
            <span className="text-[10px] font-mono text-slate-400">RBAC Active</span>
          )}
        </div>
      </div>
    </aside>
  );
};
