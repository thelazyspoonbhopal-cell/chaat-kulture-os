import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { db } from '../../lib/db';
import { inventoryRepo } from '../../lib/dal/inventoryRepo';
import { suppliersRepo } from '../../lib/dal/suppliersRepo';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  Boxes,
  SlidersHorizontal,
  History,
  AlertTriangle,
  Plus,
  Lock,
  Search,
  X,
  Edit2,
  Sparkles,
  AlertCircle,
  Layers,
  ChevronDown,
  ChevronRight,
  Filter,
} from 'lucide-react';
import type {
  InventoryItem,
  InventoryBalance,
  InventoryMovement,
  Location,
  InventoryCategoryType,
  Supplier,
  Unit,
} from '../../types';

export const INVENTORY_CATEGORY_META: Record<
  InventoryCategoryType,
  { label: string; shortLabel: string; emoji: string; color: string; badgeVariant: 'warning' | 'success' | 'info' | 'default' | 'danger' }
> = {
  prepared_food: {
    label: 'Prepared Food (Kitchen Batch Produced / Cooked)',
    shortLabel: 'Prepared Food',
    emoji: '🍳',
    color: 'border-orange-500/40 text-orange-400 bg-orange-950/30',
    badgeVariant: 'warning',
  },
  raw_material: {
    label: 'Raw Materials & Groceries (Purchased Ingredients)',
    shortLabel: 'Raw Material',
    emoji: '🌾',
    color: 'border-emerald-500/40 text-emerald-400 bg-emerald-950/30',
    badgeVariant: 'success',
  },
  semi_prepared: {
    label: 'Semi-Prepared / Sub-Recipes & Gravies',
    shortLabel: 'Semi-Prepared',
    emoji: '🥣',
    color: 'border-amber-500/40 text-amber-400 bg-amber-950/30',
    badgeVariant: 'warning',
  },
  packaging: {
    label: 'Packaging (Boxes, Containers, Takeaway Bags)',
    shortLabel: 'Packaging',
    emoji: '📦',
    color: 'border-blue-500/40 text-blue-400 bg-blue-950/30',
    badgeVariant: 'info',
  },
  disposables: {
    label: 'Disposables & Cutlery (Spoons, Forks, Napkins)',
    shortLabel: 'Disposables',
    emoji: '🥢',
    color: 'border-purple-500/40 text-purple-400 bg-purple-950/30',
    badgeVariant: 'default',
  },
  consumables: {
    label: 'Consumables & Cleaning Supplies',
    shortLabel: 'Consumables',
    emoji: '🧼',
    color: 'border-cyan-500/40 text-cyan-400 bg-cyan-950/30',
    badgeVariant: 'info',
  },
  other: {
    label: 'Other General Supplies',
    shortLabel: 'Other',
    emoji: '📋',
    color: 'border-slate-500/40 text-slate-400 bg-slate-900',
    badgeVariant: 'default',
  },
};

const CATEGORY_ORDER: InventoryCategoryType[] = [
  'prepared_food',
  'raw_material',
  'semi_prepared',
  'packaging',
  'disposables',
  'consumables',
  'other',
];

export const InventoryLedgerView: React.FC = () => {
  const { locations, currentLocation, accessibleLocations, currentRole, showToast } = useApp();

  const isScoped = currentRole !== 'owner' && currentRole !== 'manager';
  const displayLocations = isScoped ? accessibleLocations : locations;
  const accessibleLocIds = useMemo(() => accessibleLocations.map(l => l.id), [accessibleLocations]);

  const [activeSubTab, setActiveSubTab] = useState<'matrix' | 'movements'>('matrix');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [movementFilter, setMovementFilter] = useState<string>('all');

  // Search & Categorisation Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>('all');
  const [isGroupedView, setIsGroupedView] = useState<boolean>(true);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  // Adjustment Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState<boolean>(false);
  const [adjustItemId, setAdjustItemId] = useState<string>('');
  const [adjustLocId, setAdjustLocId] = useState<string>('');
  const [adjustNewQty, setAdjustNewQty] = useState<string>('');
  const [adjustReason, setAdjustReason] = useState<string>('');

  // Add / Edit Inventory Item Modal
  const [isItemModalOpen, setIsItemModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formCode, setFormCode] = useState<string>('');
  const [formType, setFormType] = useState<InventoryCategoryType>('raw_material');
  const [formBaseUnit, setFormBaseUnit] = useState<string>('kg');
  const [formMinAlert, setFormMinAlert] = useState<string>('10');
  const [formCost, setFormCost] = useState<string>('0');
  const [formSupplierId, setFormSupplierId] = useState<string>('');
  const [isSavingItem, setIsSavingItem] = useState<boolean>(false);

  const loadData = async () => {
    try {
      await inventoryRepo.ensureBalances();
      const [allItems, allBalances, allMovements, allSuppliers, allUnits] = await Promise.all([
        inventoryRepo.getItems(),
        db.inventory_balances.toArray(),
        db.inventory_movements.orderBy('created_at').reverse().toArray(),
        suppliersRepo.getAll(),
        inventoryRepo.getUnits(),
      ]);

      setItems(allItems);
      setBalances(allBalances);
      setMovements(allMovements);
      setSuppliers(allSuppliers);
      setUnits(allUnits);

      if (allItems.length > 0 && !adjustItemId) {
        setAdjustItemId(allItems[0].id);
      }
      if (displayLocations.length > 0 && !adjustLocId) {
        setAdjustLocId(displayLocations[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, [displayLocations.length, currentLocation]);

  // Code Conflict Detection
  const invCodeConflict = useMemo(() => {
    const code = formCode.trim().toLowerCase();
    if (!code) return null;
    return items.find(
      i => i.id !== editingItem?.id && i.code && i.code.trim().toLowerCase() === code
    );
  }, [formCode, items, editingItem]);

  // Auto-Generate Standardized Unique Item Code
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
    const prefix = prefixMap[type] || 'INV';
    const cleanName = (name || 'ITEM')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 3)
      .padEnd(3, 'X');

    const matchingCodes = items
      .filter(i => i.code?.startsWith(`${prefix}-${cleanName}-`))
      .map(i => {
        const match = i.code?.match(/-(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      });
    const nextNum = (matchingCodes.length > 0 ? Math.max(...matchingCodes) : 0) + 1;
    return `${prefix}-${cleanName}-${nextNum.toString().padStart(2, '0')}`;
  };

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
    setFormType(item.category_type || 'raw_material');
    setFormBaseUnit(item.base_unit || 'kg');
    setFormMinAlert((item.min_stock_alert ?? 10).toString());
    setFormCost((item.cost_per_unit ?? 0).toString());
    setFormSupplierId(item.preferred_supplier_id || '');
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('Item name is required', 'warning');
      return;
    }
    if (invCodeConflict) {
      showToast(`Item code "${formCode}" is already in use by ${invCodeConflict.name}`, 'error');
      return;
    }

    setIsSavingItem(true);
    try {
      if (editingItem) {
        await inventoryRepo.updateItem(editingItem.id, {
          name: formName.trim(),
          code: formCode.trim().toUpperCase() || undefined,
          category_type: formType,
          base_unit: formBaseUnit.trim().toLowerCase(),
          min_stock_alert: parseFloat(formMinAlert) || 0,
          cost_per_unit: parseFloat(formCost) || 0,
          preferred_supplier_id: formSupplierId || undefined,
        });
        showToast(`Updated "${formName}" code & category classification`, 'success');
      } else {
        await inventoryRepo.addItem({
          business_id: 'biz_chaatkulture_01',
          category_id: 'cat_' + formType,
          name: formName.trim(),
          code: formCode.trim().toUpperCase() || undefined,
          category_type: formType,
          base_unit: formBaseUnit.trim().toLowerCase(),
          min_stock_alert: parseFloat(formMinAlert) || 0,
          cost_per_unit: parseFloat(formCost) || 0,
          preferred_supplier_id: formSupplierId || undefined,
          is_active: true,
        });
        showToast(`Created new inventory item "${formName}"`, 'success');
      }

      await inventoryRepo.syncInventoryToCloud();
      setIsItemModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error saving inventory item', 'error');
    } finally {
      setIsSavingItem(false);
    }
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItemId || !adjustLocId || !adjustNewQty || !adjustReason.trim()) {
      showToast('All adjustment fields including audit reason are mandatory', 'warning');
      return;
    }

    try {
      await inventoryRepo.adjustBalance(
        adjustLocId,
        adjustItemId,
        parseFloat(adjustNewQty),
        adjustReason.trim()
      );
      showToast('Physical count adjustment saved to movement ledger', 'success');
      setIsAdjustModalOpen(false);
      setAdjustNewQty('');
      setAdjustReason('');
      await loadData();
    } catch (err) {
      console.error(err);
      showToast('Error saving adjustment', 'error');
    }
  };

  const openAdjustmentForItem = (item: InventoryItem, defaultLocId?: string) => {
    setAdjustItemId(item.id);
    if (defaultLocId) {
      setAdjustLocId(defaultLocId);
    }
    const currentQty = getBalance(defaultLocId || adjustLocId || displayLocations[0]?.id, item.id);
    setAdjustNewQty(currentQty.toString());
    setAdjustReason('');
    setIsAdjustModalOpen(true);
  };

  // Helper to find balance of an item at a specific location
  const getBalance = (locationId: string, itemId: string) => {
    const bal = balances.find(b => b.location_id === locationId && b.inventory_item_id === itemId);
    return bal ? bal.available_quantity : 0;
  };

  const getInTransit = (locationId: string, itemId: string) => {
    const bal = balances.find(b => b.location_id === locationId && b.inventory_item_id === itemId);
    return bal ? bal.in_transit_quantity : 0;
  };

  const toggleCategoryCollapse = (catType: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [catType]: !prev[catType],
    }));
  };

  // Counts for Category Tabs
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: items.length,
      prepared_food: 0,
      raw_material: 0,
      semi_prepared: 0,
      packaging: 0,
      disposables: 0,
      consumables: 0,
      other: 0,
      low_stock: 0,
    };

    items.forEach(item => {
      const type = item.category_type || 'other';
      if (counts[type] !== undefined) counts[type]++;
      else counts.other++;

      // Check if low stock in any accessible location
      const totalAccessibleStock = displayLocations.reduce(
        (sum, loc) => sum + getBalance(loc.id, item.id),
        0
      );
      if (totalAccessibleStock <= (item.min_stock_alert ?? 0)) {
        counts.low_stock++;
      }
    });

    return counts;
  }, [items, balances, displayLocations]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return items.filter(item => {
      // Category Tab Filter
      if (selectedCategoryTab === 'low_stock') {
        const totalStock = displayLocations.reduce(
          (sum, loc) => sum + getBalance(loc.id, item.id),
          0
        );
        if (totalStock > (item.min_stock_alert ?? 0)) return false;
      } else if (selectedCategoryTab !== 'all') {
        if ((item.category_type || 'other') !== selectedCategoryTab) return false;
      }

      // Search Query Filter (name, code, unit, category)
      if (query) {
        const meta = INVENTORY_CATEGORY_META[item.category_type || 'other'];
        const matchesName = item.name.toLowerCase().includes(query);
        const matchesCode = (item.code || '').toLowerCase().includes(query);
        const matchesUnit = item.base_unit.toLowerCase().includes(query);
        const matchesCat = (meta?.label || '').toLowerCase().includes(query);
        if (!matchesName && !matchesCode && !matchesUnit && !matchesCat) {
          return false;
        }
      }

      return true;
    });
  }, [items, searchQuery, selectedCategoryTab, balances, displayLocations]);

  // Grouped Items by Category
  const groupedItems = useMemo(() => {
    const map = new Map<InventoryCategoryType, InventoryItem[]>();

    CATEGORY_ORDER.forEach(cat => map.set(cat, []));

    filteredItems.forEach(item => {
      const type = item.category_type && map.has(item.category_type) ? item.category_type : 'other';
      map.get(type)!.push(item);
    });

    return map;
  }, [filteredItems]);

  const movementTypeLabels: Record<string, { label: string; variant: 'success' | 'danger' | 'warning' | 'info' | 'default' }> = {
    opening_balance: { label: 'Opening Balance', variant: 'default' },
    purchase_receipt: { label: 'Purchase Receipt', variant: 'success' },
    production_output: { label: 'Production Output', variant: 'success' },
    dispatch_out: { label: 'Dispatch Out', variant: 'danger' },
    dispatch_in: { label: 'Dispatch Received', variant: 'success' },
    wastage: { label: 'Wastage (Spoiled)', variant: 'warning' },
    damage: { label: 'Damage', variant: 'danger' },
    staff_consumption: { label: 'Staff Meal', variant: 'warning' },
    adjustment: { label: 'Manual Adjustment', variant: 'info' },
    physical_count_variance: { label: 'Closing Count Variance', variant: 'warning' },
  };

  const filteredMovements = movements.filter(m => {
    if (isScoped && !accessibleLocIds.includes(m.location_id)) return false;
    if (movementFilter === 'all') return true;
    return m.movement_type === movementFilter;
  });

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <Boxes className="w-5 h-5 text-orange-500" />
            <span>Multi-Location Inventory & Movement Ledger</span>
          </h2>
          <p className="text-xs text-slate-400">
            Categorized live balances across 4 locations, instant code/category editing, and immutable movement ledger.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={openAddItemModal} className="bg-orange-600 hover:bg-orange-500 font-bold flex items-center gap-1.5 shadow">
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Inventory Item</span>
          </Button>

          <Button variant="secondary" size="sm" onClick={() => setIsAdjustModalOpen(true)}>
            <SlidersHorizontal className="w-3.5 h-3.5 text-orange-400" />
            <span>Manual Adjustment</span>
          </Button>
        </div>
      </div>

      {/* Outlet Scoped Warning Banner */}
      {isScoped && (
        <div className="flex items-center gap-2 p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-xs text-amber-300">
          <Lock className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <span className="font-bold">Outlet Scoped Inventory:</span> Displaying stock levels and movements strictly for{' '}
            <strong className="text-white">
              {accessibleLocations.map(l => `${l.name} (${l.code})`).join(', ')}
            </strong>
            . Unassigned locations and warehouse balances are restricted.
          </div>
        </div>
      )}

      {/* Sub Tabs: Matrix vs Movement Ledger */}
      <div className="flex gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold w-fit">
        <button
          onClick={() => setActiveSubTab('matrix')}
          className={`px-4 py-1.5 rounded-lg transition-all ${
            activeSubTab === 'matrix' ? 'bg-orange-600 text-white font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          {isScoped ? 'Assigned Outlet Stock' : '4-Location Balance Matrix'}
        </button>
        <button
          onClick={() => setActiveSubTab('movements')}
          className={`px-4 py-1.5 rounded-lg transition-all ${
            activeSubTab === 'movements' ? 'bg-orange-600 text-white font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          Movement Ledger ({filteredMovements.length})
        </button>
      </div>

      {/* TAB 1: 4-Location Balance Matrix */}
      {activeSubTab === 'matrix' && (
        <div className="space-y-3">
          {/* Search, Filter & Categorisation Bar */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 space-y-3 shadow-md">
            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by item name, item code (e.g. PRP-CHO-01), unit, or category..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* View Mode Toggle: Grouped by Category vs Flat Table */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsGroupedView(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    isGroupedView ? 'bg-orange-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Group items into distinct category sections (Prepared, Raw Materials, Packaging)"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Category Groups</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsGroupedView(false)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    !isGroupedView ? 'bg-orange-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="View all items in one flat searchable matrix"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Flat Matrix</span>
                </button>
              </div>
            </div>

            {/* Categorisation Filter Pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
              <button
                onClick={() => setSelectedCategoryTab('all')}
                className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  selectedCategoryTab === 'all'
                    ? 'bg-orange-600 text-white shadow'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <span>All Items</span>
                <span className="text-[10px] bg-black/30 px-1.5 py-0.5 rounded-full font-mono">
                  {categoryCounts.all}
                </span>
              </button>

              <button
                onClick={() => setSelectedCategoryTab('prepared_food')}
                className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  selectedCategoryTab === 'prepared_food'
                    ? 'bg-orange-600 text-white shadow'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <span>🍳 Prepared Food</span>
                <span className="text-[10px] bg-black/30 px-1.5 py-0.5 rounded-full font-mono">
                  {categoryCounts.prepared_food}
                </span>
              </button>

              <button
                onClick={() => setSelectedCategoryTab('raw_material')}
                className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  selectedCategoryTab === 'raw_material'
                    ? 'bg-orange-600 text-white shadow'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <span>🌾 Raw Materials</span>
                <span className="text-[10px] bg-black/30 px-1.5 py-0.5 rounded-full font-mono">
                  {categoryCounts.raw_material}
                </span>
              </button>

              <button
                onClick={() => setSelectedCategoryTab('packaging')}
                className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  selectedCategoryTab === 'packaging'
                    ? 'bg-orange-600 text-white shadow'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <span>📦 Packaging</span>
                <span className="text-[10px] bg-black/30 px-1.5 py-0.5 rounded-full font-mono">
                  {categoryCounts.packaging}
                </span>
              </button>

              <button
                onClick={() => setSelectedCategoryTab('disposables')}
                className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  selectedCategoryTab === 'disposables'
                    ? 'bg-orange-600 text-white shadow'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <span>🥢 Disposables</span>
                <span className="text-[10px] bg-black/30 px-1.5 py-0.5 rounded-full font-mono">
                  {categoryCounts.disposables}
                </span>
              </button>

              <button
                onClick={() => setSelectedCategoryTab('consumables')}
                className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  selectedCategoryTab === 'consumables'
                    ? 'bg-orange-600 text-white shadow'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <span>🧼 Consumables</span>
                <span className="text-[10px] bg-black/30 px-1.5 py-0.5 rounded-full font-mono">
                  {categoryCounts.consumables}
                </span>
              </button>

              <button
                onClick={() => setSelectedCategoryTab('low_stock')}
                className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  selectedCategoryTab === 'low_stock'
                    ? 'bg-rose-600 text-white shadow'
                    : 'bg-slate-950 text-rose-400 hover:text-white border border-rose-950/60'
                }`}
              >
                <span>⚠️ Low Stock Alert</span>
                <span className="text-[10px] bg-black/30 px-1.5 py-0.5 rounded-full font-mono">
                  {categoryCounts.low_stock}
                </span>
              </button>
            </div>
          </div>

          {/* Items Table Display */}
          {filteredItems.length === 0 ? (
            <EmptyState
              icon={<Boxes className="w-8 h-8" />}
              title={items.length === 0 ? 'Inventory Master is Empty' : 'No Matching Items Found'}
              description={
                items.length === 0
                  ? 'No inventory items or ingredients registered yet. Click "+ Add Inventory Item" to register your first item.'
                  : `No items matched "${searchQuery}" in ${selectedCategoryTab.replace('_', ' ')}. Try changing your search or filter.`
              }
              actionLabel={items.length === 0 ? '+ Add Inventory Item' : 'Clear Filters'}
              onAction={items.length === 0 ? openAddItemModal : () => { setSearchQuery(''); setSelectedCategoryTab('all'); }}
            />
          ) : isGroupedView && selectedCategoryTab === 'all' ? (
            /* GROUPED CATEGORY VIEW */
            <div className="space-y-4">
              {CATEGORY_ORDER.map(catType => {
                const catItems = groupedItems.get(catType) || [];
                if (catItems.length === 0) return null;

                const meta = INVENTORY_CATEGORY_META[catType];
                const isCollapsed = collapsedCategories[catType];

                return (
                  <div
                    key={catType}
                    className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg"
                  >
                    {/* Category Group Header */}
                    <div
                      onClick={() => toggleCategoryCollapse(catType)}
                      className="flex items-center justify-between p-3.5 bg-slate-950/80 hover:bg-slate-950 cursor-pointer border-b border-slate-800 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-slate-400">
                          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </span>
                        <span className="text-base">{meta.emoji}</span>
                        <div>
                          <span className="font-bold text-white text-xs uppercase tracking-wider">
                            {meta.label}
                          </span>
                          <span className="ml-2 text-[11px] font-mono text-slate-400">
                            ({catItems.length} items)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant={meta.badgeVariant} size="sm">
                          {meta.shortLabel}
                        </Badge>
                      </div>
                    </div>

                    {/* Table for this Category */}
                    {!isCollapsed && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-950/40 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-slate-800">
                            <tr>
                              <th className="py-2.5 px-4">Item & Code</th>
                              <th className="py-2.5 px-4">Base Unit</th>
                              {displayLocations.map(loc => (
                                <th key={loc.id} className="py-2.5 px-4 text-right">
                                  {loc.name} ({loc.code})
                                </th>
                              ))}
                              {!isScoped && <th className="py-2.5 px-4 text-right bg-slate-950/60">Total Network</th>}
                              <th className="py-2.5 px-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/80">
                            {catItems.map(item => {
                              const totalNet = locations.reduce((sum, l) => sum + getBalance(l.id, item.id), 0);
                              const isLowStock = totalNet <= (item.min_stock_alert ?? 0);

                              return (
                                <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                                  <td className="py-2.5 px-4">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-white text-xs">{item.name}</span>
                                      {item.is_demo && <Badge variant="warning">Demo</Badge>}
                                      {isLowStock && (
                                        <span className="text-[10px] bg-rose-950/80 border border-rose-800/80 text-rose-300 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                                          <AlertTriangle className="w-2.5 h-2.5" /> Low
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      {item.code ? (
                                        <span className="font-mono text-[11px] text-orange-400 font-bold bg-orange-950/40 px-1.5 py-0.2 rounded border border-orange-900/60">
                                          {item.code}
                                        </span>
                                      ) : (
                                        <button
                                          onClick={() => openEditItemModal(item)}
                                          className="text-[10px] text-amber-400 hover:underline flex items-center gap-1 font-semibold"
                                        >
                                          <AlertCircle className="w-3 h-3" /> + Add Code
                                        </button>
                                      )}
                                      <span className="text-[10px] text-slate-500">
                                        Min Alert: {item.min_stock_alert ?? 0} {item.base_unit}
                                      </span>
                                    </div>
                                  </td>

                                  <td className="py-2.5 px-4 font-mono font-bold text-slate-300">
                                    {item.base_unit}
                                  </td>

                                  {displayLocations.map(loc => {
                                    const qty = getBalance(loc.id, item.id);
                                    const transit = getInTransit(loc.id, item.id);
                                    const isLocLow = qty <= (item.min_stock_alert ?? 0);

                                    return (
                                      <td key={loc.id} className="py-2.5 px-4 text-right font-mono">
                                        <div className={`font-bold ${qty > 0 ? (isLocLow ? 'text-amber-400' : 'text-emerald-300') : 'text-slate-500'}`}>
                                          {qty} {item.base_unit}
                                        </div>
                                        {transit > 0 && (
                                          <div className="text-[10px] text-sky-400 font-semibold">
                                            +{transit} in transit
                                          </div>
                                        )}
                                      </td>
                                    );
                                  })}

                                  {!isScoped && (
                                    <td className="py-2.5 px-4 text-right font-mono font-bold text-white text-xs bg-slate-950/40">
                                      {totalNet} {item.base_unit}
                                    </td>
                                  )}

                                  <td className="py-2.5 px-4 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => openEditItemModal(item)}
                                        className="h-7 px-2 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold"
                                        title="Edit Item Code, Classification & Safety Stock"
                                      >
                                        <Edit2 className="w-3 h-3 text-amber-400 mr-1" />
                                        <span>Edit</span>
                                      </Button>

                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => openAdjustmentForItem(item)}
                                        className="h-7 px-2 text-slate-400 hover:text-orange-300 hover:bg-slate-800 text-xs"
                                        title="Record physical count override adjustment"
                                      >
                                        <SlidersHorizontal className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* FLAT TABLE VIEW */
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Item & Code</th>
                      <th className="py-3 px-4">Classification</th>
                      <th className="py-3 px-4">Base Unit</th>
                      {displayLocations.map(loc => (
                        <th key={loc.id} className="py-3 px-4 text-right">
                          {loc.name} ({loc.code})
                        </th>
                      ))}
                      {!isScoped && <th className="py-3 px-4 text-right bg-slate-950/60">Total Network Stock</th>}
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredItems.map(item => {
                      const totalNet = locations.reduce((sum, l) => sum + getBalance(l.id, item.id), 0);
                      const meta = INVENTORY_CATEGORY_META[item.category_type || 'other'];
                      const isLowStock = totalNet <= (item.min_stock_alert ?? 0);

                      return (
                        <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-xs">{item.name}</span>
                              {item.is_demo && <Badge variant="warning">Demo</Badge>}
                              {isLowStock && (
                                <span className="text-[10px] bg-rose-950/80 border border-rose-800/80 text-rose-300 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                                  <AlertTriangle className="w-2.5 h-2.5" /> Low
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {item.code ? (
                                <span className="font-mono text-[11px] text-orange-400 font-bold bg-orange-950/40 px-1.5 py-0.2 rounded border border-orange-900/60">
                                  {item.code}
                                </span>
                              ) : (
                                <button
                                  onClick={() => openEditItemModal(item)}
                                  className="text-[10px] text-amber-400 hover:underline flex items-center gap-1 font-semibold"
                                >
                                  <AlertCircle className="w-3 h-3" /> + Add Code
                                </button>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span className="text-[11px] font-semibold flex items-center gap-1 text-slate-300">
                              <span>{meta.emoji}</span>
                              <span>{meta.shortLabel}</span>
                            </span>
                          </td>

                          <td className="py-3 px-4 font-mono font-bold text-slate-300">
                            {item.base_unit}
                          </td>

                          {displayLocations.map(loc => {
                            const qty = getBalance(loc.id, item.id);
                            const transit = getInTransit(loc.id, item.id);
                            const isLocLow = qty <= (item.min_stock_alert ?? 0);

                            return (
                              <td key={loc.id} className="py-3 px-4 text-right font-mono">
                                <div className={`font-bold ${qty > 0 ? (isLocLow ? 'text-amber-400' : 'text-emerald-300') : 'text-slate-500'}`}>
                                  {qty} {item.base_unit}
                                </div>
                                {transit > 0 && (
                                  <div className="text-[10px] text-sky-400 font-semibold">
                                    +{transit} in transit
                                  </div>
                                )}
                              </td>
                            );
                          })}

                          {!isScoped && (
                            <td className="py-3 px-4 text-right font-mono font-bold text-white text-xs bg-slate-950/40">
                              {totalNet} {item.base_unit}
                            </td>
                          )}

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditItemModal(item)}
                                className="h-7 px-2 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold"
                                title="Edit Item Code, Classification & Safety Stock"
                              >
                                <Edit2 className="w-3 h-3 text-amber-400 mr-1" />
                                <span>Edit</span>
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openAdjustmentForItem(item)}
                                className="h-7 px-2 text-slate-400 hover:text-orange-300 hover:bg-slate-800 text-xs"
                                title="Record physical count override adjustment"
                              >
                                <SlidersHorizontal className="w-3 h-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Movement Ledger */}
      {activeSubTab === 'movements' && (
        <div className="space-y-3">
          {/* Movement Type Filter */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            {['all', 'purchase_receipt', 'production_output', 'dispatch_out', 'dispatch_in', 'wastage', 'damage', 'staff_consumption', 'adjustment'].map(type => (
              <button
                key={type}
                onClick={() => setMovementFilter(type)}
                className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
                  movementFilter === type
                    ? 'bg-orange-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {type.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>

          {filteredMovements.length === 0 ? (
            <EmptyState
              icon={<History className="w-8 h-8" />}
              title="No Movement Records"
              description="Every physical transaction (purchases, production batches, dispatches, wastage) will be permanently appended to this ledger."
            />
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">Location</th>
                      <th className="py-3 px-4">Movement Type</th>
                      <th className="py-3 px-4 text-right">Quantity Change</th>
                      <th className="py-3 px-4 text-right">Balance After</th>
                      <th className="py-3 px-4">Batch / Reference</th>
                      <th className="py-3 px-4">Reason / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredMovements.map(m => {
                      const badgeInfo = movementTypeLabels[m.movement_type] || { label: m.movement_type, variant: 'default' };
                      const loc = locations.find(l => l.id === m.location_id);
                      const isPositive = m.quantity_change > 0;

                      return (
                        <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                            {new Date(m.created_at).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-slate-200 font-bold">
                            {loc ? loc.code : m.location_id}
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={badgeInfo.variant as any} size="sm">
                              {badgeInfo.label}
                            </Badge>
                          </td>
                          <td className={`py-3 px-4 text-right font-mono font-bold text-sm ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isPositive ? `+${m.quantity_change}` : m.quantity_change} {m.unit}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-white">
                            {m.balance_after} {m.unit}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                            {m.batch_reference || '—'}
                          </td>
                          <td className="py-3 px-4 text-slate-300 max-w-xs truncate">
                            {m.notes || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Inventory Item Modal */}
      <Modal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        title={editingItem ? `Edit Inventory Item: ${editingItem.name}` : 'Add New Inventory Item'}
        subtitle="Manage item code, classification category, base unit, and safety reorder alerts"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveItem} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Item Name *"
              placeholder="e.g. Amul Butter (Table Blocks) or Chole Gravy"
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
                placeholder="e.g. RAW-BUT-01 or PRP-CHO-01"
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
              label="Classification Category *"
              value={formType}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setFormType(e.target.value as InventoryCategoryType)
              }
              options={[
                { value: 'prepared_food', label: '🍳 Prepared Food (Base Kitchen Cooked Batch)' },
                { value: 'raw_material', label: '🌾 Raw Material (Purchased Groceries / Spices / Dairy)' },
                { value: 'semi_prepared', label: '🥣 Semi-Prepared / Sub-Recipes & Gravies' },
                { value: 'packaging', label: '📦 Packaging (Boxes, Containers, Takeaway Bags)' },
                { value: 'disposables', label: '🥢 Disposables (Spoons, Forks, Napkins)' },
                { value: 'consumables', label: '🧼 Consumables & Cleaning Supplies' },
                { value: 'other', label: '📋 Other Supplies' },
              ]}
            />

            <Select
              label="Base Inventory Unit *"
              value={formBaseUnit}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormBaseUnit(e.target.value)}
              options={
                units.length > 0
                  ? units.map(u => ({ value: u.code, label: `${u.name} (${u.code})` }))
                  : [
                      { value: 'kg', label: 'Kilogram (kg)' },
                      { value: 'g', label: 'Gram (g)' },
                      { value: 'ltr', label: 'Litre (ltr)' },
                      { value: 'ml', label: 'Millilitre (ml)' },
                      { value: 'pc', label: 'Piece (pc)' },
                      { value: 'plate', label: 'Plate (plate)' },
                      { value: 'pkt', label: 'Packet (pkt)' },
                      { value: 'box', label: 'Box (box)' },
                    ]
              }
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Min Stock Alert Level"
              type="number"
              step="0.1"
              value={formMinAlert}
              onChange={e => setFormMinAlert(e.target.value)}
              placeholder="e.g. 10"
              helperText="Trigger warning if total available drops below this"
            />

            <Input
              label="Cost Per Unit (₹)"
              type="number"
              step="0.01"
              value={formCost}
              onChange={e => setFormCost(e.target.value)}
              placeholder="e.g. 180"
              helperText="Standard purchase or batch preparation cost"
            />

            <Select
              label="Preferred Supplier"
              value={formSupplierId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormSupplierId(e.target.value)}
              options={[
                { value: '', label: 'None / Multiple Vendors' },
                ...suppliers.map(s => ({ value: s.id, label: s.name })),
              ]}
            />
          </div>

          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-400">
            ℹ️ Changes to item code and category classification will immediately sync to the cloud registry and update across all outlets.
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsItemModalOpen(false)}
              disabled={isSavingItem}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={isSavingItem || !!invCodeConflict}
              className="bg-orange-600 hover:bg-orange-500 font-bold"
            >
              {isSavingItem ? 'Saving...' : editingItem ? 'Save Item Changes' : 'Create Item'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Manual Stock Adjustment Modal */}
      <Modal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        title="Manual Stock Balance Adjustment"
        subtitle="Mandatory reason required for immutable audit trail"
        maxWidth="md"
      >
        <form onSubmit={handleSaveAdjustment} className="space-y-4">
          <Select
            label="Location *"
            value={adjustLocId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAdjustLocId(e.target.value)}
            options={displayLocations.map(l => ({ value: l.id, label: `${l.name} (${l.code})` }))}
          />

          <Select
            label="Inventory Item *"
            value={adjustItemId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAdjustItemId(e.target.value)}
            options={items.map(i => ({ value: i.id, label: `${i.name} ${i.code ? `[${i.code}]` : ''} (${i.base_unit})` }))}
          />

          <Input
            label="New Actual Physical Quantity *"
            type="number"
            step="0.01"
            value={adjustNewQty}
            onChange={e => setAdjustNewQty(e.target.value)}
            placeholder="e.g. 24.50"
            required
          />

          <Input
            label="Mandatory Reason for Adjustment *"
            placeholder="e.g. Physical inventory recount variance correction"
            value={adjustReason}
            onChange={e => setAdjustReason(e.target.value)}
            required
          />

          <div className="p-3 bg-amber-950/40 border border-amber-800 rounded-xl text-amber-300 text-xs">
            🛡️ <strong>Ledger Rule:</strong> This adjustment will not overwrite history. It will write an explicit <code>adjustment</code> record to the permanent movement ledger.
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setIsAdjustModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Adjustment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
