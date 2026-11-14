import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { db } from '../../lib/db';
import { transfersRepo } from '../../lib/dal/transfersRepo';
import { inventoryRepo } from '../../lib/dal/inventoryRepo';
import { productionRepo } from '../../lib/dal/productionRepo';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  Boxes,
  Truck,
  Plus,
  Minus,
  Trash2,
  Search,
  X,
  Sparkles,
  AlertTriangle,
  Send,
  Calendar,
  Clock,
  CheckCircle2,
  FileText,
  User,
  Phone,
  Layers,
  ShoppingBag,
} from 'lucide-react';
import type { StockRequest, InventoryItem, InventoryCategoryType, Location } from '../../types';

export interface CartLineItem {
  itemId: string;
  name: string;
  code?: string;
  categoryType: InventoryCategoryType;
  unit: string;
  quantity: number;
  requestedQuantity?: number;
  kitchenAvailable?: number;
  notes?: string;
}

interface TransferPOSModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'indent' | 'dispatch';
  linkedRequest?: StockRequest | null;
  onSuccess: () => void;
}

const CATEGORY_TABS = [
  { id: 'all', label: 'All Items', emoji: '📋' },
  { id: 'prepared_food', label: 'Prepared Food', emoji: '🍳' },
  { id: 'raw_material', label: 'Raw Materials', emoji: '🌾' },
  { id: 'semi_prepared', label: 'Semi-Prepared', emoji: '🥣' },
  { id: 'packaging', label: 'Packaging', emoji: '📦' },
  { id: 'disposables', label: 'Disposables', emoji: '🥢' },
  { id: 'consumables', label: 'Consumables', emoji: '🧼' },
];

export const TransferPOSModal: React.FC<TransferPOSModalProps> = ({
  isOpen,
  onClose,
  mode,
  linkedRequest,
  onSuccess,
}) => {
  const { locations, currentLocation, accessibleLocations, currentRole, currentUser, showToast } = useApp();

  const isScoped = currentRole !== 'owner' && currentRole !== 'manager';

  // Master Data
  const [allItems, setAllItems] = useState<InventoryItem[]>([]);
  const [stockMap, setStockMap] = useState<Map<string, number>>(new Map()); // Kitchen Stock
  const [destStockMap, setDestStockMap] = useState<Map<string, number>>(new Map()); // Outlet Stock
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Transfer Route Details
  const [fromLocationId, setFromLocationId] = useState<string>('');
  const [toLocationId, setToLocationId] = useState<string>('');
  const [priorityType, setPriorityType] = useState<'next_day' | 'same_day_urgent'>('next_day');
  const [requiredDate, setRequiredDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('');

  // Dispatch Logistics Details
  const [vehicleNumber, setVehicleNumber] = useState<string>('');
  const [driverName, setDriverName] = useState<string>('');
  const [driverPhone, setDriverPhone] = useState<string>('');

  // POS State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartLineItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Initialize Route Locations based on mode & permissions
  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'indent') {
      // Outlet is Requesting, Base Kitchen or Store is Fulfilling
      const defaultFrom =
        (isScoped ? accessibleLocations[0]?.id : currentLocation?.id) ||
        locations.find(l => l.type === 'outlet' || l.type === 'kiosk')?.id ||
        'loc_shah_03';
      const defaultTo =
        locations.find(l => l.type === 'base_kitchen')?.id || 'loc_base_01';

      setFromLocationId(defaultFrom);
      setToLocationId(defaultTo);
      setPriorityType('next_day');
      setNotes('');
    } else {
      // Dispatch Mode: Fulfilling source is Base Kitchen, Destination is Outlet
      const defaultSrc =
        linkedRequest?.to_location_id ||
        locations.find(l => l.type === 'base_kitchen')?.id ||
        'loc_base_01';
      const defaultDest =
        linkedRequest?.from_location_id ||
        (isScoped ? accessibleLocations[0]?.id : locations.find(l => l.id !== defaultSrc)?.id) ||
        'loc_shah_03';

      setFromLocationId(defaultSrc);
      setToLocationId(defaultDest);
      setVehicleNumber(linkedRequest ? 'MP-04-CK-8821' : '');
      setDriverName(linkedRequest ? 'Ramu Delivery' : '');
      setDriverPhone('');
      setNotes(linkedRequest ? `Fulfilling indent #${linkedRequest.request_number}` : '');
    }
  }, [isOpen, mode, linkedRequest, locations, currentLocation, accessibleLocations, isScoped]);

  // Load Inventory Items & Stock Balances
  const loadPOSData = async () => {
    setIsLoading(true);
    try {
      await productionRepo.ensureDefaultKitchenItems();
      await inventoryRepo.ensureBalances();
      let items = await inventoryRepo.getItems();
      if (items.length === 0) {
        await inventoryRepo.syncFromCloud(true);
        items = await inventoryRepo.getItems();
      }
      setAllItems(items);

      // Fetch Source Location Balances
      const srcId = mode === 'dispatch' ? fromLocationId || 'loc_base_01' : toLocationId || 'loc_base_01';
      const srcBals = await db.inventory_balances.where('location_id').equals(srcId).toArray();
      const sMap = new Map<string, number>();
      srcBals.forEach(b => sMap.set(b.inventory_item_id, b.available_quantity));
      setStockMap(sMap);

      // Fetch Destination Location Balances
      const destId = mode === 'dispatch' ? toLocationId || 'loc_shah_03' : fromLocationId || 'loc_shah_03';
      const destBals = await db.inventory_balances.where('location_id').equals(destId).toArray();
      const dMap = new Map<string, number>();
      destBals.forEach(b => dMap.set(b.inventory_item_id, b.available_quantity));
      setDestStockMap(dMap);

      // If linked request provided, initialize cart with requested items!
      if (linkedRequest && linkedRequest.items) {
        const initialCart: CartLineItem[] = linkedRequest.items.map(it => {
          const inv = items.find(i => i.id === it.inventory_item_id);
          const kAvail = sMap.get(it.inventory_item_id) || 0;
          return {
            itemId: it.inventory_item_id,
            name: it.item_name || inv?.name || 'Cooked Item',
            code: inv?.code,
            categoryType: inv?.category_type || 'prepared_food',
            unit: it.unit || inv?.base_unit || 'unit',
            quantity: it.requested_quantity,
            requestedQuantity: it.requested_quantity,
            kitchenAvailable: kAvail,
          };
        });
        setCart(initialCart);
      } else {
        setCart([]);
      }
    } catch (err) {
      console.error('Error loading transfer POS data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPOSData();
    }
  }, [isOpen, fromLocationId, toLocationId]);

  // Catalog Filtering
  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return allItems.filter(item => {
      // Category Tab
      if (selectedCategory !== 'all' && (item.category_type || 'other') !== selectedCategory) {
        return false;
      }
      // Search
      if (q) {
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesCode = (item.code || '').toLowerCase().includes(q);
        const matchesUnit = item.base_unit.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesUnit) return false;
      }
      return true;
    });
  }, [allItems, selectedCategory, searchQuery]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allItems.length };
    CATEGORY_TABS.forEach(t => {
      if (t.id !== 'all') counts[t.id] = 0;
    });
    allItems.forEach(i => {
      const type = i.category_type || 'other';
      if (counts[type] !== undefined) counts[type]++;
    });
    return counts;
  }, [allItems]);

  // Cart operations
  const handleAddItemToCart = (item: InventoryItem, initialQty = 10) => {
    const existingIdx = cart.findIndex(c => c.itemId === item.id);
    if (existingIdx >= 0) {
      setCart(prev => {
        const copy = [...prev];
        copy[existingIdx].quantity = Math.round((copy[existingIdx].quantity + 1) * 10) / 10;
        return copy;
      });
    } else {
      const kAvail = stockMap.get(item.id) || 0;
      setCart(prev => [
        ...prev,
        {
          itemId: item.id,
          name: item.name,
          code: item.code,
          categoryType: item.category_type || 'prepared_food',
          unit: item.base_unit,
          quantity: initialQty,
          kitchenAvailable: kAvail,
        },
      ]);
    }
  };

  const handleUpdateQty = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(itemId);
      return;
    }
    setCart(prev =>
      prev.map(c => (c.itemId === itemId ? { ...c, quantity: Math.round(newQty * 10) / 10 } : c))
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setCart(prev => prev.filter(c => c.itemId !== itemId));
  };

  // Presets Handler
  const handleLoadPreset = (presetType: 'morning' | 'evening' | 'packaging') => {
    let keywords: string[] = [];
    let defaultQty = 10;

    if (presetType === 'morning') {
      keywords = ['chole', 'bhaaji', 'bhaji', 'chutney', 'mutter', 'allu', 'papdi'];
      defaultQty = 10;
    } else if (presetType === 'evening') {
      keywords = ['pav', 'puri', 'sev', 'chutney', 'sprouts', 'dahi'];
      defaultQty = 15;
    } else {
      keywords = ['box', 'bowl', 'spoon', 'napkin', 'bag', 'container'];
      defaultQty = 50;
    }

    const matched = allItems.filter(item => {
      const name = item.name.toLowerCase();
      const code = (item.code || '').toLowerCase();
      return keywords.some(k => name.includes(k) || code.includes(k));
    });

    if (matched.length === 0) {
      showToast('No preset items found in inventory catalog', 'warning');
      return;
    }

    setCart(prev => {
      const existingIds = new Set(prev.map(c => c.itemId));
      const newItems: CartLineItem[] = matched
        .filter(m => !existingIds.has(m.id))
        .map(m => ({
          itemId: m.id,
          name: m.name,
          code: m.code,
          categoryType: m.category_type || 'prepared_food',
          unit: m.base_unit,
          quantity: defaultQty,
          kitchenAvailable: stockMap.get(m.id) || 0,
        }));
      return [...prev, ...newItems];
    });

    showToast(`Added ${matched.length} preset items to list!`, 'success');
  };

  // Submission Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      showToast('Please add at least one item to your list', 'warning');
      return;
    }
    if (!fromLocationId || !toLocationId) {
      showToast('Source and destination locations are mandatory', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'indent') {
        const created = await transfersRepo.createStockRequest({
          business_id: 'biz_chaatkulture_01',
          from_location_id: fromLocationId,
          to_location_id: toLocationId,
          request_type: priorityType,
          required_date: requiredDate,
          notes: notes.trim(),
          created_by: currentUser?.full_name || 'Outlet Staff',
          items: cart.map(c => ({
            inventory_item_id: c.itemId,
            item_name: c.name,
            requested_quantity: c.quantity,
            unit: c.unit,
          })),
        });

        showToast(`Stock indent #${created.request_number} submitted to Kitchen!`, 'success');
      } else {
        // Dispatch Mode
        const createdChallan = await transfersRepo.createDispatch({
          business_id: 'biz_chaatkulture_01',
          stock_request_id: linkedRequest?.id || undefined,
          from_location_id: fromLocationId,
          to_location_id: toLocationId,
          vehicle_number: vehicleNumber.trim() || undefined,
          driver_name: driverName.trim() || undefined,
          driver_phone: driverPhone.trim() || undefined,
          notes: notes.trim() || undefined,
          dispatched_by: currentUser?.full_name || 'Kitchen Dispatcher',
          items: cart.map(c => ({
            inventory_item_id: c.itemId,
            item_name: c.name,
            requested_quantity: c.requestedQuantity !== undefined ? c.requestedQuantity : c.quantity,
            dispatched_quantity: c.quantity,
            unit: c.unit,
          })),
        });

        showToast(`Delivery challan #${createdChallan.challan_number} dispatched to outlet!`, 'success');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error processing transfer', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalUnits = useMemo(() => {
    return Math.round(cart.reduce((sum, c) => sum + c.quantity, 0) * 10) / 10;
  }, [cart]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        mode === 'indent'
          ? '🛒 Outlet Stock Indent Station (POS)'
          : linkedRequest
          ? `🚚 Dispatch Delivery Challan (Indent #${linkedRequest.request_number})`
          : '🚚 Kitchen Delivery Dispatch Station (POS)'
      }
      subtitle={
        mode === 'indent'
          ? 'Tap cooked foods and packaging items from the menu to quickly build your daily morning or urgent stock indent.'
          : 'Adjust dispatched quantities, add extra delivery items, and assign transport vehicle & driver.'
      }
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Top Control Bar: Locations, Date & Priority */}
        <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {mode === 'indent' ? (
            <>
              <Select
                label="Requesting Outlet *"
                value={fromLocationId}
                onChange={e => setFromLocationId(e.target.value)}
                options={(isScoped ? accessibleLocations : locations)
                  .filter(l => l.id !== toLocationId)
                  .map(l => ({ value: l.id, label: `${l.name} (${l.code})` }))}
              />
              <Select
                label="Fulfilling Kitchen / Store *"
                value={toLocationId}
                onChange={e => setToLocationId(e.target.value)}
                options={locations
                  .filter(l => l.id !== fromLocationId)
                  .map(l => ({
                    value: l.id,
                    label:
                      l.type === 'base_kitchen'
                        ? `🍳 ${l.name} (Kitchen)`
                        : l.type === 'store_room'
                        ? `📦 ${l.name} (Store)`
                        : `${l.name} (${l.code})`,
                  }))}
              />
              <div className="grid grid-cols-2 gap-2">
                <Select
                  label="Priority"
                  value={priorityType}
                  onChange={e => setPriorityType(e.target.value as any)}
                  options={[
                    { value: 'next_day', label: '🌅 Routine Next-Day' },
                    { value: 'same_day_urgent', label: '⚡ Urgent Refill' },
                  ]}
                />
                <Input
                  label="Required Date"
                  type="date"
                  value={requiredDate}
                  onChange={e => setRequiredDate(e.target.value)}
                  required
                />
              </div>
            </>
          ) : (
            <>
              <Select
                label="Source Location (Kitchen) *"
                value={fromLocationId}
                onChange={e => setFromLocationId(e.target.value)}
                options={locations
                  .filter(l => l.type === 'base_kitchen' || l.type === 'store_room')
                  .map(l => ({ value: l.id, label: `${l.name} (${l.code})` }))}
              />
              <Select
                label="Destination Outlet *"
                value={toLocationId}
                onChange={e => setToLocationId(e.target.value)}
                options={locations
                  .filter(l => l.id !== fromLocationId)
                  .map(l => ({ value: l.id, label: `${l.name} (${l.code})` }))}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Vehicle #"
                  placeholder="e.g. MP-04-CK-8821"
                  value={vehicleNumber}
                  onChange={e => setVehicleNumber(e.target.value.toUpperCase())}
                />
                <Input
                  label="Driver Name"
                  placeholder="e.g. Ramu"
                  value={driverName}
                  onChange={e => setDriverName(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        {/* 2-COLUMN POS LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* LEFT 7 COLS: Catalog Grid */}
          <div className="lg:col-span-7 space-y-3">
            {/* Quick Presets Bar */}
            <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl flex items-center gap-2 overflow-x-auto no-scrollbar">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 shrink-0 pl-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Presets:
              </span>
              <button
                type="button"
                onClick={() => handleLoadPreset('morning')}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 whitespace-nowrap transition-colors"
              >
                🌅 Morning Prep (Chutneys, Chole, Bhaaji)
              </button>
              <button
                type="button"
                onClick={() => handleLoadPreset('evening')}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 whitespace-nowrap transition-colors"
              >
                🌇 Evening Rush (Pav, Puris, Sev)
              </button>
              <button
                type="button"
                onClick={() => handleLoadPreset('packaging')}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 whitespace-nowrap transition-colors"
              >
                📦 Packaging Essentials
              </button>
            </div>

            {/* Search & Category Tabs */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search dishes, packaging, groceries by name or code..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                {CATEGORY_TABS.map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedCategory(tab.id)}
                    className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      selectedCategory === tab.id
                        ? 'bg-orange-600 text-white shadow-sm'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    <span>{tab.emoji}</span>
                    <span>{tab.label}</span>
                    <span className="text-[10px] bg-black/30 px-1.5 py-0.2 rounded-full font-mono">
                      {categoryCounts[tab.id] || 0}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Item Cards Grid */}
            {filteredCatalog.length === 0 ? (
              <EmptyState
                icon={<Boxes className="w-8 h-8" />}
                title="No Items Found"
                description="Try changing your search term or category filter."
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[460px] overflow-y-auto pr-1">
                {filteredCatalog.map(item => {
                  const inCartItem = cart.find(c => c.itemId === item.id);
                  const isSelected = !!inCartItem;
                  const kStock = stockMap.get(item.id) || 0;
                  const oStock = destStockMap.get(item.id) || 0;

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleAddItemToCart(item)}
                      className={`cursor-pointer rounded-2xl p-3 border transition-all text-left flex flex-col justify-between relative group select-none ${
                        isSelected
                          ? 'bg-orange-950/40 border-orange-500 shadow-md shadow-orange-950/30'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                      }`}
                    >
                      {/* Top row: Code & Selection Indicator */}
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-mono text-[10px] font-bold text-orange-400 bg-orange-950/60 px-1.5 py-0.5 rounded border border-orange-900/50">
                          {item.code || 'INV'}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] font-bold bg-orange-600 text-white px-1.5 py-0.2 rounded-full">
                            ✓ {inCartItem.quantity} {item.base_unit}
                          </span>
                        )}
                      </div>

                      {/* Item Name */}
                      <div className="font-bold text-white text-xs leading-snug line-clamp-2 my-1">
                        {item.name}
                      </div>

                      {/* Bottom Info: Stock Indicators */}
                      <div className="pt-2 border-t border-slate-800/80 mt-1 flex items-center justify-between text-[10px]">
                        <span className="font-mono text-slate-400">
                          Unit: <strong className="text-slate-200">{item.base_unit}</strong>
                        </span>

                        {mode === 'dispatch' ? (
                          <span
                            className={`font-mono font-bold ${
                              kStock > 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                            title="Live balance at Base Kitchen"
                          >
                            Kitchen: {kStock}
                          </span>
                        ) : (
                          <span className="font-mono text-slate-400" title="Stock at outlet">
                            At Outlet: <strong className="text-slate-200">{oStock}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT 5 COLS: Cart / Tray */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-3 shadow-xl flex flex-col justify-between h-full min-h-[520px]">
            <div className="space-y-3">
              {/* Cart Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-orange-400" />
                  <span className="font-bold text-white text-xs uppercase tracking-wider">
                    {mode === 'indent' ? 'Requested List' : 'Dispatch Challan Items'}
                  </span>
                  <Badge variant="warning" size="sm">
                    {cart.length} items
                  </Badge>
                </div>

                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    className="text-[11px] text-slate-400 hover:text-rose-400 transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* Items in Cart */}
              {cart.length === 0 ? (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <Boxes className="w-8 h-8 mx-auto text-slate-600" />
                  <p className="text-xs font-semibold text-slate-400">No Items Added Yet</p>
                  <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                    Tap any item card from the menu on the left to add it to your {mode === 'indent' ? 'indent' : 'dispatch'} list.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1 divide-y divide-slate-800/60">
                  {cart.map((line, idx) => {
                    const isShortage =
                      mode === 'dispatch' &&
                      line.kitchenAvailable !== undefined &&
                      line.quantity > line.kitchenAvailable;

                    return (
                      <div key={line.itemId} className="pt-2 first:pt-0 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                              <span>{line.name}</span>
                              {line.code && (
                                <span className="font-mono text-[9px] text-orange-400 bg-orange-950/60 px-1 py-0.2 rounded">
                                  {line.code}
                                </span>
                              )}
                            </div>
                            {mode === 'dispatch' && line.requestedQuantity !== undefined && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                Indented: <strong>{line.requestedQuantity} {line.unit}</strong> • Kitchen: {line.kitchenAvailable ?? 0} {line.unit}
                              </div>
                            )}
                          </div>

                          {/* Delete Item */}
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(line.itemId)}
                            className="text-slate-500 hover:text-rose-400 p-1"
                            title="Remove item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Quantity Stepper Bar */}
                        <div className="flex items-center justify-between gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(line.itemId, line.quantity - 1)}
                              className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold flex items-center justify-center text-xs transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>

                            <input
                              type="number"
                              step="0.1"
                              min="0.1"
                              value={line.quantity}
                              onChange={e => handleUpdateQty(line.itemId, parseFloat(e.target.value) || 0)}
                              className="w-16 bg-slate-900 border border-slate-700 rounded-lg text-center font-mono font-bold text-white text-xs py-1 focus:outline-none focus:border-orange-500"
                            />

                            <button
                              type="button"
                              onClick={() => handleUpdateQty(line.itemId, line.quantity + 1)}
                              className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold flex items-center justify-center text-xs transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <span className="font-mono text-xs font-bold text-slate-300 pr-1">
                            {line.unit}
                          </span>
                        </div>

                        {/* Stock shortage warning in dispatch mode */}
                        {isShortage && (
                          <div className="text-[10px] text-rose-400 font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            Warning: Exceeds available kitchen stock ({line.kitchenAvailable} {line.unit})
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bottom Actions & Notes */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <Input
                placeholder={mode === 'indent' ? 'Optional indent notes (e.g. extra spicy batch)' : 'Optional delivery challan notes'}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="text-xs"
              />

              {/* Summary Stats */}
              <div className="flex items-center justify-between text-xs bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400">Total Quantities:</span>
                <span className="font-mono font-bold text-white text-sm">
                  {totalUnits} units across {cart.length} items
                </span>
              </div>

              {/* Submit CTA */}
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={onClose}
                  className="flex-1"
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>

                <Button
                  variant="primary"
                  type="submit"
                  disabled={isSubmitting || cart.length === 0}
                  className="flex-2 bg-orange-600 hover:bg-orange-500 font-bold flex items-center justify-center gap-2 shadow-lg shadow-orange-950/40 text-xs py-2.5"
                >
                  {isSubmitting ? (
                    'Processing...'
                  ) : mode === 'indent' ? (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Submit Indent ({cart.length} Items)</span>
                    </>
                  ) : (
                    <>
                      <Truck className="w-4 h-4" />
                      <span>Dispatch Challan ({cart.length} Items)</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
};
