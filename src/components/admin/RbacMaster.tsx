import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PERMISSION_DEFINITIONS } from '../../lib/dal/rbacRepo';
import type { UserRole, AppPermissionKey } from '../../types';
import {
  ShieldCheck,
  Lock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  Info,
  Sliders,
  Users
} from 'lucide-react';

export const RbacMaster: React.FC = () => {
  const { currentRole, roleConfigs, updateRolePermission, resetRolePermissions, showToast } = useApp();
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<UserRole | 'all'>('all');
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const isSuperAdmin = currentRole === 'owner';

  // Group permissions by category
  const categories = ['Operations', 'Inventory', 'Finance', 'Administration'] as const;

  const handleToggle = async (role: UserRole, key: AppPermissionKey, currentVal: boolean) => {
    if (!isSuperAdmin) {
      showToast('Only Super Admin (Owner) can modify role permissions', 'error');
      return;
    }
    if (role === 'owner') {
      showToast('Super Admin root permissions are immutable to prevent system lockout', 'warning');
      return;
    }
    await updateRolePermission(role, key, !currentVal);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-extrabold text-white">Super Admin Role-Based Access Control (RBAC)</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-950 text-orange-400 border border-orange-800">
              Dynamic Matrix
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Define and enforce feature-level permissions across all roles. Changes take effect instantly across all connected terminals.
          </p>
        </div>

        {/* Super Admin Control Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {isSuperAdmin ? (
            <>
              <button
                onClick={() => setIsResetConfirmOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-orange-400" />
                <span>Reset to Factory Defaults</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-950/40 text-amber-300 border border-amber-800/60">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>View-Only Mode (Super Admin Required to Edit)</span>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal for Reset */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-extrabold text-base text-white">Reset All Role Permissions?</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              This will restore all default access rules for Managers, Kitchen Managers, and Outlet Staff. Custom role adjustments will be replaced with standard factory defaults.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await resetRolePermissions();
                  setIsResetConfirmOpen(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-extrabold bg-orange-600 hover:bg-orange-500 text-white transition-colors"
              >
                Yes, Restore Factory Defaults
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Summary Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {roleConfigs.map(cfg => {
          const enabledCount = Object.values(cfg.permissions).filter(Boolean).length;
          const totalCount = PERMISSION_DEFINITIONS.length;

          return (
            <div
              key={cfg.role}
              className={`p-3.5 rounded-xl border transition-all ${
                cfg.role === 'owner'
                  ? 'bg-orange-950/20 border-orange-600/40 text-orange-200'
                  : 'bg-slate-900/90 border-slate-800 text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                <span className="font-bold text-xs flex items-center gap-1.5 text-white">
                  {cfg.role === 'owner' && <Lock className="w-3 h-3 text-orange-400" />}
                  {cfg.role_name}
                </span>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {enabledCount}/{totalCount}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed line-clamp-2">
                {cfg.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Permission Matrix Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-300 font-bold border-b border-slate-800 uppercase tracking-wider">
              <tr>
                <th className="p-3.5 min-w-[280px]">Feature & Access Capability</th>
                <th className="p-3.5 text-center min-w-[130px]">
                  <div className="text-orange-400 font-extrabold flex items-center justify-center gap-1">
                    <Lock className="w-3 h-3" />
                    <span>Super Admin</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-normal">Root Authority</span>
                </th>
                <th className="p-3.5 text-center min-w-[130px]">
                  <div className="text-white font-extrabold">Manager</div>
                  <span className="text-[10px] text-slate-400 font-normal">Operations Overseer</span>
                </th>
                <th className="p-3.5 text-center min-w-[130px]">
                  <div className="text-white font-extrabold">Kitchen Manager</div>
                  <span className="text-[10px] text-slate-400 font-normal">Base Kitchen Lead</span>
                </th>
                <th className="p-3.5 text-center min-w-[130px]">
                  <div className="text-white font-extrabold">Outlet Staff</div>
                  <span className="text-[10px] text-slate-400 font-normal">Counter Cashier</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {categories.map(category => {
                const categoryPermissions = PERMISSION_DEFINITIONS.filter(p => p.category === category);

                return (
                  <React.Fragment key={category}>
                    {/* Category Divider Header */}
                    <tr className="bg-slate-950/60 font-bold text-slate-300">
                      <td colSpan={5} className="px-3.5 py-2 text-[11px] uppercase tracking-wider text-orange-400">
                        {category} Domain ({categoryPermissions.length} Capabilities)
                      </td>
                    </tr>

                    {categoryPermissions.map(perm => (
                      <tr key={perm.key} className="hover:bg-slate-800/40 transition-colors">
                        {/* Capability Label & Description */}
                        <td className="p-3.5">
                          <div className="font-bold text-slate-100 flex items-center gap-2">
                            <span>{perm.label}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-slate-800 text-slate-400">
                              {perm.key}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                            {perm.description}
                          </p>
                        </td>

                        {/* Owner Column (Root Immutable) */}
                        <td className="p-3.5 text-center">
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 font-bold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Granted</span>
                          </div>
                        </td>

                        {/* Manager Column */}
                        <td className="p-3.5 text-center">
                          {(() => {
                            const mgrCfg = roleConfigs.find(c => c.role === 'manager');
                            const isGranted = !!mgrCfg?.permissions[perm.key];
                            return (
                              <button
                                disabled={!isSuperAdmin}
                                onClick={() => handleToggle('manager', perm.key, isGranted)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                                  isGranted
                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
                                } ${!isSuperAdmin ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                                title={isSuperAdmin ? `Click to toggle ${perm.label} for Manager` : 'Super Admin action'}
                              >
                                {isGranted ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Enabled</span>
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Disabled</span>
                                  </>
                                )}
                              </button>
                            );
                          })()}
                        </td>

                        {/* Kitchen Manager Column */}
                        <td className="p-3.5 text-center">
                          {(() => {
                            const kmCfg = roleConfigs.find(c => c.role === 'kitchen_manager');
                            const isGranted = !!kmCfg?.permissions[perm.key];
                            return (
                              <button
                                disabled={!isSuperAdmin}
                                onClick={() => handleToggle('kitchen_manager', perm.key, isGranted)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                                  isGranted
                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
                                } ${!isSuperAdmin ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                                title={isSuperAdmin ? `Click to toggle ${perm.label} for Kitchen Manager` : 'Super Admin action'}
                              >
                                {isGranted ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Enabled</span>
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Disabled</span>
                                  </>
                                )}
                              </button>
                            );
                          })()}
                        </td>

                        {/* Outlet Staff Column */}
                        <td className="p-3.5 text-center">
                          {(() => {
                            const staffCfg = roleConfigs.find(c => c.role === 'outlet_staff');
                            const isGranted = !!staffCfg?.permissions[perm.key];
                            return (
                              <button
                                disabled={!isSuperAdmin}
                                onClick={() => handleToggle('outlet_staff', perm.key, isGranted)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                                  isGranted
                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
                                } ${!isSuperAdmin ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                                title={isSuperAdmin ? `Click to toggle ${perm.label} for Outlet Staff` : 'Super Admin action'}
                              >
                                {isGranted ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Enabled</span>
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Disabled</span>
                                  </>
                                )}
                              </button>
                            );
                          })()}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Callout */}
      <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-start gap-3 text-xs text-slate-400">
        <Info className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold text-slate-200 block">Immediate RBAC Enforcement</span>
          <p className="leading-relaxed">
            When you enable or disable a capability above, the navigation tabs and operational actions for that role update in real-time. If staff members attempt to access a restricted view or URL directly, the system blocks the request and presents a security notification.
          </p>
        </div>
      </div>
    </div>
  );
};
