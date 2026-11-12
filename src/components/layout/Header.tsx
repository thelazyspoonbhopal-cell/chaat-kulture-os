import React from 'react';
import { useApp } from '../../context/AppContext';
import { Store, Wifi, WifiOff, User, Server, RefreshCw, LogOut, Database, Cloud } from 'lucide-react';

export const Header: React.FC = () => {
  const {
    currentLocation,
    setLocation,
    accessibleLocations,
    currentRole,
    currentUser,
    isOnline,
    logout,
    syncStatus,
    triggerSync,
  } = useApp();

  const isSyncing = syncStatus.state === 'syncing';

  const roleLabels = {
    owner: 'Owner / Super Admin',
    manager: 'Manager',
    kitchen_manager: 'Kitchen Manager',
    outlet_staff: 'Outlet Staff',
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 px-4 md:px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-orange-600 flex items-center justify-center font-black text-white text-base shadow-md shadow-orange-950/40">
            CK
          </div>
          <div>
            <h1 className="font-extrabold text-sm md:text-base tracking-tight text-white flex items-center gap-2">
              <span>CHAAT KULTURE OS</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-orange-950/80 text-orange-400 border border-orange-800 font-mono">
                v2.4
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Multi-Location Food Operations System
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Multi-Tier Sync & Database Target Status */}
        <div
          onClick={() => triggerSync()}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] ${
            syncStatus.target === 'local_and_cloud'
              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
              : syncStatus.target === 'cloud_only'
              ? 'bg-blue-950/40 text-blue-300 border-blue-800/60'
              : syncStatus.target === 'local_only'
              ? 'bg-cyan-950/40 text-cyan-300 border-cyan-800/60'
              : 'bg-slate-950 text-slate-400 border-slate-800'
          }`}
          title={`Sync Target: ${syncStatus.target.replace(/_/g, ' ').toUpperCase()} | Last Synced: ${
            syncStatus.lastSyncTime ? syncStatus.lastSyncTime.toLocaleTimeString() : 'Pending'
          } (Click to trigger instant manual sync)`}
        >
          {syncStatus.target === 'local_and_cloud' ? (
            <Cloud className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : syncStatus.target === 'cloud_only' ? (
            <Cloud className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          ) : syncStatus.target === 'local_only' ? (
            <Database className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          ) : (
            <Server className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          )}

          <span className="hidden md:inline font-mono text-[11px]">
            {isSyncing
              ? 'Replicating...'
              : syncStatus.target === 'local_and_cloud'
              ? 'Local + Cloud Synced'
              : syncStatus.target === 'cloud_only'
              ? 'Supabase Cloud'
              : syncStatus.target === 'local_only'
              ? 'Server Synced'
              : 'Offline (Local)'}
          </span>

          <RefreshCw
            className={`w-3 h-3 text-slate-400 hover:text-white transition-transform ${
              isSyncing ? 'animate-spin text-orange-400' : ''
            }`}
          />
        </div>

        {/* Active Location Display / Selector */}
        {currentLocation && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950 rounded-xl border border-slate-800 text-xs">
            <Store className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            <div>
              {accessibleLocations.length > 1 ? (
                <select
                  value={currentLocation.id}
                  onChange={e => {
                    const loc = accessibleLocations.find(l => l.id === e.target.value);
                    if (loc) setLocation(loc);
                  }}
                  className="bg-transparent font-bold text-white block leading-tight cursor-pointer focus:outline-none"
                  title="Switch between your assigned outlets"
                >
                  {accessibleLocations.map(l => (
                    <option key={l.id} value={l.id} className="bg-slate-900 text-white">
                      {l.name} ({l.code})
                    </option>
                  ))}
                </select>
              ) : (
                <span className="font-bold text-white block leading-tight">{currentLocation.name}</span>
              )}
              <span className="text-[10px] text-slate-400 font-mono">{currentLocation.code}</span>
            </div>
          </div>
        )}

        {/* Offline / Online Status Badge */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
            isOnline
              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60'
              : 'bg-amber-950/40 text-amber-400 border-amber-800/60'
          }`}
          title={isOnline ? 'Online (Connected)' : 'Offline (Saved in IndexedDB)'}
        >
          {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          <span className="hidden md:inline">{isOnline ? 'PWA Ready' : 'IndexedDB Mode'}</span>
        </div>

        {/* Active User Avatar & Role */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <div className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center text-xs font-bold">
            <User className="w-4 h-4 text-orange-400" />
          </div>
          <div className="hidden lg:block text-left">
            <span className="text-xs font-bold text-slate-200 block leading-tight">
              {currentUser?.full_name || roleLabels[currentRole]}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {roleLabels[currentRole]}
            </span>
          </div>
        </div>

        {/* Sign Out Button */}
        <button
          onClick={logout}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800/80 hover:bg-rose-950/60 hover:text-rose-300 text-slate-300 border border-slate-700/70 hover:border-rose-800/60 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          title="Sign Out (Securely terminate active session)"
        >
          <LogOut className="w-3.5 h-3.5 text-rose-400" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
};
