import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { db } from '../../lib/db';
import { productionRepo } from '../../lib/dal/productionRepo';
import { inventoryRepo } from '../../lib/dal/inventoryRepo';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  ChefHat,
  Plus,
  Minus,
  Search,
  History,
  Flame,
  CheckCircle2,
  Eye,
  Edit2,
  Trash2,
  Printer,
  Lock,
  Layers,
  Sparkles,
  ClipboardList,
  AlertTriangle,
  RotateCcw,
  Calendar,
  User,
  FileText,
  Boxes,
} from 'lucide-react';
import type { ProductionRecord, InventoryItem } from '../../types';

interface BatchCartItem {
  item: InventoryItem;
  quantity: number;
  notes: string;
}

export const KitchenProduction: React.FC = () => {
  const { locations, currentRole, currentUser, accessibleLocations, isLocationAccessible, showToast } = useApp();

  // Mode: 'pos' (Production Entry Station) or 'history' (Batch Logs & Audits)
  const [activeMode, setActiveMode] = useState<'pos' | 'history'>('pos');

  // Master Data
  const [allItems, setAllItems] = useState<InventoryItem[]>([]);
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [stockMap, setStockMap] = useState<Map<string, number>>(new Map());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // POS Filter & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>('all');

  // POS Batch Tray (Multi-Item Cart)
  const [batchCart, setBatchCart] = useState<BatchCartItem[]>([]);
  const [batchDate, setBatchDate] = useState<string>(new Date().toISOString().slice(0, 16));
  const [chefName, setChefName] = useState<string>('');
  const [batchNotes, setBatchNotes] = useState<string>('');
  const [isSubmittingBatch, setIsSubmittingBatch] = useState<boolean>(false);

  // Modals & Action State
  const [viewingBatchNumber, setViewingBatchNumber] = useState<string | null>(null);
  const [viewingBatchRecords, setViewingBatchRecords] = useState<ProductionRecord[]>([]);
  const [editingBatch, setEditingBatch] = useState<ProductionRecord | null>(null);
  const [editQty, setEditQty] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [voidingBatch, setVoidingBatch] = useState<ProductionRecord | null>(null);
  const [voidReason, setVoidReason] = useState<string>('');

  // Access validation: Base Kitchen access or Owner/Manager
  const canAccessKitchen =
    isLocationAccessible('loc_base_01') || currentRole === 'owner' || currentRole === 'manager';

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Ensure default kitchen items exist
      await productionRepo.ensureDefaultKitchenItems();

      // 2. Fetch all inventory items
      const items = await inventoryRepo.getItems();
      setAllItems(items);

      // 3. Fetch production records
      const allRecords = await productionRepo.getRecords('loc_base_01');
      setRecords(allRecords);

      // 4. Fetch live stock balances for Base Kitchen (BASE-01)
      const balances = await db.inventory_balances.where('location_id').equals('loc_base_01').toArray();
      const map = new Map<string, number>();
      balances.forEach(b => map.set(b.inventory_item_id, b.available_quantity));
      setStockMap(map);

      // Default chef name
      if (!chefName) {
        setChefName(currentUser?.full_name || 'Chef (Base Kitchen)');
      }
    } catch (err) {
      console.error('Error loading kitchen production data:', err);
      showToast('Error loading kitchen data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (canAccessKitchen) {
      loadData();
    }
  }, [canAccessKitchen]);

  if (!canAccessKitchen) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-3 shadow-xl">
        <div className="w-12 h-12 rounded-2xl bg-amber-950/60 border border-amber-800/80 text-amber-400 mx-auto flex items-center justify-center">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-white">Access Restricted: Base Kitchen Only</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Your assigned location(s) ({accessibleLocations.map(l => l.name).join(', ')}) do not include Base Kitchen
          (BASE-01). Kitchen production batches are logged strictly by authorized kitchen staff.
        </p>
      </div>
    );
  }

  // Categories helper to classify items
  const categorizeItem = (item: InventoryItem): string => {
    const name = item.name.toLowerCase();
    const code = (item.code || '').toLowerCase();

    if (name.includes('bhaji') || name.includes('chole') || name.includes('gravy') || name.includes('curry') || name.includes('base')) {
      return 'cooked_bases';
    }
    if (name.includes('puri') || name.includes('papdi') || name.includes('sev') || name.includes('vada') || name.includes('bhalla')) {
      return 'puris_snacks';
    }
    if (name.includes('pani') || name.includes('chutney') || name.includes('sauce') || name.includes('saunth')) {
      return 'chutneys_waters';
    }
    if (name.includes('potato') || name.includes('dough') || name.includes('mix') || name.includes('paste')) {
      return 'prep_mixes';
    }
    if (name.includes('chaas') || name.includes('lassi') || name.includes('jamun') || name.includes('sweet') || name.includes('drink')) {
      return 'beverages_sweets';
    }
    return item.category_type === 'prepared_food' || item.category_type === 'semi_prepared'
      ? 'cooked_bases'
      : 'other';
  };

  // Filtered Items for POS Grid
  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      // Must be prepared_food, semi_prepared, or if tab is all_inventory show all
      const isKitchenRelevant =
        selectedCategoryTab === 'all_inventory' ||
        item.category_type === 'prepared_food' ||
        item.category_type === 'semi_prepared';

      if (!isKitchenRelevant) return false;

      // Category filter
      if (selectedCategoryTab !== 'all' && selectedCategoryTab !== 'all_inventory') {
        const itemCat = categorizeItem(item);
        if (itemCat !== selectedCategoryTab) return false;
      }

      // Search keyword filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesCode = (item.code || '').toLowerCase().includes(q);
        return matchesName || matchesCode;
      }

      return true;
    });
  }, [allItems, selectedCategoryTab, searchQuery]);

  // Batch Cart Operations
  const handleAddItemToCart = (item: InventoryItem, initialQty = 1) => {
    setBatchCart(prev => {
      const idx = prev.findIndex(ci => ci.item.id === item.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          quantity: Math.round((updated[idx].quantity + initialQty) * 100) / 100,
        };
        return updated;
      }
      return [...prev, { item, quantity: initialQty, notes: '' }];
    });
  };

  const handleUpdateCartQty = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveFromCart(itemId);
      return;
    }
    setBatchCart(prev =>
      prev.map(ci => (ci.item.id === itemId ? { ...ci, quantity: Math.round(newQty * 100) / 100 } : ci))
    );
  };

  const handleAdjustCartQty = (itemId: string, delta: number) => {
    setBatchCart(prev =>
      prev
        .map(ci => {
          if (ci.item.id === itemId) {
            const next = Math.round((ci.quantity + delta) * 100) / 100;
            return { ...ci, quantity: next };
          }
          return ci;
        })
        .filter(ci => ci.quantity > 0)
    );
  };

  const handleUpdateCartNotes = (itemId: string, notes: string) => {
    setBatchCart(prev =>
      prev.map(ci => (ci.item.id === itemId ? { ...ci, notes } : ci))
    );
  };

  const handleRemoveFromCart = (itemId: string) => {
    setBatchCart(prev => prev.filter(ci => ci.item.id !== itemId));
  };

  const handleClearCart = () => {
    if (batchCart.length > 0 && window.confirm('Clear all items from current production tray?')) {
      setBatchCart([]);
      setBatchNotes('');
    }
  };

  // Preset Template Loader
  const handleLoadPreset = (presetName: 'morning' | 'evening' | 'chutneys') => {
    const findItem = (kw: string) =>
      allItems.find(i => i.name.toLowerCase().includes(kw.toLowerCase()));

    const newItems: BatchCartItem[] = [];

    if (presetName === 'morning') {
      const pb = findItem('pav bhaji');
      const ch = findItem('chole');
      const pp = findItem('pani puri');
      const al = findItem('potato');
      const tp = findItem('teekha');
      const sc = findItem('saunth');

      if (pb) newItems.push({ item: pb, quantity: 40, notes: 'Morning batch 1' });
      if (ch) newItems.push({ item: ch, quantity: 25, notes: 'Morning batch 1' });
      if (pp) newItems.push({ item: pp, quantity: 500, notes: 'Morning batch 1' });
      if (al) newItems.push({ item: al, quantity: 30, notes: 'Boiled & spiced' });
      if (tp) newItems.push({ item: tp, quantity: 15, notes: 'Fresh mint water' });
      if (sc) newItems.push({ item: sc, quantity: 10, notes: 'Tamarind saunth' });
    } else if (presetName === 'evening') {
      const pb = findItem('pav bhaji');
      const tp = findItem('teekha');
      const sv = findItem('sev');
      const pd = findItem('papdi');

      if (pb) newItems.push({ item: pb, quantity: 20, notes: 'Evening restock' });
      if (tp) newItems.push({ item: tp, quantity: 10, notes: 'Evening restock' });
      if (sv) newItems.push({ item: sv, quantity: 5, notes: 'Fresh crisp' });
      if (pd) newItems.push({ item: pd, quantity: 200, notes: 'Evening restock' });
    } else if (presetName === 'chutneys') {
      const tp = findItem('teekha');
      const hp = findItem('hing');
      const sc = findItem('saunth');
      const gc = findItem('coriander');

      if (tp) newItems.push({ item: tp, quantity: 20, notes: 'Chutney run' });
      if (hp) newItems.push({ item: hp, quantity: 15, notes: 'Chutney run' });
      if (sc) newItems.push({ item: sc, quantity: 15, notes: 'Chutney run' });
      if (gc) newItems.push({ item: gc, quantity: 10, notes: 'Chutney run' });
    }

    if (newItems.length > 0) {
      setBatchCart(newItems);
      setBatchNotes(`Standard ${presetName.toUpperCase()} Prep Run`);
      showToast(`Loaded ${newItems.length} items for ${presetName} production!`, 'info');
    } else {
      showToast('Items matching preset not found in inventory', 'warning');
    }
  };

  // Submit Multi-Item Production Batch
  const handleSubmitBatch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (batchCart.length === 0) {
      showToast('Please add at least one dish to the production batch tray', 'warning');
      return;
    }

    // Validate quantities
    const invalidItem = batchCart.find(ci => ci.quantity <= 0 || isNaN(ci.quantity));
    if (invalidItem) {
      showToast(`Invalid quantity for "${invalidItem.item.name}". Must be greater than 0.`, 'error');
      return;
    }

    setIsSubmittingBatch(true);
    try {
      const result = await productionRepo.recordBatchProduction({
        business_id: 'biz_chaatkulture_01',
        location_id: 'loc_base_01',
        production_date: batchDate ? new Date(batchDate).toISOString() : new Date().toISOString(),
        created_by: chefName.trim() || 'Kitchen Manager',
        notes: batchNotes.trim() || undefined,
        items: batchCart.map(ci => ({
          inventory_item_id: ci.item.id,
          item_name: ci.item.name,
          quantity_produced: ci.quantity,
          unit: ci.item.base_unit,
          notes: ci.notes.trim() || undefined,
        })),
      });

      showToast(
        `Batch #${result.batch_number} logged! Successfully added ${result.total_items} dishes (${result.total_quantity} units) to Base Kitchen stock!`,
        'success'
      );

      // Reset cart
      setBatchCart([]);
      setBatchNotes('');
      setBatchDate(new Date().toISOString().slice(0, 16));

      // Reload fresh balances and records
      await loadData();
    } catch (err: any) {
      console.error('Failed to record production batch:', err);
      showToast(err.message || 'Error recording kitchen production batch', 'error');
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  // View Multi-Item Batch Slip
  const handleOpenBatchDetails = async (batchNumber: string) => {
    try {
      const batchRecs = await productionRepo.getRecordsByBatchNumber(batchNumber);
      setViewingBatchNumber(batchNumber);
      setViewingBatchRecords(batchRecs);
    } catch (err) {
      console.error(err);
      showToast('Error opening batch details', 'error');
    }
  };

  // Grouped history records by batch number for cohesive view
  const groupedBatches = useMemo(() => {
    const map = new Map<string, ProductionRecord[]>();
    for (const rec of records) {
      const bn = rec.batch_number || 'UNBATCHED';
      const existing = map.get(bn) || [];
      existing.push(rec);
      map.set(bn, existing);
    }
    return Array.from(map.entries()).map(([batchNumber, batchRecords]) => {
      const date = batchRecords[0]?.production_date || batchRecords[0]?.created_at || '';
      const notes = batchRecords[0]?.notes || '';
      const createdBy = batchRecords[0]?.created_by || 'Kitchen Manager';
      const totalVolume = batchRecords.reduce((sum, r) => sum + r.quantity_produced, 0);
      return {
        batchNumber,
        date,
        notes,
        createdBy,
        records: batchRecords,
        totalItems: batchRecords.length,
        totalVolume,
      };
    });
  }, [records]);

  // Statistics
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayRecords = records.filter(r => r.production_date.startsWith(todayStr));
    const todayBatchesCount = new Set(todayRecords.map(r => r.batch_number)).size;
    const todayVolume = todayRecords.reduce((sum, r) => sum + r.quantity_produced, 0);
    return {
      todayBatchesCount,
      todayVolume: Math.round(todayVolume * 10) / 10,
      totalBatches: groupedBatches.length,
      availableCookedItems: allItems.filter(
        i => i.category_type === 'prepared_food' || i.category_type === 'semi_prepared'
      ).length,
    };
  }, [records, groupedBatches, allItems]);

  const totalCartVolume = useMemo(() => {
    return Math.round(batchCart.reduce((sum, ci) => sum + ci.quantity, 0) * 100) / 100;
  }, [batchCart]);

  return (
    <div className="space-y-4">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <ChefHat className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white tracking-tight">Base Kitchen Production Console</h2>
            <Badge variant="warning" size="sm">
              BASE-01
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            POS-style fast batch entry: click multiple cooked dishes to load and record them simultaneously in one batch run.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveMode('pos')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeMode === 'pos'
                ? 'bg-orange-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ChefHat className="w-3.5 h-3.5" />
            <span>Production POS Entry</span>
            {batchCart.length > 0 && (
              <span className="bg-white text-orange-600 text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                {batchCart.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveMode('history')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeMode === 'history'
                ? 'bg-orange-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Batch History ({groupedBatches.length})</span>
          </button>
        </div>
      </div>

      {/* PRD Rule 9 Notice */}
      <div className="px-4 py-2.5 bg-slate-900/80 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-400 shrink-0" />
          <span>
            <strong className="text-slate-200">PRD Rule 9:</strong> Production output directly increments cooked stock in Base Kitchen (BASE-01). <strong>Raw materials are never auto-consumed.</strong>
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-[11px]">
          <span>Today's Batches: <strong className="text-white">{stats.todayBatchesCount}</strong></span>
          <span>Today's Output: <strong className="text-emerald-400">+{stats.todayVolume} units</strong></span>
        </div>
      </div>

      {/* ===================== MODE 1: PRODUCTION POS ENTRY ===================== */}
      {activeMode === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* LEFT 7 COLS: Catalog Grid */}
          <div className="lg:col-span-7 space-y-3">
            {/* Quick Batch Presets */}
            <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-2xl flex items-center gap-2 overflow-x-auto">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 shrink-0 pl-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Presets:
              </span>
              <button
                onClick={() => handleLoadPreset('morning')}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 whitespace-nowrap transition-colors"
              >
                🌅 Morning Prep (6 Items)
              </button>
              <button
                onClick={() => handleLoadPreset('evening')}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 whitespace-nowrap transition-colors"
              >
                🌇 Evening Restock (4 Items)
              </button>
              <button
                onClick={() => handleLoadPreset('chutneys')}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 whitespace-nowrap transition-colors"
              >
                🥣 Chutneys & Waters (4 Items)
              </button>
            </div>

            {/* Search & Category Filter Pills */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search cooked dishes, puries, gravies, chutneys by name or code..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
                {[
                  { id: 'all', label: `All Cooked (${allItems.length})` },
                  { id: 'cooked_bases', label: 'Bases & Gravies' },
                  { id: 'puris_snacks', label: 'Snacks & Puris' },
                  { id: 'chutneys_waters', label: 'Chutneys & Waters' },
                  { id: 'prep_mixes', label: 'Prep Mixes' },
                  { id: 'beverages_sweets', label: 'Beverages & Sweets' },
                  { id: 'all_inventory', label: 'All Inventory Items' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedCategoryTab(tab.id)}
                    className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
                      selectedCategoryTab === tab.id
                        ? 'bg-orange-600 text-white shadow-sm'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Items Grid */}
            {filteredItems.length === 0 ? (
              <EmptyState
                icon={<Boxes className="w-8 h-8" />}
                title="No items found in this section"
                description="Try clearing your search keyword or switch to 'All Cooked' to see available dishes."
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[620px] overflow-y-auto pr-1">
                {filteredItems.map(item => {
                  const inCartItem = batchCart.find(ci => ci.item.id === item.id);
                  const currentStock = stockMap.get(item.id) || 0;
                  const isAdded = !!inCartItem;

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleAddItemToCart(item, 1)}
                      className={`relative p-3 rounded-2xl border text-left cursor-pointer select-none transition-all flex flex-col justify-between ${
                        isAdded
                          ? 'bg-gradient-to-b from-orange-950/40 to-slate-900 border-orange-500 shadow-lg shadow-orange-950/30'
                          : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 hover:bg-slate-850 shadow-sm'
                      }`}
                    >
                      {/* Active In-Batch Badge */}
                      {isAdded && (
                        <div className="absolute top-2 right-2 flex items-center gap-1 bg-orange-600 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shadow">
                          <span>{inCartItem.quantity} {item.base_unit}</span>
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                            {item.code || 'PR-00'}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-white line-clamp-2 leading-tight">
                          {item.name}
                        </h4>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">
                          Stock: <strong className={currentStock > 0 ? 'text-slate-200' : 'text-slate-500'}>{currentStock}</strong>
                        </span>
                        <span className="font-bold text-orange-400 uppercase text-[10px] bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                          {item.base_unit}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT 5 COLS: Batch Production Tray (POS Cart) */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-4 sticky top-4">
            {/* Tray Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-orange-400" />
                <h3 className="text-sm font-bold text-white">Current Production Batch</h3>
                <span className="text-[10px] font-mono font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                  {batchCart.length} {batchCart.length === 1 ? 'Item' : 'Items'}
                </span>
              </div>
              {batchCart.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearCart}
                  className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            {/* Tray Items List */}
            {batchCart.length === 0 ? (
              <div className="py-12 px-4 text-center space-y-3 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto">
                  <ChefHat className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-300">Production Tray is Empty</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 max-w-xs mx-auto">
                    Tap dishes on the left to add them here. Multiple items will be recorded together in one production batch.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {batchCart.map(ci => (
                  <div
                    key={ci.item.id}
                    className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2 hover:border-slate-700 transition-colors"
                  >
                    {/* Item row header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                            {ci.item.code || 'PR-00'}
                          </span>
                          <h5 className="text-xs font-bold text-white truncate">{ci.item.name}</h5>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveFromCart(ci.item.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded-lg transition-colors shrink-0"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Quantity controls: Steppers + Quick chips */}
                    <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleAdjustCartQty(ci.item.id, -1)}
                          className="w-7 h-7 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-700 flex items-center justify-center font-bold text-xs"
                        >
                          <Minus className="w-3 h-3" />
                        </button>

                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={ci.quantity}
                            onChange={e => handleUpdateCartQty(ci.item.id, parseFloat(e.target.value) || 0)}
                            className="w-20 bg-slate-900 border border-slate-700 rounded-lg py-1 px-2 text-center text-xs font-bold text-white font-mono focus:outline-none focus:border-orange-500"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAdjustCartQty(ci.item.id, 1)}
                          className="w-7 h-7 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-700 flex items-center justify-center font-bold text-xs"
                        >
                          <Plus className="w-3 h-3" />
                        </button>

                        <span className="text-[11px] font-bold text-orange-400 font-mono ml-1">
                          {ci.item.base_unit}
                        </span>
                      </div>

                      {/* Quick Adder Chips */}
                      <div className="flex items-center gap-1">
                        {[5, 10, 25].map(inc => (
                          <button
                            key={inc}
                            type="button"
                            onClick={() => handleAdjustCartQty(ci.item.id, inc)}
                            className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-750"
                          >
                            +{inc}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Per-item note */}
                    <input
                      type="text"
                      placeholder="Item notes (e.g. Mild spicy / Boiled fresh)..."
                      value={ci.notes}
                      onChange={e => handleUpdateCartNotes(ci.item.id, e.target.value)}
                      className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-orange-500/50"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Batch Metadata Fields */}
            <div className="space-y-2.5 pt-2 border-t border-slate-800">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Batch Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={batchDate}
                    onChange={e => setBatchDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                    <User className="w-3 h-3" /> Chef / Supervisor
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Chef Ram Kumar"
                    value={chefName}
                    onChange={e => setChefName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                  <FileText className="w-3 h-3" /> Master Batch Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Morning preparation run for Shahpura and 11 No. outlets..."
                  value={batchNotes}
                  onChange={e => setBatchNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            {/* Batch Summary Footer */}
            <div className="pt-2 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400">Total Output to Log:</span>
                <span className="text-sm font-bold text-white font-mono">
                  {batchCart.length} Dishes &bull; <strong className="text-emerald-400">+{totalCartVolume} Units</strong>
                </span>
              </div>

              {/* Big POS Action CTA */}
              <Button
                variant="primary"
                size="md"
                onClick={handleSubmitBatch}
                disabled={batchCart.length === 0 || isSubmittingBatch}
                className="w-full justify-center text-sm font-bold py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 shadow-lg shadow-orange-950/40"
              >
                {isSubmittingBatch ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Recording Batch & Updating Stock...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {batchCart.length === 0
                        ? 'Record Kitchen Batch'
                        : `Record Kitchen Batch (${batchCart.length} Dishes)`}
                    </span>
                  </div>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODE 2: BATCH HISTORY & AUDITS ===================== */}
      {activeMode === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-orange-400" />
              <span>Production Batches Logged ({groupedBatches.length})</span>
            </h3>
            <Button variant="secondary" size="sm" onClick={() => setActiveMode('pos')}>
              <Plus className="w-4 h-4" />
              <span>+ New Production Batch</span>
            </Button>
          </div>

          {groupedBatches.length === 0 ? (
            <EmptyState
              icon={<ChefHat className="w-8 h-8" />}
              title="No Production Batches Logged Yet"
              description="Switch to 'Production POS Entry' to log your first batch of cooked dishes."
              actionLabel="+ Open Production POS"
              onAction={() => setActiveMode('pos')}
            />
          ) : (
            <div className="space-y-3">
              {groupedBatches.map(batch => (
                <div
                  key={batch.batchNumber}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm hover:border-slate-750 transition-colors space-y-3"
                >
                  {/* Batch Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold font-mono text-orange-400">
                        {batch.batchNumber}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {new Date(batch.date).toLocaleString()}
                      </span>
                      <Badge variant="outline" size="sm">
                        Base Kitchen (BASE-01)
                      </Badge>
                      <span className="text-xs text-slate-400">
                        by <strong className="text-slate-200">{batch.createdBy}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenBatchDetails(batch.batchNumber)}
                        className="text-xs text-orange-400 border-orange-500/30 hover:bg-orange-500/10 flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Slip</span>
                      </Button>
                    </div>
                  </div>

                  {/* Items in this batch */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {batch.records.map(rec => (
                      <div
                        key={rec.id}
                        className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <h6 className="text-xs font-bold text-white truncate">
                            {rec.item_name || rec.inventory_item_id}
                          </h6>
                          {rec.notes && (
                            <p className="text-[10px] text-slate-500 truncate">{rec.notes}</p>
                          )}
                        </div>
                        <span className="font-mono text-xs font-bold text-emerald-400 shrink-0">
                          +{rec.quantity_produced} {rec.unit}
                        </span>
                      </div>
                    ))}
                  </div>

                  {batch.notes && (
                    <p className="text-xs text-slate-400 bg-slate-950/40 p-2 rounded-lg border border-slate-850">
                      <strong className="text-slate-500 font-medium">Batch Notes:</strong> {batch.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================== MODAL 1: BATCH PRODUCTION SLIP / TICKET ===================== */}
      <Modal
        isOpen={!!viewingBatchNumber}
        onClose={() => {
          setViewingBatchNumber(null);
          setViewingBatchRecords([]);
        }}
        title="Base Kitchen Production Ticket"
        subtitle={`Batch #${viewingBatchNumber}`}
        maxWidth="lg"
      >
        {viewingBatchRecords.length > 0 && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-4 font-mono text-xs">
              {/* Slip Header */}
              <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                <div>
                  <h3 className="font-bold text-base text-white">CHAAT KULTURE BASE KITCHEN</h3>
                  <p className="text-[11px] text-slate-400">Cooked Food Production Batch Run</p>
                  <p className="text-[10px] text-slate-500">Location: BASE-01 &bull; Govindpura, Bhopal</p>
                </div>
                <div className="text-right">
                  <span className="text-orange-400 font-bold text-sm block">
                    {viewingBatchNumber}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {new Date(viewingBatchRecords[0].production_date).toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    Chef: {viewingBatchRecords[0].created_by || 'Kitchen Manager'}
                  </span>
                </div>
              </div>

              {/* Items Breakdown Table */}
              <div>
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2">Item Name</th>
                      <th className="py-2 text-right">Yield Quantity</th>
                      <th className="py-2 pl-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {viewingBatchRecords.map((r, i) => (
                      <tr key={r.id}>
                        <td className="py-2 font-bold text-white">
                          {i + 1}. {r.item_name || r.inventory_item_id}
                        </td>
                        <td className="py-2 text-right font-bold text-emerald-400 text-sm">
                          +{r.quantity_produced} {r.unit}
                        </td>
                        <td className="py-2 pl-4 text-slate-400 text-[11px]">
                          {r.notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary line */}
              <div className="border-t border-slate-800 pt-2 flex justify-between items-center text-xs">
                <span className="text-slate-400">Total Items Produced:</span>
                <span className="font-bold text-white">
                  {viewingBatchRecords.length} Dishes (
                  {viewingBatchRecords.reduce((sum, r) => sum + r.quantity_produced, 0)} units)
                </span>
              </div>

              {viewingBatchRecords[0]?.notes && (
                <div className="border-t border-slate-800 pt-2 text-[11px] text-slate-400">
                  <span className="text-slate-500 font-bold">Chef / Supervisor Notes:</span>{' '}
                  {viewingBatchRecords[0].notes}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.print()}
                className="flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print Batch Slip</span>
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setViewingBatchNumber(null);
                  setViewingBatchRecords([]);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ===================== MODAL 2: EDIT BATCH (Super Admin / Manager) ===================== */}
      <Modal
        isOpen={!!editingBatch}
        onClose={() => setEditingBatch(null)}
        title="Edit Production Batch"
        subtitle={`Batch #${editingBatch?.batch_number}`}
        maxWidth="md"
      >
        <form
          onSubmit={async e => {
            e.preventDefault();
            if (!editingBatch) return;
            const newQtyNum = parseFloat(editQty);
            if (isNaN(newQtyNum) || newQtyNum <= 0) {
              showToast('Please enter a valid quantity produced', 'warning');
              return;
            }
            try {
              await productionRepo.updateProductionRecord(
                editingBatch.id,
                {
                  quantity_produced: newQtyNum,
                  notes: editNotes.trim(),
                },
                currentRole
              );
              showToast(
                `Updated Batch #${editingBatch.batch_number}. Inventory balance adjusted.`,
                'success'
              );
              setEditingBatch(null);
              await loadData();
            } catch (err: any) {
              showToast(err.message || 'Error updating production record', 'error');
            }
          }}
          className="space-y-4"
        >
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300">
            ℹ️ Correcting the batch quantity will automatically update the available stock in Base Kitchen by the difference and append an audit movement entry.
          </div>

          <Input
            label="Quantity Produced *"
            type="number"
            step="0.01"
            value={editQty}
            onChange={e => setEditQty(e.target.value)}
            required
          />

          <Input
            label="Chef / Batch Notes"
            value={editNotes}
            onChange={e => setEditNotes(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setEditingBatch(null)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* ===================== MODAL 3: VOID BATCH (Super Admin Only) ===================== */}
      <Modal
        isOpen={!!voidingBatch}
        onClose={() => setVoidingBatch(null)}
        title="Void & Reverse Production Batch"
        subtitle={`Batch #${voidingBatch?.batch_number}`}
        maxWidth="md"
      >
        <form
          onSubmit={async e => {
            e.preventDefault();
            if (!voidingBatch || !voidReason.trim()) {
              showToast('Please state a reason for voiding', 'warning');
              return;
            }
            try {
              await productionRepo.deleteProductionRecord(voidingBatch.id, voidReason.trim(), currentRole);
              showToast(
                `Voided Batch #${voidingBatch.batch_number}. Stock reversed from Base Kitchen.`,
                'success'
              );
              setVoidingBatch(null);
              await loadData();
            } catch (err: any) {
              showToast(err.message || 'Error voiding production record', 'error');
            }
          }}
          className="space-y-4"
        >
          <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300">
            ⚠️ <strong>Yield Rollback:</strong> Deleting this batch will deduct {voidingBatch?.quantity_produced} {voidingBatch?.unit} of {voidingBatch?.item_name} from Base Kitchen stock and append an immutable reversal to the movement ledger.
          </div>

          <Input
            label="Mandatory Reason for Voiding *"
            placeholder="e.g. Spoiled during cooking / Batch burned / Data entry mistake"
            value={voidReason}
            onChange={e => setVoidReason(e.target.value)}
            required
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setVoidingBatch(null)}>
              Cancel
            </Button>
            <Button variant="danger" type="submit">
              Confirm Stock Reversal & Delete
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
