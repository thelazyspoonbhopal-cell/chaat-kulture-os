import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { settingsRepo } from '../../lib/dal/settingsRepo';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Sliders, ToggleLeft, ToggleRight, Building, Percent, Shield } from 'lucide-react';
import type { Business, FeatureFlag } from '../../types';

export const SettingsMaster: React.FC = () => {
  const { showToast } = useApp();
  const [business, setBusiness] = useState<Business | null>(null);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [defaultTax, setDefaultTax] = useState<string>('5.0');
  const [businessName, setBusinessName] = useState<string>('Chaat Kulture');

  const loadSettings = async () => {
    try {
      const biz = await settingsRepo.getBusiness();
      const allFlags = await settingsRepo.getFeatureFlags();
      if (biz) {
        setBusiness(biz);
        setDefaultTax(biz.default_tax_rate.toString());
        setBusinessName(biz.name);
      }
      setFlags(allFlags);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await settingsRepo.updateBusiness({
        name: businessName.trim(),
        default_tax_rate: parseFloat(defaultTax) || 5.0,
      });
      showToast('Business settings and default GST rate saved', 'success');
      await loadSettings();
    } catch (err) {
      console.error(err);
      showToast('Error saving business settings', 'error');
    }
  };

  const handleToggleFlag = async (flag: FeatureFlag) => {
    try {
      await settingsRepo.toggleFeatureFlag(flag.id, !flag.is_enabled);
      showToast(`${flag.name} is now ${!flag.is_enabled ? 'Enabled' : 'Disabled'}`, 'info');
      await loadSettings();
    } catch (err) {
      console.error(err);
      showToast('Error updating feature toggle', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-white tracking-tight">Business Configuration & GST Engine</h2>
        <p className="text-xs text-slate-400">
          Configure business profile, default GST tax rate, and the 6 Admin Command Centre feature switches.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Business Settings Card */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Building className="w-5 h-5 text-orange-400" />
            <h3 className="font-bold text-sm text-white">Business Profile & Tax Rules</h3>
          </div>

          <form onSubmit={handleSaveBusiness} className="space-y-4">
            <Input
              label="Business Legal Name"
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Currency"
                value="INR (₹)"
                disabled
                helperText="Indian Rupee fixed standard"
              />
              <Input
                label="Default GST Tax Rate (%)"
                type="number"
                step="0.1"
                min="0"
                value={defaultTax}
                onChange={e => setDefaultTax(e.target.value)}
                helperText="Default rate applied when adding new dishes"
                required
              />
            </div>

            <div className="pt-2">
              <Button variant="primary" size="sm" type="submit">
                Save Tax & Business Settings
              </Button>
            </div>
          </form>
        </div>

        {/* 6 Feature Flags Toggles */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-orange-400" />
              <h3 className="font-bold text-sm text-white">6 Admin Feature Controls</h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">PRD Section 20</span>
          </div>

          <div className="divide-y divide-slate-800/80">
            {flags.map(flag => (
              <div key={flag.id} className="py-2.5 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-white">{flag.name}</span>
                    {flag.feature_key === 'recipe_costing' && (
                      <span className="text-[9px] bg-amber-950 text-amber-400 border border-amber-800 px-1.5 py-0.2 rounded">
                        Disabled by PRD Rule
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{flag.description}</p>
                </div>

                <button
                  onClick={() => handleToggleFlag(flag)}
                  className="shrink-0 text-lg transition-transform active:scale-95"
                >
                  {flag.is_enabled ? (
                    <span className="text-emerald-400 flex items-center gap-1 text-xs font-bold">
                      <ToggleRight className="w-6 h-6" />
                    </span>
                  ) : (
                    <span className="text-slate-600 flex items-center gap-1 text-xs font-bold">
                      <ToggleLeft className="w-6 h-6" />
                    </span>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
