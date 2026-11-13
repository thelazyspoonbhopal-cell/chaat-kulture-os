import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { inventoryRepo } from '../../lib/dal/inventoryRepo';
import { suppliersRepo } from '../../lib/dal/suppliersRepo';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { Plus, Search, Boxes, Edit2, AlertCircle, Sparkles } from 'lucide-react';
import type { InventoryItem, InventoryCategory, Unit, Supplier, InventoryCategoryType } from '../../types';

export const InventoryMaster: React.FC = () => {
  const { showToast, refreshData, currentRole } = useApp();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modals
  const [isItemModalOpen, setIsItemModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  // Form state
  const [formName, setFormName] = useState<string>('');
  const [formCode, setFormCode] = useState<string>('');
  const [formType, setFormType] = useState<InventoryCategoryType>('raw_material');
  const [formBaseUnit, setFormBaseUnit] = useState<string>('kg');
  const [formMinAlert, setFormMinAlert] = useState<string>('10');
  const [formCost, setFormCost] = useState<string>('0');
  const [formSupplierId, setFormSupplierId] = useState<string>('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allItms, allCats, allUnits, allSups] = await Promise.all([
        inventoryRepo.getItems(),
        inventoryRepo.getCategories(),
        inventoryRepo.getUnits(),
        suppliersRepo.getAll(),
      ]);
      setItems(allItms);
      setCategories(allCats);
      setUnits(allUnits);
      setSuppliers(allSups);
    } catch (err) {
      console.error(err);
      showToast('Error loading inventory items', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddItemModal = () => {
    setEditingItem(null);
    setFormName('');
    setFormCode('');
    setFormType('raw_material');
    setFormBaseUnit('kg');
    setFormMinAlert('10');
    setFormCost('0');
    setFormSupplierId('');
    setIsItemModalOpen(true);
  };

  const openEditItemModal = (item: InventoryItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormCode(item.code || '');
    setFormType(item.category_type);
    setFormBaseUnit(item.base_unit);
    setFormMinAlert(item.min_stock_alert.toString());
    setFormCost(item.cost_per_unit.toString());
    setFormSupplierId(item.preferred_supplier_id || '');
    setIsItemModalOpen(true);
  };

  const invCodeConflict = useMemo(() => {
    const code = formCode.trim().toLowerCase();
    if (!code) return null;
    return items.find(
      i => i.id !== editingItem?.id && i.code && i.code.trim().toLowerCase() === code
    );
  }, [formCode, items, editingItem]);

  const generateUniqueInvCode = (name: string, type: InventoryCategoryType) => {
    const prefixMap: Record<InventoryCategoryType, string> = {
      raw_material: 'RAW',
      prepared_food: 'PRP',
      semi_prepared: 'SMP',
      packaging: 'PKG',
      disposables: 'DSP',
      consumables: 'CSM',
      other: 'OTH',
    };
    const pfx = prefixMap[type] || 'INV';
    const clean = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const tag = clean.slice(0, 3) || 'ITM';
    let counter = 1;
    let candidate = `${pfx}-${tag}-${String(counter).padStart(2, '0')}`;
    while (items.some(i => i.id !== editingItem?.id && i.code?.trim().toLowerCase() === candidate.toLowerCase())) {
      counter++;
      candidate = `${pfx}-${tag}-${String(counter).padStart(2, '0')}`;
    }
    return candidate;
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('Item name is required', 'warning');
      return;
    }

    if (!formCode.trim()) {
      showToast('Item code is required. Every inventory item must have a unique code.', 'warning');
      return;
    }

    if (invCodeConflict) {
      showToast(`Item code "${formCode.trim()}" is already assigned to "${invCodeConflict.name}". Every item must have a unique code!`, 'error');
      return;
    }

    const minAlertNum = parseFloat(formMinAlert) || 0;
    const costNum = parseFloat(formCost) || 0;

    try {
      if (editingItem) {
        await inventoryRepo.updateItem(editingItem.id, {
          name: formName.trim(),
          code: formCode.trim().toUpperCase(),
          category_type: formType,
          base_unit: formBaseUnit,
          min_stock_alert: minAlertNum,
          cost_per_unit: costNum,
          preferred_supplier_id: formSupplierId || undefined,
        });
        showToast(`Updated inventory item: ${formName}`, 'success');
      } else {
        await inventoryRepo.addItem({
          business_id: 'biz_chaatkulture_01',
          category_id: 'default',
          name: formName.trim(),
          code: formCode.trim().toUpperCase(),
          category_type: formType,
          base_unit: formBaseUnit,
          min_stock_alert: minAlertNum,
          cost_per_unit: costNum,
          preferred_supplier_id: formSupplierId || undefined,
          is_active: true,
        });
        showToast(`Created inventory item: ${formName}`, 'success');
      }

      setIsItemModalOpen(false);
      await loadData();
      await refreshData();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error saving inventory item', 'error');
    }
  };

  const typeLabels: Record<InventoryCategoryType, string> = {
    raw_material: 'Raw Material',
    prepared_food: 'Kitchen Prepared Food',
    semi_prepared: 'Semi Prepared',
    packaging: 'Packaging',
    disposables: 'Disposables',
    consumables: 'Consumables',
    other: 'Other Goods',
  };

  // Filter
  const filteredItems = items.filter(item => {
    const matchesType = selectedType === 'all' || item.category_type === selectedType;
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.code && item.code.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">Inventory Items & Raw Materials</h2>
          <p className="text-xs text-slate-400">
            Master registry of raw spices, packaging, and kitchen prepared bulk foods.
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={openAddItemModal}>
          <Plus className="w-4 h-4" />
          <span>+ Add Inventory Item</span>
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Search by raw material or item code..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              selectedType === 'all'
                ? 'bg-orange-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            All Items ({items.length})
          </button>
          <button
            onClick={() => setSelectedType('raw_material')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              selectedType === 'raw_material'
                ? 'bg-orange-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Raw Materials
          </button>
          <button
            onClick={() => setSelectedType('prepared_food')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              selectedType === 'prepared_food'
                ? 'bg-orange-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Prepared Food
          </button>
          <button
            onClick={() => setSelectedType('packaging')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              selectedType === 'packaging'
                ? 'bg-orange-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Packaging
          </button>
        </div>
      </div>

      {/* Items Table or Clean Empty State */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon={<Boxes className="w-8 h-8" />}
          title={items.length === 0 ? 'Your Inventory Master is 100% Clean' : 'No matching items found'}
          description={
            items.length === 0
              ? 'No dummy raw materials were added. Click "+ Add Inventory Item" to start adding your real ingredients, prepared foods, and packaging items.'
              : 'Try changing your keyword search or category filter.'
          }
          actionLabel={items.length === 0 ? '+ Add First Inventory Item' : undefined}
          onAction={items.length === 0 ? openAddItemModal : undefined}
        />
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Item & Code</th>
                  <th className="py-3 px-4">Classification</th>
                  <th className="py-3 px-4">Base Unit</th>
                  <th className="py-3 px-4 text-right">Cost / Unit</th>
                  <th className="py-3 px-4 text-right">Min Stock Alert</th>
                  <th className="py-3 px-4">Preferred Supplier</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredItems.map(item => {
                  const sup = suppliers.find(s => s.id === item.preferred_supplier_id);
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white flex items-center gap-2">
                          <span>{item.name}</span>
                          {item.is_demo && (
                            <Badge variant="warning" size="sm">
                              Demo
                            </Badge>
                          )}
                        </div>
                        {item.code && <span className="text-[10px] text-slate-400 font-mono">{item.code}</span>}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            item.category_type === 'prepared_food'
                              ? 'info'
                              : item.category_type === 'raw_material'
                              ? 'default'
                              : 'purple'
                          }
                          size="sm"
                        >
                          {typeLabels[item.category_type] || item.category_type}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-200">
                        {item.base_unit}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">
                        {item.cost_per_unit > 0 ? `₹${item.cost_per_unit.toFixed(2)}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-amber-400 font-semibold">
                        {item.min_stock_alert} {item.base_unit}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {sup ? sup.name : <span className="text-slate-500">None assigned</span>}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {(currentRole === 'owner' || currentRole === 'manager') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditItemModal(item)}
                            className="p-1 h-auto text-slate-300 hover:text-white"
                            title="Edit Item (Manager & Super Admin)"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Inventory Modal */}
      <Modal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        title={editingItem ? 'Edit Inventory Item' : 'Add New Inventory Item'}
        subtitle="Specify unit, classification, and safety stock threshold"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveItem} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Item Name *"
              placeholder="e.g. Amul Butter (Table Blocks)"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              required
            />
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">Item Code *</label>
                <button
                  type="button"
                  onClick={() => setFormCode(generateUniqueInvCode(formName, formType))}
                  className="text-[10px] text-orange-400 hover:text-orange-300 flex items-center gap-1 font-medium transition-colors"
                >
                  <Sparkles className="w-3 h-3" /> Auto-Code
                </button>
              </div>
              <Input
                placeholder="e.g. RAW-BUT-01"
                value={formCode}
                onChange={e => setFormCode(e.target.value.toUpperCase())}
                required
                className={invCodeConflict ? '!border-rose-500' : ''}
              />
              {invCodeConflict && (
                <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Code already in use by "{invCodeConflict.name}"
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Classification Type *"
              value={formType}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormType(e.target.value as InventoryCategoryType)}
              options={[
                { value: 'raw_material', label: 'Raw Material (Purchased)' },
                { value: 'prepared_food', label: 'Prepared Food (Kitchen Batch Produced)' },
                { value: 'packaging', label: 'Packaging (Bowls, takeaway bags)' },
                { value: 'disposables', label: 'Disposables (Spoons, napkins)' },
                { value: 'consumables', label: 'Consumables & Cleaning' },
                { value: 'other', label: 'Other' },
              ]}
            />

            <Select
              label="Base Unit *"
              value={formBaseUnit}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormBaseUnit(e.target.value)}
              options={units.map(u => ({ value: u.code, label: `${u.name} (${u.code})` }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Minimum Stock Alert Quantity"
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 20"
              value={formMinAlert}
              onChange={e => setFormMinAlert(e.target.value)}
              helperText="Trigger warning when location stock falls below this level"
            />
            <Input
              label="Estimated Cost per Unit (₹)"
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 480.00"
              value={formCost}
              onChange={e => setFormCost(e.target.value)}
              helperText="Used for rough inventory valuation where reliable"
            />
          </div>

          <Select
            label="Preferred Supplier (Optional)"
            value={formSupplierId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormSupplierId(e.target.value)}
            options={[
              { value: '', label: '— No Preferred Supplier Assigned —' },
              ...suppliers.map(s => ({ value: s.id, label: s.name })),
            ]}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setIsItemModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              {editingItem ? 'Save Changes' : 'Create Inventory Item'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
