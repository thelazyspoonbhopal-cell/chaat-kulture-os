import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { db } from '../../lib/db';
import { inventoryRepo } from '../../lib/dal/inventoryRepo';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  Boxes,
  ArrowUpDown,
  SlidersHorizontal,
  History,
  AlertTriangle,
  PlusCircle,
  FileSpreadsheet,
  Lock,
} from 'lucide-react';
import type { InventoryItem, InventoryBalance, InventoryMovement, Location } from '../../types';

export const InventoryLedgerView: React.FC = () => {
  const { locations, currentLocation, accessibleLocations, currentRole, showToast } = useApp();

  const isScoped = currentRole !== 'owner' && currentRole !== 'manager';
  const displayLocations = isScoped ? accessibleLocations : locations;
  const accessibleLocIds = useMemo(() => accessibleLocations.map(l => l.id), [accessibleLocations]);

  const [activeSubTab, setActiveSubTab] = useState<'matrix' | 'movements'>('matrix');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [movementFilter, setMovementFilter] = useState<string>('all');

  // Adjustment Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState<boolean>(false);
  const [adjustItemId, setAdjustItemId] = useState<string>('');
  const [adjustLocId, setAdjustLocId] = useState<string>('');
  const [adjustNewQty, setAdjustNewQty] = useState<string>('');
  const [adjustReason, setAdjustReason] = useState<string>('');

  const loadData = async () => {
    try {
      const allItems = await inventoryRepo.getItems();
      const allBalances = await db.inventory_balances.toArray();
      const allMovements = await db.inventory_movements.orderBy('created_at').reverse().toArray();

      setItems(allItems);
      setBalances(allBalances);
      setMovements(allMovements);

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

  // Helper to find balance of an item at a specific location
  const getBalance = (locationId: string, itemId: string) => {
    const bal = balances.find(b => b.location_id === locationId && b.inventory_item_id === itemId);
    return bal ? bal.available_quantity : 0;
  };

  const getInTransit = (locationId: string, itemId: string) => {
    const bal = balances.find(b => b.location_id === locationId && b.inventory_item_id === itemId);
    return bal ? bal.in_transit_quantity : 0;
  };

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
          <h2 className="text-base font-bold text-white tracking-tight">Multi-Location Inventory & Movement Ledger</h2>
          <p className="text-xs text-slate-400">
            Strict movement-ledger tracking across the 4 locations. <strong>No recipe auto-deductions.</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
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

      {/* Sub Tabs */}
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
        <div>
          {items.length === 0 ? (
            <EmptyState
              icon={<Boxes className="w-8 h-8" />}
              title="Inventory Master is Empty"
              description="No inventory items or raw materials registered yet. Go to Admin Master Data Hub or load sample records from the Testing Sandbox."
            />
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Item & Code</th>
                      <th className="py-3 px-4">Unit</th>
                      {displayLocations.map(loc => (
                        <th key={loc.id} className="py-3 px-4 text-right">
                          {loc.name} ({loc.code})
                        </th>
                      ))}
                      {!isScoped && <th className="py-3 px-4 text-right">Total Network Stock</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {items.map(item => {
                      const totalNet = locations.reduce((sum, l) => sum + getBalance(l.id, item.id), 0);

                      return (
                        <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-white flex items-center gap-2">
                              <span>{item.name}</span>
                              {item.is_demo && <Badge variant="warning">Demo</Badge>}
                            </div>
                            {item.code && <span className="text-[10px] text-slate-400 font-mono">{item.code}</span>}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-300">
                            {item.base_unit}
                          </td>
                          {displayLocations.map(loc => {
                            const qty = getBalance(loc.id, item.id);
                            const transit = getInTransit(loc.id, item.id);
                            return (
                              <td key={loc.id} className="py-3 px-4 text-right font-mono font-bold text-emerald-300">
                                <div>{qty} {item.base_unit}</div>
                                {transit > 0 && (
                                  <div className="text-[10px] text-amber-400">+{transit} in transit</div>
                                )}
                              </td>
                            );
                          })}
                          {!isScoped && (
                            <td className="py-3 px-4 text-right font-mono font-bold text-white text-sm bg-slate-950/40">
                              {totalNet} {item.base_unit}
                            </td>
                          )}
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
          <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
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
            options={items.map(i => ({ value: i.id, label: `${i.name} (${i.base_unit})` }))}
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
