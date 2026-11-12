import React from 'react';
import { useApp } from '../../context/AppContext';
import { LayoutDashboard, ShoppingCart, Boxes, Truck, CheckSquare, Settings, ShieldCheck } from 'lucide-react';
import type { AppPermissionKey } from '../../types';

interface MobileNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  permissionKey?: AppPermissionKey;
}

export const MobileNav: React.FC = () => {
  const { activeTab, setActiveTab, canAccess } = useApp();

  const mobileItems: MobileNavItem[] = [
    { id: 'dashboard', label: 'Home', icon: <LayoutDashboard className="w-5 h-5" />, permissionKey: 'view_dashboard' },
    { id: 'sales', label: 'POS', icon: <ShoppingCart className="w-5 h-5" />, permissionKey: 'manage_pos' },
    { id: 'inventory', label: 'Stock', icon: <Boxes className="w-5 h-5" />, permissionKey: 'view_inventory' },
    { id: 'transfers', label: 'Indents', icon: <Truck className="w-5 h-5" />, permissionKey: 'manage_transfers' },
    { id: 'closing', label: 'Closing', icon: <CheckSquare className="w-5 h-5" />, permissionKey: 'manage_closing' },
    { id: 'admin', label: 'Admin', icon: <Settings className="w-5 h-5" />, permissionKey: 'manage_master_data' },
    { id: 'checkpoint', label: 'Verify', icon: <ShieldCheck className="w-5 h-5" /> },
  ];

  const allowed = mobileItems.filter(item => {
    if (!item.permissionKey) return true;
    return canAccess(item.permissionKey);
  });

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950 border-t border-slate-800 px-2 py-1.5 flex items-center justify-around shadow-2xl">
      {allowed.map(item => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all ${
              isActive ? 'text-orange-500 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {item.icon}
            <span className="text-[10px] mt-0.5">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
