import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { inventoryRepo } from '../../lib/dal/inventoryRepo';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Scale, Plus } from 'lucide-react';
import type { Unit } from '../../types';

export const UnitsMaster: React.FC = () => {
  const { showToast } = useApp();
  const [units, setUnits] = useState<Unit[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [formName, setFormName] = useState<string>('');
  const [formCode, setFormCode] = useState<string>('');
  const [formFactor, setFormFactor] = useState<string>('1.0');
  const [formIsBase, setFormIsBase] = useState<boolean>(true);

  const loadUnits = async () => {
    try {
      const data = await inventoryRepo.getUnits();
      setUnits(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadUnits();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formCode.trim()) return;

    try {
      await inventoryRepo.addUnit(formName, formCode, formIsBase, parseFloat(formFactor) || 1.0);
      showToast(`Created unit: ${formName} (${formCode})`, 'success');
      setIsModalOpen(false);
      setFormName('');
      setFormCode('');
      await loadUnits();
    } catch (err) {
      console.error(err);
      showToast('Error saving unit', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">Units of Measurement & Conversions</h2>
          <p className="text-xs text-slate-400">
            Define base measurement units (Kilogram, Litre, Pieces, Plates) and multipliers.
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4" />
          <span>+ Add Measurement Unit</span>
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {units.map(unit => (
          <div key={unit.id} className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-sm text-orange-400 uppercase">{unit.code}</span>
              {unit.is_base_unit ? (
                <Badge variant="success" size="sm">
                  Base Unit
                </Badge>
              ) : (
                <Badge variant="default" size="sm">
                  Multiplier: {unit.conversion_factor}
                </Badge>
              )}
            </div>
            <h4 className="font-bold text-white text-xs">{unit.name}</h4>
          </div>
        ))}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Unit of Measurement"
        subtitle="e.g. Dozen, Bundle, Tray"
        maxWidth="sm"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Unit Name *"
            placeholder="e.g. Bundle or Tray"
            value={formName}
            onChange={e => setFormName(e.target.value)}
            required
          />
          <Input
            label="Unit Code *"
            placeholder="e.g. bdl or tray"
            value={formCode}
            onChange={e => setFormCode(e.target.value)}
            required
          />
          <Input
            label="Conversion Factor to Base Unit"
            type="number"
            step="0.001"
            value={formFactor}
            onChange={e => setFormFactor(e.target.value)}
            helperText="1.0 for base unit, or multiplier (e.g. 0.001 for gram to kg)"
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Unit
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
