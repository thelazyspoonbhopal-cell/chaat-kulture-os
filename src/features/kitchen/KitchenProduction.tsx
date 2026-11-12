import React, { useState, useEffect } from 'react';
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
import { ChefHat, Plus, History, Flame, CheckCircle2, Eye, Edit2, Trash2, Printer, Lock } from 'lucide-react';
import type { ProductionRecord, InventoryItem } from '../../types';

export const KitchenProduction: React.FC = () => {
  const { locations, currentRole, accessibleLocations, isLocationAccessible, showToast } = useApp();

  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [preparedItems, setPreparedItems] = useState<InventoryItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Modals & Action State
  const [viewingBatch, setViewingBatch] = useState<ProductionRecord | null>(null);
  const [editingBatch, setEditingBatch] = useState<ProductionRecord | null>(null);
  const [editQty, setEditQty] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [voidingBatch, setVoidingBatch] = useState<ProductionRecord | null>(null);
  const [voidReason, setVoidReason] = useState<string>('');

  // Form state
  const [formItemId, setFormItemId] = useState<string>('');
  const [formLocId, setFormLocId] = useState<string>('loc_base_01');
  const [formQty, setFormQty] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');

  // If user is restricted to a retail outlet only and does not have Base Kitchen assigned
  const canAccessKitchen = isLocationAccessible('loc_base_01') || currentRole === 'owner' || currentRole === 'manager';

  const loadData = async () => {
    try {
      const allItems = await inventoryRepo.getItems();
      // Filter items classified as prepared_food or semi_prepared
      const preps = allItems.filter(i => i.category_type === 'prepared_food' || i.category_type === 'semi_prepared');
      setPreparedItems(preps);

      const allRecords = await productionRepo.getRecords();
      setRecords(allRecords);

      if (preps.length > 0 && !formItemId) {
        setFormItemId(preps[0].id);
      }
    } catch (err) {
      console.error(err);
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
          Your assigned location(s) ({accessibleLocations.map(l => l.name).join(', ')}) do not include Base Kitchen (BASE-01). Kitchen production batches are logged strictly by kitchen staff.
        </p>
      </div>
    );
  }

  const handleSaveProduction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formItemId || !formQty) {
      showToast('Please select prepared item and quantity', 'warning');
      return;
    }

    const item = preparedItems.find(i => i.id === formItemId);
    if (!item) return;

    try {
      const qtyNum = parseFloat(formQty);
      const created = await productionRepo.recordProduction({
        business_id: 'biz_chaatkulture_01',
        location_id: formLocId,
        inventory_item_id: item.id,
        item_name: item.name,
        quantity_produced: qtyNum,
        unit: item.base_unit,
        notes: formNotes.trim(),
        created_by: 'Kitchen Manager',
      });

      showToast(`Batch #${created.batch_number} logged: +${qtyNum} ${item.base_unit} ${item.name}`, 'success');
      setIsModalOpen(false);
      setFormQty('');
      setFormNotes('');
      await loadData();
    } catch (err) {
      console.error(err);
      showToast('Error recording kitchen production', 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">Base Kitchen Batch Production</h2>
          <p className="text-xs text-slate-400">
            Log bulk cooked food (Bhaji, Chole, Papdi, Puris) to directly increment Base Kitchen stock.
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4" />
          <span>+ Log Production Batch</span>
        </Button>
      </div>

      {/* PRD Rule Alert Banner */}
      <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-400 shrink-0" />
          <span>
            <strong>PRD Rule 9:</strong> Production output increases cooked food stock in Base Kitchen. <strong>Raw materials are never auto-consumed via recipes.</strong>
          </span>
        </div>
        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono font-bold">
          Strict Rule
        </span>
      </div>

      {/* Production History Table or Empty State */}
      {records.length === 0 ? (
        <EmptyState
          icon={<ChefHat className="w-8 h-8" />}
          title="No Production Batches Logged Yet"
          description="Click '+ Log Production Batch' to record cooked food batches (Chole, Bhaji, Puris). Ensure prepared food items are configured in the Inventory Master."
          actionLabel="+ Log First Batch"
          onAction={() => setIsModalOpen(true)}
        />
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Batch Number</th>
                  <th className="py-3 px-4">Production Date</th>
                  <th className="py-3 px-4">Prepared Item</th>
                  <th className="py-3 px-4 text-right">Quantity Produced</th>
                  <th className="py-3 px-4">Kitchen Location</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {records.map(rec => (
                  <tr key={rec.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-orange-400">
                      {rec.batch_number}
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {new Date(rec.production_date).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-bold text-white">
                      {rec.item_name || rec.inventory_item_id}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400 text-sm">
                      +{rec.quantity_produced} {rec.unit}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      Base Kitchen (BASE-01)
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px] max-w-xs truncate">
                      {rec.notes || '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewingBatch(rec)}
                          title="View Batch Details & Slip"
                          className="text-orange-400 hover:text-orange-300"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </Button>

                        {(currentRole === 'owner' || currentRole === 'manager') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingBatch(rec);
                              setEditQty(rec.quantity_produced.toString());
                              setEditNotes(rec.notes || '');
                            }}
                            title="Edit Batch Yield / Notes (Manager & Super Admin)"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                          </Button>
                        )}

                        {currentRole === 'owner' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setVoidingBatch(rec);
                              setVoidReason('');
                            }}
                            title="Void & Reverse Batch Stock (Super Admin Only)"
                            className="text-rose-400 hover:text-rose-300"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Production Batch Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Log Kitchen Batch Preparation"
        subtitle="Directly increments available stock at Base Kitchen"
        maxWidth="md"
      >
        <form onSubmit={handleSaveProduction} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Prepared Item *</label>
            {preparedItems.length > 0 ? (
              <Select
                value={formItemId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormItemId(e.target.value)}
                options={preparedItems.map(i => ({ value: i.id, label: `${i.name} (${i.base_unit})` }))}
              />
            ) : (
              <div className="p-3 bg-amber-950/40 border border-amber-800 rounded-xl text-xs text-amber-300">
                No items marked as 'Prepared Food' found in Inventory Master. Please add items like Cooked Bhaji or Chole in Admin Hub first.
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Production Location *"
              value={formLocId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormLocId(e.target.value)}
              options={locations.filter(l => l.type === 'base_kitchen').map(l => ({ value: l.id, label: `${l.name} (${l.code})` }))}
            />

            <Input
              label="Quantity Produced *"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="e.g. 20.00"
              value={formQty}
              onChange={e => setFormQty(e.target.value)}
              required
            />
          </div>

          <Input
            label="Chef / Batch Notes"
            placeholder="e.g. Morning batch 1 prepared by Chef Ram Kumar"
            value={formNotes}
            onChange={e => setFormNotes(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={preparedItems.length === 0}>
              Save Production Record
            </Button>
          </div>
        </form>
      </Modal>

      {/* 1. View Batch Details Modal */}
      <Modal
        isOpen={!!viewingBatch}
        onClose={() => setViewingBatch(null)}
        title="Kitchen Batch Production Slip"
        subtitle={`Batch #${viewingBatch?.batch_number}`}
        maxWidth="md"
      >
        {viewingBatch && (
          <div className="space-y-4 text-xs font-mono">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <div>
                  <h3 className="font-bold text-sm text-white">CHAAT KULTURE</h3>
                  <p className="text-[10px] text-slate-400">Kitchen Batch Production Record</p>
                </div>
                <div className="text-right">
                  <span className="text-orange-400 font-bold block">{viewingBatch.batch_number}</span>
                  <span className="text-[10px] text-slate-400">{new Date(viewingBatch.production_date).toLocaleString()}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500 block">KITCHEN LOCATION:</span>
                  <span className="font-bold text-slate-200">Base Kitchen (BASE-01)</span>
                </div>
                <div>
                  <span className="text-slate-500 block">PREPARED FOOD:</span>
                  <span className="font-bold text-emerald-400">{viewingBatch.item_name || viewingBatch.inventory_item_id}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">BATCH YIELD:</span>
                  <span className="font-bold text-white text-sm">+{viewingBatch.quantity_produced} {viewingBatch.unit}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">RECORDED BY:</span>
                  <span className="text-slate-200">{viewingBatch.created_by || 'Kitchen Manager'}</span>
                </div>
              </div>

              {viewingBatch.notes && (
                <div className="border-t border-slate-800 pt-2 text-[11px] text-slate-400">
                  <span className="text-slate-500 font-bold">Chef Notes:</span> {viewingBatch.notes}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => window.print()}>
                <Printer className="w-3.5 h-3.5" />
                <span>Print Slip</span>
              </Button>
              <Button variant="primary" size="sm" onClick={() => setViewingBatch(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 2. Edit Batch Yield & Notes Modal */}
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
              showToast(`Updated Batch #${editingBatch.batch_number}. Inventory balance adjusted.`, 'success');
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

      {/* 3. Void / Delete Batch Modal */}
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
              showToast(`Voided Batch #${voidingBatch.batch_number}. ${voidingBatch.quantity_produced} ${voidingBatch.unit} reversed from stock.`, 'success');
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
