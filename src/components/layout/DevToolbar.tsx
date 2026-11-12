import React from 'react';
import { useApp } from '../../context/AppContext';
import { Shield, MapPin, Database, Sparkles, Trash2, CheckCircle, User, Lock } from 'lucide-react';
import type { UserRole } from '../../types';

export const DevToolbar: React.FC = () => {
  const {
    currentRole,
    currentUser,
    users,
    currentLocation,
    locations,
    accessibleLocations,
    setRole,
    setCurrentUser,
    setLocation,
    isTestMode,
    setIsSandboxModalOpen,
    activeTab,
    setActiveTab,
  } = useApp();

  const isRestricted = accessibleLocations.length < locations.length;

  return (
    <div className="bg-slate-950 border-b border-orange-500/20 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-orange-600/20 border border-orange-500/40 rounded-md text-orange-400 font-bold uppercase tracking-wider text-[10px]">
          <Shield className="w-3 h-3" />
          <span>Local Dev Toolbar</span>
        </div>

        {/* Active Staff Persona Switcher */}
        <div className="flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-slate-400 font-medium">Active User:</span>
          <select
            value={currentUser?.id || ''}
            onChange={e => {
              const u = users.find(usr => usr.id === e.target.value);
              if (u) setCurrentUser(u);
            }}
            className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus:border-orange-500 max-w-[210px] truncate"
          >
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.full_name} ({u.role.replace('_', ' ')})
              </option>
            ))}
          </select>
        </div>

        {/* Location Switcher — Strictly Filtered to User's Accessible Locations */}
        <div className="flex items-center gap-1.5">
          {isRestricted ? (
            <span title="Location selection strictly restricted to assigned outlets">
              <Lock className="w-3 h-3 text-amber-400" />
            </span>
          ) : (
            <MapPin className="w-3 h-3 text-orange-400" />
          )}
          <span className="text-slate-400 font-medium">Location:</span>
          <select
            value={currentLocation?.id || ''}
            onChange={e => {
              const loc = accessibleLocations.find(l => l.id === e.target.value);
              if (loc) setLocation(loc);
            }}
            className={`bg-slate-900 border rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none ${
              isRestricted
                ? 'border-amber-500/50 text-amber-300'
                : 'border-slate-700 text-orange-300 focus:border-orange-500'
            }`}
          >
            {accessibleLocations.map(loc => (
              <option key={loc.id} value={loc.id}>
                {loc.code} — {loc.name}
              </option>
            ))}
          </select>

          {isRestricted && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800/60 font-semibold">
              🔒 Scoped ({accessibleLocations.length}/{locations.length})
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Verification Checkpoints Jump Button */}
        <button
          onClick={() => setActiveTab('checkpoint')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
            activeTab === 'checkpoint'
              ? 'bg-emerald-600 text-white border-emerald-500'
              : 'bg-emerald-950/40 text-emerald-300 border-emerald-800 hover:bg-emerald-900/60'
          }`}
        >
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          <span>Phase 1 Verification Suite</span>
        </button>

        {/* Testing Sandbox Trigger Button */}
        <button
          onClick={() => setIsSandboxModalOpen(true)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
            isTestMode
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30'
              : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
          }`}
        >
          <Database className="w-3.5 h-3.5 text-orange-400" />
          <span>Testing Sandbox</span>
          {isTestMode ? (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          ) : (
            <span className="text-[10px] text-slate-400 font-normal">(Clean Masters)</span>
          )}
        </button>
      </div>
    </div>
  );
};
