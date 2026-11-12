import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { db } from '../../lib/db';
import { wastageRepo } from '../../lib/dal/wastageRepo';
import { inventoryRepo } from '../../lib/dal/inventoryRepo';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Trash2, Plus, AlertTriangle, Coffee, Eye, Edit2, Printer, Lock } from 'lucide-react';
import type { WastageRecord, InventoryItem, Location } from '../../types';

export const WastageManager: React.FC = () => {
  const { locations, currentLocation, accessibleLocations, currentRole, showToast } = useApp();

  const isScoped = currentRole !== 'owner' && currentRole !== 'manager';
  const accessibleLocIds = useMemo(() => accessibleLocations.map(l => l.id), [accessibleLocations]);

  const [records, setRecords] = useState<WastageRecord[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Scoped records: staff strictly sees wastage from their assigned locations
  const scopedRecords = useMemo(() => {
    if (!isScoped) return records;
    return records.filter(r => accessibleLocIds.includes(r.location_id));
  }, [records, isScoped, accessibleLocIds]);

  // Modals & Action State
  const [viewingWastage, setViewingWastage] = useState<WastageRecord | null>(null);
  const [editingWastage, setEditingWastage] = useState<WastageRecord | null>(null);
  const [editWastageQty, setEditWastageQty] = useState<string>('');
  const [editWastageReason, setEditWastageReason] = useState<WastageRecord['reason']>('spoilage');
  const [editWastageNotes, setEditWastageNotes] = useState<string>('');
  const [voidingWastage, setVoidingWastage] = useState<WastageRecord | null>(null);
  const [voidWastageReason, setVoidWastageReason] = useState<string>('');

  // Form state
  const [formItemId, setFormItemId] = useState<string>('');
  const [formLocId, setFormLocId] = useState<string>(currentLocation?.id || 'loc_shah_03');
  const [formQty, setFormQty] = useState<string>('');
  const [formReason, setFormReason] = useState<WastageRecord['reason']>('spoilage');
  const [formNotes, setFormNotes] = useState<string>('');

  const loadData = async () => {
    try {
      const [allRecords, allItems] = await Promise.all([
        wastageRepo.getRecords(),
        inventoryRepo.getItems(),
      ]);
      setRecords(allRecords);
      setItems(allItems);

      if (allItems.length > 0 && !formItemId) {
        setFormItemId(allItems[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
    if (currentLocation) {
      setFormLocId(currentLocation.id);
    }
  }, [currentLocation]);

  const handleSaveWastage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formItemId || !formQty) {
      showToast('Please select item and quantity', 'warning');
      return;
    }

    const item = items.find(i => i.id === formItemId);
    if (!item) return;

    try {
      const qtyNum = parseFloat(formQty);
      const created = await wastageRepo.recordWastage({
        business_id: 'biz_chaatkulture_01',
        location_id: formLocId,
        inventory_item_id: item.id,
        item_name: item.name,
        quantity: qtyNum,
        unit: item.base_unit,
        reason: formReason,
        notes: formNotes.trim(),
        created_by: 'Outlet Staff',
      });

      showToast(`Logged ${qtyNum} ${item.base_unit} ${item.name} under ${formReason.replace('_', ' ')}`, 'success');
      setIsModalOpen(false);
      setFormQty('');
      setFormNotes('');
      await loadData();
    } catch (err) {
      console.error(err);
      showToast('Error recording wastage', 'error');
    }
  };

  const reasonBadges: Record<WastageRecord['reason'], { label: string; variant: 'danger' | 'warning' | 'info' | 'default' }> = {
    spoilage: { label: 'Spoiled / Expired', variant: 'warning' },
    preparation_wastage: { label: 'Kitchen Prep Trimmings', variant: 'default' },
    damage: { label: 'Dropped / Damaged', variant: 'danger' },
    spillage: { label: 'Spillage / Leakage', variant: 'danger' },
    staff_consumption: { label: 'Spoiled Stock', variant: 'default' },
    other: { label: 'Other', variant: 'default' },
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">Stock Wastage & Spoilage Logging</h2>
          <p className="text-xs text-slate-400">
            Log spoiled food, kitchen prep trimmings, damaged stock, and transit losses. Automatically deducts from inventory.
          </p>
        </div>

        <Button variant="danger" size="sm" onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4" />
          <span>+ Log Stock Wastage</span>
        </Button>
      </div>

      {/* Outlet Scoped Warning Banner */}
      {isScoped && (
        <div className="flex items-center gap-2 p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-xs text-amber-300">
          <Lock className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <span className="font-bold">Outlet Scoped Wastage:</span> Displaying wastage logs strictly for{' '}
            <strong className="text-white">
              {accessibleLocations.map(l => `${l.name} (${l.code})`).join(', ')}
            </strong>
            . Wastage from other physical locations is restricted.
          </div>
        </div>
      )}

      {/* Wastage Table or Empty State */}
      {scopedRecords.length === 0 ? (
        <EmptyState
          icon={<Trash2 className="w-8 h-8" />}
          title="No Wastage or Spoilage Logged"
          description="Click '+ Log Stock Wastage' to record discarded or damaged items with automatic movement ledger tracking."
          actionLabel="+ Log First Wastage"
          onAction={() => setIsModalOpen(true)}
        />
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Item</th>
                  <th className="py-3 px-4 text-right">Quantity Deducted</th>
                  <th className="py-3 px-4">Reason Category</th>
                  <th className="py-3 px-4">Notes / Details</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {scopedRecords.map(rec => {
                  const loc = locations.find(l => l.id === rec.location_id);
                  const badgeInfo = reasonBadges[rec.reason] || { label: rec.reason, variant: 'default' };

                  return (
                    <tr key={rec.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                        {new Date(rec.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-200">
                        {loc ? loc.code : rec.location_id}
                      </td>
                      <td className="py-3 px-4 font-bold text-white">
                        {rec.item_name || rec.inventory_item_id}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-400 text-sm">
                        -{rec.quantity} {rec.unit}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={badgeInfo.variant as any} size="sm">
                          {badgeInfo.label}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px] max-w-xs truncate">
                        {rec.notes || '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewingWastage(rec)}
                            title="View Wastage Slip"
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
                                setEditingWastage(rec);
                                setEditWastageQty(rec.quantity.toString());
                                setEditWastageReason(rec.reason);
                                setEditWastageNotes(rec.notes || '');
                              }}
                              title="Edit Wastage Record (Manager & Super Admin)"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                            </Button>
                          )}

                          {currentRole === 'owner' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setVoidingWastage(rec);
                                setVoidWastageReason('');
                              }}
                              title="Void & Restore Stock (Super Admin Only)"
                              className="text-rose-400 hover:text-rose-300"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
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

      {/* Log Wastage Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Log Stock Wastage"
        subtitle="Immediately deducts from location available balance"
        maxWidth="md"
      >
        <form onSubmit={handleSaveWastage} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Location *"
              value={formLocId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormLocId(e.target.value)}
              options={accessibleLocations.map(l => ({ value: l.id, label: `${l.name} (${l.code})` }))}
            />

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Item *</label>
              <Select
                value={formItemId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormItemId(e.target.value)}
                options={items.map(i => ({ value: i.id, label: `${i.name} (${i.base_unit})` }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Quantity to Deduct *"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="e.g. 2.00"
              value={formQty}
              onChange={e => setFormQty(e.target.value)}
              required
            />

            <Select
              label="Wastage Reason *"
              value={formReason}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormReason(e.target.value as any)}
              options={[
                { value: 'spoilage', label: 'Spoiled / Sour / Overripe' },
                { value: 'damage', label: 'Dropped on Floor / Burst Container' },
                { value: 'preparation_wastage', label: 'Prep Trimmings & Peels' },
                { value: 'spillage', label: 'Chutney / Oil Spillage' },
                { value: 'other', label: 'Other Stock Loss' },
              ]}
            />
          </div>

          <Input
            label="Incident Details / Explanation"
            placeholder="e.g. Curd turned sour due to power outage / Gravy dropped"
            value={formNotes}
            onChange={e => setFormNotes(e.target.value)}
          />

          <div className="p-3 bg-amber-950/40 border border-amber-800 rounded-xl text-amber-300 text-xs">
            🛡️ <strong>Ledger Rule:</strong> This write creates an immutable <code>{formReason}</code> entry in the movement ledger and decrements location stock.
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" type="submit">
              Log & Deduct Stock
            </Button>
          </div>
        </form>
      </Modal>

      {/* 1. View Wastage Slip Modal */}
      <Modal
        isOpen={!!viewingWastage}
        onClose={() => setViewingWastage(null)}
        title="Wastage Audit Slip"
        subtitle={`Reference #${viewingWastage?.id}`}
        maxWidth="md"
      >
        {viewingWastage && (
          <div className="space-y-4 text-xs font-mono">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <div>
                  <h3 className="font-bold text-sm text-white">CHAAT KULTURE</h3>
                  <p className="text-[10px] text-slate-400">Inventory Wastage / Consumption Audit</p>
                </div>
                <div className="text-right">
                  <span className="text-rose-400 font-bold block">-{viewingWastage.quantity} {viewingWastage.unit}</span>
                  <span className="text-[10px] text-slate-400">{new Date(viewingWastage.created_at).toLocaleString()}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500 block">LOCATION:</span>
                  <span className="font-bold text-slate-200">{locations.find(l => l.id === viewingWastage.location_id)?.name}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">DISCARDED ITEM:</span>
                  <span className="font-bold text-white">{viewingWastage.item_name || viewingWastage.inventory_item_id}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">REASON:</span>
                  <Badge variant={reasonBadges[viewingWastage.reason]?.variant as any} size="sm">
                    {reasonBadges[viewingWastage.reason]?.label}
                  </Badge>
                </div>
                <div>
                  <span className="text-slate-500 block">RECORDED BY:</span>
                  <span className="text-slate-200">{viewingWastage.created_by || 'Staff'}</span>
                </div>
              </div>

              {viewingWastage.notes && (
                <div className="border-t border-slate-800 pt-2 text-[11px] text-slate-400">
                  <span className="text-slate-500 font-bold">Notes:</span> {viewingWastage.notes}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => window.print()}>
                <Printer className="w-3.5 h-3.5" />
                <span>Print Slip</span>
              </Button>
              <Button variant="primary" size="sm" onClick={() => setViewingWastage(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 2. Edit Wastage Modal */}
      <Modal
        isOpen={!!editingWastage}
        onClose={() => setEditingWastage(null)}
        title="Edit Wastage Record"
        subtitle={`Record ID: ${editingWastage?.id}`}
        maxWidth="md"
      >
        <form
          onSubmit={async e => {
            e.preventDefault();
            if (!editingWastage) return;
            const newQtyNum = parseFloat(editWastageQty);
            if (isNaN(newQtyNum) || newQtyNum <= 0) {
              showToast('Please enter a valid quantity', 'warning');
              return;
            }
            try {
              await wastageRepo.updateWastageRecord(
                editingWastage.id,
                {
                  quantity: newQtyNum,
                  reason: editWastageReason,
                  notes: editWastageNotes.trim(),
                },
                currentRole
              );
              showToast('Updated wastage record. Inventory balance adjusted.', 'success');
              setEditingWastage(null);
              await loadData();
            } catch (err: any) {
              showToast(err.message || 'Error updating wastage', 'error');
            }
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Quantity Deducted *"
              type="number"
              step="0.01"
              value={editWastageQty}
              onChange={e => setEditWastageQty(e.target.value)}
              required
            />
            <Select
              label="Wastage Reason *"
              value={editWastageReason}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditWastageReason(e.target.value as any)}
              options={[
                { value: 'spoilage', label: 'Spoiled / Sour / Overripe' },
                { value: 'damage', label: 'Dropped on Floor / Burst Container' },
                { value: 'preparation_wastage', label: 'Prep Trimmings & Peels' },
                { value: 'spillage', label: 'Chutney / Oil Spillage' },
                { value: 'other', label: 'Other Stock Loss' },
              ]}
            />
          </div>

          <Input
            label="Incident Details / Explanation"
            value={editWastageNotes}
            onChange={e => setEditWastageNotes(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setEditingWastage(null)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* 3. Void Wastage Modal */}
      <Modal
        isOpen={!!voidingWastage}
        onClose={() => setVoidingWastage(null)}
        title="Void Wastage & Restore Stock"
        subtitle={`Record ID: ${voidingWastage?.id}`}
        maxWidth="md"
      >
        <form
          onSubmit={async e => {
            e.preventDefault();
            if (!voidingWastage || !voidWastageReason.trim()) {
              showToast('Please state a reason for voiding', 'warning');
              return;
            }
            try {
              await wastageRepo.deleteWastageRecord(voidingWastage.id, voidWastageReason.trim(), currentRole);
              showToast(`Voided wastage record. +${voidingWastage.quantity} ${voidingWastage.unit} restored to available stock.`, 'success');
              setVoidingWastage(null);
              await loadData();
            } catch (err: any) {
              showToast(err.message || 'Error voiding wastage', 'error');
            }
          }}
          className="space-y-4"
        >
          <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300">
            ⚠️ <strong>Stock Restoration:</strong> Voiding this record will immediately return {voidingWastage?.quantity} {voidingWastage?.unit} back into the location's available stock and log a reversal in the movement ledger.
          </div>

          <Input
            label="Mandatory Reason for Voiding *"
            placeholder="e.g. Logged wrong item by mistake / Stock was recovered"
            value={voidWastageReason}
            onChange={e => setVoidWastageReason(e.target.value)}
            required
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setVoidingWastage(null)}>
              Cancel
            </Button>
            <Button variant="danger" type="submit">
              Confirm Stock Restoration & Void
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
