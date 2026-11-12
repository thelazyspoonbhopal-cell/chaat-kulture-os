import React, { useState } from 'react';
import { MenuMaster } from './MenuMaster';
import { InventoryMaster } from './InventoryMaster';
import { SuppliersMaster } from './SuppliersMaster';
import { LocationsMaster } from './LocationsMaster';
import { UnitsMaster } from './UnitsMaster';
import { SettingsMaster } from './SettingsMaster';
import { RbacMaster } from './RbacMaster';
import { StaffMaster } from './StaffMaster';
import { SecurityAuditMaster } from './SecurityAuditMaster';
import { Utensils, Boxes, Building2, Store, Scale, Sliders, ShieldCheck, Users, ShieldAlert } from 'lucide-react';

export const MasterDataHub: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'menu' | 'inventory' | 'suppliers' | 'locations' | 'units' | 'settings' | 'rbac' | 'staff' | 'security'>('menu');

  const tabs = [
    { id: 'menu', label: 'Menu Catalog', icon: <Utensils className="w-4 h-4" /> },
    { id: 'inventory', label: 'Inventory Master', icon: <Boxes className="w-4 h-4" /> },
    { id: 'suppliers', label: 'Suppliers', icon: <Building2 className="w-4 h-4" /> },
    { id: 'locations', label: 'Locations (4 Outlets)', icon: <Store className="w-4 h-4" /> },
    { id: 'staff', label: 'Staff & Outlet Access', icon: <Users className="w-4 h-4 text-orange-400" /> },
    { id: 'security', label: 'Security & Access Logs', icon: <ShieldAlert className="w-4 h-4 text-rose-400" /> },
    { id: 'units', label: 'Units & Conversions', icon: <Scale className="w-4 h-4" /> },
    { id: 'settings', label: 'Business & 6 Flags', icon: <Sliders className="w-4 h-4" /> },
    { id: 'rbac', label: 'Role Permissions (RBAC)', icon: <ShieldCheck className="w-4 h-4 text-orange-400" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Sub Navigation Bar */}
      <div className="bg-slate-900 border border-slate-800 p-1.5 rounded-2xl flex flex-wrap gap-1.5 shadow-sm">
        {tabs.map(tab => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-orange-600 text-white shadow-md shadow-orange-950/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Selected Master View */}
      <div>
        {currentTab === 'menu' && <MenuMaster />}
        {currentTab === 'inventory' && <InventoryMaster />}
        {currentTab === 'suppliers' && <SuppliersMaster />}
        {currentTab === 'locations' && <LocationsMaster />}
        {currentTab === 'staff' && <StaffMaster />}
        {currentTab === 'security' && <SecurityAuditMaster />}
        {currentTab === 'units' && <UnitsMaster />}
        {currentTab === 'settings' && <SettingsMaster />}
        {currentTab === 'rbac' && <RbacMaster />}
      </div>
    </div>
  );
};
