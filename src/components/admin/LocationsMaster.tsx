import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { locationsRepo } from '../../lib/dal/locationsRepo';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Plus, Store, Edit2, Phone, MapPin, ToggleLeft, ToggleRight } from 'lucide-react';
import type { Location, LocationType } from '../../types';

export const LocationsMaster: React.FC = () => {
  const { locations, showToast, refreshData } = useApp();
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);

  // Form state
  const [formName, setFormName] = useState<string>('');
  const [formCode, setFormCode] = useState<string>('');
  const [formType, setFormType] = useState<LocationType>('outlet');
  const [formAddress, setFormAddress] = useState<string>('');
  const [formPhone, setFormPhone] = useState<string>('');

  const openAddModal = () => {
    setEditingLocation(null);
    setFormName('');
    setFormCode('');
    setFormType('outlet');
    setFormAddress('');
    setFormPhone('');
    setIsModalOpen(true);
  };

  const openEditModal = (loc: Location) => {
    setEditingLocation(loc);
    setFormName(loc.name);
    setFormCode(loc.code);
    setFormType(loc.type);
    setFormAddress(loc.address || '');
    setFormPhone(loc.phone || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formCode.trim()) {
      showToast('Location name and code are required', 'warning');
      return;
    }

    try {
      if (editingLocation) {
        await locationsRepo.update(editingLocation.id, {
          name: formName.trim(),
          code: formCode.trim().toUpperCase(),
          type: formType,
          address: formAddress.trim(),
          phone: formPhone.trim(),
        });
        showToast(`Updated location: ${formName}`, 'success');
      } else {
        await locationsRepo.add({
          business_id: 'biz_chaatkulture_01',
          name: formName.trim(),
          code: formCode.trim().toUpperCase(),
          type: formType,
          address: formAddress.trim(),
          phone: formPhone.trim(),
          is_active: true,
        });
        showToast(`Created new location: ${formName}`, 'success');
      }

      setIsModalOpen(false);
      await refreshData();
    } catch (err) {
      console.error(err);
      showToast('Error saving location', 'error');
    }
  };

  const handleToggleActive = async (loc: Location) => {
    try {
      await locationsRepo.toggleActive(loc.id, !loc.is_active);
      showToast(`Updated status for ${loc.name}`, 'info');
      await refreshData();
    } catch (err) {
      console.error(err);
      showToast('Error updating location status', 'error');
    }
  };

  const typeBadges = {
    base_kitchen: <Badge variant="warning">Base Kitchen (Prep)</Badge>,
    store_room: <Badge variant="info">Central Store Room</Badge>,
    outlet: <Badge variant="success">Retail Outlet</Badge>,
    kiosk: <Badge variant="purple">Kiosk</Badge>,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">Configurable Business Locations</h2>
          <p className="text-xs text-slate-400">
            Four separate operations locations with independent stock balances, closing checklists, and sales.
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={openAddModal}>
          <Plus className="w-4 h-4" />
          <span>+ Add Location</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {locations.map(loc => (
          <div
            key={loc.id}
            className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all shadow-md"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-orange-400 bg-orange-950/60 px-2.5 py-0.5 rounded border border-orange-800/60">
                  {loc.code}
                </span>
                {typeBadges[loc.type] || <Badge>{loc.type}</Badge>}
              </div>

              <h3 className="font-bold text-base text-white mt-2">{loc.name}</h3>

              <div className="mt-3 space-y-1.5 text-xs text-slate-300">
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                  <span>{loc.address || 'No address specified'}</span>
                </div>
                {loc.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="font-mono text-emerald-400">{loc.phone}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
              <button
                onClick={() => handleToggleActive(loc)}
                className="inline-flex items-center gap-1.5 font-semibold"
              >
                {loc.is_active ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <ToggleRight className="w-4 h-4" /> Active Location
                  </span>
                ) : (
                  <span className="text-slate-500 flex items-center gap-1">
                    <ToggleLeft className="w-4 h-4" /> Deactivated
                  </span>
                )}
              </button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => openEditModal(loc)}
                className="text-slate-300 hover:text-white"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Location Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingLocation ? 'Edit Location' : 'Add New Location'}
        subtitle="Configure physical store, base kitchen or central store room"
        maxWidth="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Location Name *"
            placeholder="e.g. Shahpura Street Outlet"
            value={formName}
            onChange={e => setFormName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Location Code *"
              placeholder="e.g. SHAH-03"
              value={formCode}
              onChange={e => setFormCode(e.target.value)}
              helperText="Unique uppercase identifier"
              required
            />

            <Select
              label="Location Type *"
              value={formType}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormType(e.target.value as LocationType)}
              options={[
                { value: 'outlet', label: 'Retail Outlet (Sales + Indents)' },
                { value: 'base_kitchen', label: 'Base Kitchen (Cooking + Dispatches)' },
                { value: 'store_room', label: 'Central Store Room (Purchases + Storage)' },
                { value: 'kiosk', label: 'Food Court Kiosk' },
              ]}
            />
          </div>

          <Input
            label="Address"
            placeholder="e.g. Sector B, Shahpura Lake Promenade, Bhopal"
            value={formAddress}
            onChange={e => setFormAddress(e.target.value)}
          />

          <Input
            label="Contact Phone"
            placeholder="e.g. 9826022222"
            value={formPhone}
            onChange={e => setFormPhone(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              {editingLocation ? 'Save Changes' : 'Create Location'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
