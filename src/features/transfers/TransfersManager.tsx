import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { transfersRepo } from '../../lib/dal/transfersRepo';
import { inventoryRepo } from '../../lib/dal/inventoryRepo';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  Truck,
  Plus,
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileText,
  Boxes,
  Eye,
  Edit2,
  Trash2,
  Printer,
  XCircle,
  Check,
  RotateCcw,
  Lock,
} from 'lucide-react';
import type { StockRequest, Dispatch, InventoryItem, Location } from '../../types';

export const TransfersManager: React.FC = () => {
  const { locations, currentLocation, accessibleLocations, currentRole, currentUser, showToast } = useApp();

  const [activeTab, setActiveTab] = useState<'indents' | 'dispatches'>('indents');
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

  // Scoping: Outlet Staff and Kitchen Managers only see transactions involving their assigned locations
  const isScoped = currentRole !== 'owner' && currentRole !== 'manager';
  const accessibleLocIds = useMemo(() => accessibleLocations.map(l => l.id), [accessibleLocations]);

  const scopedRequests = useMemo(() => {
    if (!isScoped) return requests;
    return requests.filter(
      req => accessibleLocIds.includes(req.from_location_id) || accessibleLocIds.includes(req.to_location_id)
    );
  }, [requests, isScoped, accessibleLocIds]);

  const scopedDispatches = useMemo(() => {
    if (!isScoped) return dispatches;
    return dispatches.filter(
      dsp => accessibleLocIds.includes(dsp.from_location_id) || accessibleLocIds.includes(dsp.to_location_id)
    );
  }, [dispatches, isScoped, accessibleLocIds]);

  // Item Controls & Modals State
  const [viewingReq, setViewingReq] = useState<StockRequest | null>(null);
  const [editingReq, setEditingReq] = useState<StockRequest | null>(null);
  const [editReqDate, setEditReqDate] = useState<string>('');
  const [editReqType, setEditReqType] = useState<'next_day' | 'same_day_urgent'>('next_day');
  const [editReqNotes, setEditReqNotes] = useState<string>('');
  const [rejectingReq, setRejectingReq] = useState<StockRequest | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [deletingReq, setDeletingReq] = useState<StockRequest | null>(null);
  const [deleteReqReason, setDeleteReqReason] = useState<string>('');

  const [viewingChallan, setViewingChallan] = useState<Dispatch | null>(null);
  const [editingChallan, setEditingChallan] = useState<Dispatch | null>(null);
  const [editChallanVehicle, setEditChallanVehicle] = useState<string>('');
  const [editChallanDriver, setEditChallanDriver] = useState<string>('');
  const [editChallanPhone, setEditChallanPhone] = useState<string>('');
  const [editChallanNotes, setEditChallanNotes] = useState<string>('');
  const [editChallanStatus, setEditChallanStatus] = useState<Dispatch['status']>('in_transit');
  const [editChallanItems, setEditChallanItems] = useState<{ id: string; itemId: string; name: string; qty: string; unit: string }[]>([]);
  const [voidingChallan, setVoidingChallan] = useState<Dispatch | null>(null);
  const [voidChallanReason, setVoidChallanReason] = useState<string>('');
  const [deletingChallan, setDeletingChallan] = useState<Dispatch | null>(null);
  const [deleteChallanReason, setDeleteChallanReason] = useState<string>('');
  const [rejectingChallan, setRejectingChallan] = useState<Dispatch | null>(null);
  const [rejectChallanReason, setRejectChallanReason] = useState<string>('');

  const openEditChallanModal = (dsp: Dispatch) => {
    setEditingChallan(dsp);
    setEditChallanVehicle(dsp.vehicle_number || '');
    setEditChallanDriver(dsp.driver_name || '');
    setEditChallanPhone(dsp.driver_phone || '');
    setEditChallanNotes(dsp.notes || '');
    setEditChallanStatus(dsp.status);
    setEditChallanItems(
      (dsp.items || []).map(it => ({
        id: it.id,
        itemId: it.inventory_item_id,
        name: it.item_name || it.inventory_item_id,
        qty: it.dispatched_quantity.toString(),
        unit: it.unit || 'units',
      }))
    );
  };

  // Create Indent Modal
  const [isIndentModalOpen, setIsIndentModalOpen] = useState<boolean>(false);
  const [indentFromLoc, setIndentFromLoc] = useState<string>('loc_shah_03');
  const [indentToLoc, setIndentToLoc] = useState<string>('loc_base_01');
  const [indentType, setIndentType] = useState<'next_day' | 'same_day_urgent'>('next_day');
  const [indentDate, setIndentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [indentLines, setIndentLines] = useState<{ itemId: string; qty: string }[]>([
    { itemId: '', qty: '' },
  ]);
  const [indentNotes, setIndentNotes] = useState<string>('');

  // Create Dispatch Modal
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState<boolean>(false);
  const [dispatchSourceLoc, setDispatchSourceLoc] = useState<string>('loc_base_01');
  const [dispatchDestLoc, setDispatchDestLoc] = useState<string>('loc_shah_03');
  const [dispatchLinkedReqId, setDispatchLinkedReqId] = useState<string>('');
  const [dispatchLines, setDispatchLines] = useState<{ itemId: string; qty: string }[]>([
    { itemId: '', qty: '' },
  ]);
  const [dispatchNotes, setDispatchNotes] = useState<string>('');

  // Receive Inspection Modal
  const [receivingDispatch, setReceivingDispatch] = useState<Dispatch | null>(null);
  const [receiveInspectionLines, setReceiveInspectionLines] = useState<
    { itemId: string; dispatchedQty: number; receivedQty: string; damagedQty: string; reason: string }[]
  >([]);

  const loadData = async () => {
    try {
      const [reqs, dsps, items] = await Promise.all([
        transfersRepo.getStockRequests(),
        transfersRepo.getDispatches(),
        inventoryRepo.getItems(),
      ]);
      setRequests(reqs);
      setDispatches(dsps);
      setInventoryItems(items);

      if (items.length > 0 && !indentLines[0].itemId) {
        setIndentLines([{ itemId: items[0].id, qty: '10' }]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentLocation]);

  // Handle Indent Submission
  const handleSaveIndent = async (e: React.FormEvent) => {
    e.preventDefault();
    const validLines = indentLines.filter(l => l.itemId && parseFloat(l.qty) > 0);
    if (validLines.length === 0) {
      showToast('Please specify at least one item and quantity', 'warning');
      return;
    }

    try {
      const created = await transfersRepo.createStockRequest({
        business_id: 'biz_chaatkulture_01',
        from_location_id: indentFromLoc,
        to_location_id: indentToLoc,
        request_type: indentType,
        required_date: indentDate,
        notes: indentNotes.trim(),
        created_by: 'Outlet Staff',
        items: validLines.map(l => {
          const itm = inventoryItems.find(i => i.id === l.itemId);
          return {
            inventory_item_id: l.itemId,
            item_name: itm?.name,
            requested_quantity: parseFloat(l.qty),
            unit: itm?.base_unit || 'unit',
          };
        }),
      });

      showToast(`Stock indent #${created.request_number} submitted to Kitchen`, 'success');
      setIsIndentModalOpen(false);
      await loadData();
    } catch (err) {
      console.error(err);
      showToast('Error submitting stock request', 'error');
    }
  };

  // Handle Dispatch Challan Creation
  const handleSaveDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const validLines = dispatchLines.filter(l => l.itemId && parseFloat(l.qty) > 0);
    if (validLines.length === 0) {
      showToast('Please specify at least one dispatch line item', 'warning');
      return;
    }

    try {
      const created = await transfersRepo.createDispatch({
        business_id: 'biz_chaatkulture_01',
        from_location_id: dispatchSourceLoc,
        to_location_id: dispatchDestLoc,
        stock_request_id: dispatchLinkedReqId || undefined,
        notes: dispatchNotes.trim(),
        dispatched_by: 'Kitchen Manager',
        items: validLines.map(l => {
          const itm = inventoryItems.find(i => i.id === l.itemId);
          return {
            inventory_item_id: l.itemId,
            item_name: itm?.name,
            requested_quantity: parseFloat(l.qty),
            dispatched_quantity: parseFloat(l.qty),
            unit: itm?.base_unit || 'unit',
          };
        }),
      });

      showToast(`Challan #${created.challan_number} dispatched! Marked in-transit.`, 'success');
      setIsDispatchModalOpen(false);
      await loadData();
    } catch (err) {
      console.error(err);
      showToast('Error creating dispatch challan', 'error');
    }
  };

  // Handle Receiving Inspection Confirmation
  const openReceiveModal = (dsp: Dispatch) => {
    setReceivingDispatch(dsp);
    setReceiveInspectionLines(
      (dsp.items || []).map(i => ({
        itemId: i.inventory_item_id,
        dispatchedQty: i.dispatched_quantity,
        receivedQty: i.dispatched_quantity.toString(), // default to full received
        damagedQty: '0',
        reason: '',
      }))
    );
  };

  const handleConfirmReceiving = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingDispatch) return;

    try {
      await transfersRepo.confirmReceiving(
        receivingDispatch.id,
        receiveInspectionLines.map(l => ({
          inventory_item_id: l.itemId,
          received_quantity: parseFloat(l.receivedQty) || 0,
          damaged_or_missing_quantity: parseFloat(l.damagedQty) || 0,
          discrepancy_reason: l.reason.trim() || undefined,
        })),
        'Outlet Receiving Cashier'
      );

      showToast(`Challan #${receivingDispatch.challan_number} received & stock updated!`, 'success');
      setReceivingDispatch(null);
      await loadData();
    } catch (err) {
      console.error(err);
      showToast('Error confirming receiving', 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">Inter-Location Transfers & Indents</h2>
          <p className="text-xs text-slate-400">
            Outlet indents, kitchen dispatch challans, and destination receiving verification with discrepancy tracking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setIsIndentModalOpen(true)}>
            <Plus className="w-3.5 h-3.5" />
            <span>+ Create Stock Indent</span>
          </Button>

          <Button variant="primary" size="sm" onClick={() => setIsDispatchModalOpen(true)}>
            <Send className="w-3.5 h-3.5" />
            <span>+ Dispatch Challan</span>
          </Button>
        </div>
      </div>

      {/* Outlet Scoped Warning Banner */}
      {isScoped && (
        <div className="flex items-center gap-2 p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-xs text-amber-300">
          <Lock className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <span className="font-bold">Outlet Scoped Visibility:</span> You are viewing transfer indents and dispatch
            challans exclusively for{' '}
            <strong className="text-white">
              {accessibleLocations.map(l => `${l.name} (${l.code})`).join(', ')}
            </strong>
            . Records from unassigned outlets are strictly isolated.
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold w-fit">
        <button
          onClick={() => setActiveTab('indents')}
          className={`px-4 py-1.5 rounded-lg transition-all ${
            activeTab === 'indents' ? 'bg-orange-600 text-white font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          Outlet Indents ({scopedRequests.length})
        </button>
        <button
          onClick={() => setActiveTab('dispatches')}
          className={`px-4 py-1.5 rounded-lg transition-all ${
            activeTab === 'dispatches' ? 'bg-orange-600 text-white font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          Dispatch Challans ({scopedDispatches.length})
        </button>
      </div>

      {/* TAB 1: Stock Indents */}
      {activeTab === 'indents' && (
        <div>
          {scopedRequests.length === 0 ? (
            <EmptyState
              icon={<Truck className="w-8 h-8" />}
              title="No Stock Indents Logged"
              description="Outlets submit daily or urgent stock indents to the Base Kitchen or Central Store. Click '+ Create Stock Indent' to test."
              actionLabel="+ Create First Indent"
              onAction={() => setIsIndentModalOpen(true)}
            />
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Request #</th>
                      <th className="py-3 px-4">Type & Required Date</th>
                      <th className="py-3 px-4">From Outlet</th>
                      <th className="py-3 px-4">To Location</th>
                      <th className="py-3 px-4">Requested Items</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {scopedRequests.map(req => {
                      const fromLoc = locations.find(l => l.id === req.from_location_id);
                      const toLoc = locations.find(l => l.id === req.to_location_id);

                      return (
                        <tr key={req.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-orange-400">
                            {req.request_number}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-white block">{req.required_date}</span>
                            <span className="text-[10px] text-slate-400 uppercase font-mono">
                              {req.request_type.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-200">
                            {fromLoc ? fromLoc.name : req.from_location_id}
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            {toLoc ? toLoc.name : req.to_location_id}
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            <div className="space-y-0.5">
                              {req.items?.map(it => (
                                <div key={it.id} className="font-mono text-[11px]">
                                  • {it.requested_quantity} {it.unit} {it.item_name}
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge
                              variant={
                                req.status === 'received'
                                  ? 'success'
                                  : req.status === 'dispatched'
                                  ? 'warning'
                                  : req.status === 'rejected'
                                  ? 'danger'
                                  : 'info'
                              }
                              size="sm"
                            >
                              {req.status.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setViewingReq(req)}
                                title="View Indent Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>View</span>
                              </Button>

                              {req.status === 'submitted' && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={async () => {
                                      await transfersRepo.updateStockRequestStatus(req.id, 'approved', undefined, currentRole);
                                      showToast(`Approved Indent #${req.request_number}`, 'success');
                                      await loadData();
                                    }}
                                    className="text-emerald-400 hover:text-emerald-300"
                                    title="Approve Indent"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Approve</span>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setRejectingReq(req);
                                      setRejectReason('');
                                    }}
                                    className="text-rose-400 hover:text-rose-300"
                                    title="Reject Indent"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span>Reject</span>
                                  </Button>
                                </>
                              )}

                              {(req.status === 'submitted' || req.status === 'draft') && (currentRole === 'owner' || currentRole === 'manager') && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingReq(req);
                                    setEditReqDate(req.required_date);
                                    setEditReqType(req.request_type);
                                    setEditReqNotes(req.notes || '');
                                  }}
                                  className="text-amber-400 hover:text-amber-300 font-semibold bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30"
                                  title="Edit Indent (Manager & Super Admin)"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                  <span>Edit</span>
                                </Button>
                              )}

                              {currentRole === 'owner' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setDeletingReq(req);
                                    setDeleteReqReason('');
                                  }}
                                  title="Delete Indent"
                                  className="text-rose-500 hover:text-rose-400"
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
        </div>
      )}

      {/* TAB 2: Dispatch Challans */}
      {activeTab === 'dispatches' && (
        <div>
          {scopedDispatches.length === 0 ? (
            <EmptyState
              icon={<Truck className="w-8 h-8" />}
              title="No Dispatch Challans"
              description="Base Kitchen or Central Store creates dispatch challans against outlet requests. Stock enters in-transit until confirmed received."
              actionLabel="+ Create Dispatch Challan"
              onAction={() => setIsDispatchModalOpen(true)}
            />
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Challan #</th>
                      <th className="py-3 px-4">Dispatch Date</th>
                      <th className="py-3 px-4">Source → Destination</th>
                      <th className="py-3 px-4">Dispatched Items</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions & Verification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {scopedDispatches.map(dsp => {
                      const fromLoc = locations.find(l => l.id === dsp.from_location_id);
                      const toLoc = locations.find(l => l.id === dsp.to_location_id);

                      return (
                        <tr key={dsp.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-orange-400">
                            {dsp.challan_number}
                          </td>
                          <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                            {new Date(dsp.dispatch_date).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-slate-200">
                            <span className="font-semibold">{fromLoc ? fromLoc.code : dsp.from_location_id}</span>
                            <span className="text-slate-500 mx-1.5">→</span>
                            <span className="font-semibold text-emerald-400">{toLoc ? toLoc.code : dsp.to_location_id}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            <div className="space-y-0.5">
                              {dsp.items?.map(it => (
                                <div key={it.id} className="font-mono text-[11px]">
                                  • {it.dispatched_quantity} {it.unit} {it.item_name}{' '}
                                  {dsp.status === 'received' && (
                                    <span className="text-emerald-400 font-bold">(Recv: {it.received_quantity})</span>
                                  )}
                                  {it.damaged_or_missing_quantity > 0 && (
                                    <span className="text-rose-400 font-bold">(Damaged: {it.damaged_or_missing_quantity})</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge
                              variant={
                                dsp.status === 'received' || dsp.status === 'delivered'
                                  ? 'success'
                                  : dsp.status === 'discrepancy' || dsp.status === 'rejected'
                                  ? 'danger'
                                  : dsp.status === 'cancelled'
                                  ? 'default'
                                  : dsp.status === 'raised'
                                  ? 'info'
                                  : 'warning'
                              }
                              size="sm"
                            >
                              {dsp.status === 'in_transit'
                                ? '🚚 SENT / EN ROUTE'
                                : dsp.status === 'sent'
                                ? '🚚 SENT'
                                : dsp.status === 'delivered'
                                ? '✓ DELIVERED'
                                : dsp.status.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setViewingChallan(dsp)}
                                title="View Delivery Challan Slip"
                                className="text-orange-400 hover:text-orange-300"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Slip</span>
                              </Button>

                              {/* All roles can Approve or Reject raised challans */}
                              {dsp.status === 'raised' && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={async () => {
                                      await transfersRepo.updateDispatchStatus(dsp.id, 'approved', undefined, currentRole);
                                      showToast(`Approved Challan #${dsp.challan_number}`, 'success');
                                      await loadData();
                                    }}
                                    className="text-emerald-400 hover:text-emerald-300"
                                    title="Approve Challan"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Approve</span>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setRejectingChallan(dsp);
                                      setRejectChallanReason('');
                                    }}
                                    className="text-rose-400 hover:text-rose-300"
                                    title="Reject Challan"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span>Reject</span>
                                  </Button>
                                </>
                              )}

                              {/* All roles can mark approved challans as Sent / Dispatch */}
                              {dsp.status === 'approved' && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={async () => {
                                    await transfersRepo.updateDispatchStatus(dsp.id, 'sent', undefined, currentRole);
                                    showToast(`Challan #${dsp.challan_number} marked as Sent / En Route`, 'success');
                                    await loadData();
                                  }}
                                  title="Mark as Sent / Dispatch from Kitchen"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                  <span>Mark Sent</span>
                                </Button>
                              )}

                              {/* All roles can mark as Delivered / Received at destination */}
                              {(dsp.status === 'in_transit' || dsp.status === 'sent') && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => openReceiveModal(dsp)}
                                  title="Mark as Delivered & Inward Stock"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Receive</span>
                                </Button>
                              )}

                              {/* ONLY Manager & Super Admin can Edit Challan */}
                              {(currentRole === 'owner' || currentRole === 'manager') && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditChallanModal(dsp)}
                                  className="text-amber-400 hover:text-amber-300 font-semibold bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30"
                                  title="Edit Challan (Manager & Super Admin)"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                  <span>Edit</span>
                                </Button>
                              )}

                              {/* ONLY Super Admin can Void / Delete */}
                              {currentRole === 'owner' && (
                                <>
                                  {(dsp.status === 'in_transit' || dsp.status === 'sent') && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setVoidingChallan(dsp);
                                        setVoidChallanReason('');
                                      }}
                                      title="Void & Reverse Stock (Super Admin)"
                                      className="text-rose-400 hover:text-rose-300"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                      <span>Void</span>
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setDeletingChallan(dsp);
                                      setDeleteChallanReason('');
                                    }}
                                    title="Delete Challan (Super Admin Only)"
                                    className="text-rose-500 hover:text-rose-400"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </>
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
        </div>
      )}

      {/* Create Stock Indent Modal */}
      <Modal
        isOpen={isIndentModalOpen}
        onClose={() => setIsIndentModalOpen(false)}
        title="Submit Stock Indent (Outlet Request)"
        subtitle="Request cooked food or packaging from Base Kitchen or Central Store"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveIndent} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Requesting Outlet *"
              value={indentFromLoc}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setIndentFromLoc(e.target.value)}
              options={(isScoped ? accessibleLocations : locations)
                .filter(l => l.type === 'outlet')
                .map(l => ({ value: l.id, label: `${l.name} (${l.code})` }))}
            />

            <Select
              label="Fulfilling Location *"
              value={indentToLoc}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setIndentToLoc(e.target.value)}
              options={[
                ...locations.filter(l => l.type === 'base_kitchen').map(l => ({ value: l.id, label: `🍳 ${l.name} (Cooked Food)` })),
                ...locations.filter(l => l.type === 'store_room').map(l => ({ value: l.id, label: `📦 ${l.name} (Packaging/Raw)` })),
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Priority / Schedule *"
              value={indentType}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setIndentType(e.target.value as any)}
              options={[
                { value: 'next_day', label: 'Next-Day Morning Delivery' },
                { value: 'same_day_urgent', label: 'Same-Day Urgent Refill' },
              ]}
            />

            <Input
              label="Required Date *"
              type="date"
              value={indentDate}
              onChange={e => setIndentDate(e.target.value)}
              required
            />
          </div>

          {/* Indent Lines */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">Items Requested *</label>
            {indentLines.map((line, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <div className="flex-1">
                  <Select
                    value={line.itemId}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                      const updated = [...indentLines];
                      updated[idx].itemId = e.target.value;
                      setIndentLines(updated);
                    }}
                    options={inventoryItems.map(i => ({ value: i.id, label: `${i.name} (${i.base_unit})` }))}
                  />
                </div>
                <div className="w-28">
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="Qty"
                    value={line.qty}
                    onChange={e => {
                      const updated = [...indentLines];
                      updated[idx].qty = e.target.value;
                      setIndentLines(updated);
                    }}
                    required
                  />
                </div>
                {indentLines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setIndentLines(prev => prev.filter((_, i) => i !== idx))}
                    className="p-2 text-slate-500 hover:text-rose-400"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={() => setIndentLines(prev => [...prev, { itemId: inventoryItems[0]?.id || '', qty: '10' }])}
              className="text-xs text-orange-400 hover:text-orange-300 font-semibold"
            >
              + Add Another Item
            </button>
          </div>

          <Input
            label="Special Delivery Notes"
            placeholder="e.g. Expected busy evening; please pack in 5kg air-tight tubs"
            value={indentNotes}
            onChange={e => setIndentNotes(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setIsIndentModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Submit Indent to Kitchen
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Dispatch Challan Modal */}
      <Modal
        isOpen={isDispatchModalOpen}
        onClose={() => setIsDispatchModalOpen(false)}
        title="Create Dispatch Challan"
        subtitle="Generates delivery challan and moves stock into in-transit state"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveDispatch} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Source Location *"
              value={dispatchSourceLoc}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDispatchSourceLoc(e.target.value)}
              options={locations.filter(l => l.type === 'base_kitchen' || l.type === 'store_room').map(l => ({ value: l.id, label: `${l.name} (${l.code})` }))}
            />

            <Select
              label="Destination Outlet *"
              value={dispatchDestLoc}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDispatchDestLoc(e.target.value)}
              options={locations.filter(l => l.type === 'outlet').map(l => ({ value: l.id, label: `${l.name} (${l.code})` }))}
            />
          </div>

          {/* Line items to dispatch */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">Items Dispatched *</label>
            {dispatchLines.map((line, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <div className="flex-1">
                  <Select
                    value={line.itemId}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                      const updated = [...dispatchLines];
                      updated[idx].itemId = e.target.value;
                      setDispatchLines(updated);
                    }}
                    options={inventoryItems.map(i => ({ value: i.id, label: `${i.name} (${i.base_unit})` }))}
                  />
                </div>
                <div className="w-28">
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="Qty"
                    value={line.qty}
                    onChange={e => {
                      const updated = [...dispatchLines];
                      updated[idx].qty = e.target.value;
                      setDispatchLines(updated);
                    }}
                    required
                  />
                </div>
                {dispatchLines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setDispatchLines(prev => prev.filter((_, i) => i !== idx))}
                    className="p-2 text-slate-500 hover:text-rose-400"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={() => setDispatchLines(prev => [...prev, { itemId: inventoryItems[0]?.id || '', qty: '10' }])}
              className="text-xs text-orange-400 hover:text-orange-300 font-semibold"
            >
              + Add Item to Challan
            </button>
          </div>

          <Input
            label="Driver / Van / Challan Notes"
            placeholder="e.g. Van MP-04-AB-1234, Driver Ramesh"
            value={dispatchNotes}
            onChange={e => setDispatchNotes(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setIsDispatchModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Dispatch Challan (Mark In-Transit)
            </Button>
          </div>
        </form>
      </Modal>

      {/* Verify & Receive Modal */}
      <Modal
        isOpen={!!receivingDispatch}
        onClose={() => setReceivingDispatch(null)}
        title="Outlet Receiving & Discrepancy Inspection"
        subtitle={`Challan #${receivingDispatch?.challan_number}`}
        maxWidth="lg"
      >
        {receivingDispatch && (
          <form onSubmit={handleConfirmReceiving} className="space-y-4">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1">
              <div className="text-slate-300">
                Driver notes: <strong>{receivingDispatch.notes || 'None'}</strong>
              </div>
              <div className="text-amber-400 text-[11px]">
                Inspect items physically before confirming. Damaged or leaked containers should be entered under damaged/missing.
              </div>
            </div>

            <div className="space-y-3">
              {receiveInspectionLines.map((line, idx) => {
                const item = inventoryItems.find(i => i.id === line.itemId);
                return (
                  <div key={line.itemId} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-white">{item?.name}</span>
                      <span className="font-mono text-slate-400">
                        Dispatched: <strong>{line.dispatchedQty} {item?.base_unit}</strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Actual Good Qty Received"
                        type="number"
                        step="0.1"
                        value={line.receivedQty}
                        onChange={e => {
                          const updated = [...receiveInspectionLines];
                          updated[idx].receivedQty = e.target.value;
                          setReceiveInspectionLines(updated);
                        }}
                        required
                      />

                      <Input
                        label="Damaged / Leaked / Missing Qty"
                        type="number"
                        step="0.1"
                        value={line.damagedQty}
                        onChange={e => {
                          const updated = [...receiveInspectionLines];
                          updated[idx].damagedQty = e.target.value;
                          setReceiveInspectionLines(updated);
                        }}
                      />
                    </div>

                    {parseFloat(line.damagedQty) > 0 && (
                      <Input
                        label="Discrepancy Reason *"
                        placeholder="e.g. Lid burst during transport / Gravy leaked"
                        value={line.reason}
                        onChange={e => {
                          const updated = [...receiveInspectionLines];
                          updated[idx].reason = e.target.value;
                          setReceiveInspectionLines(updated);
                        }}
                        required
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button variant="secondary" type="button" onClick={() => setReceivingDispatch(null)}>
                Cancel
              </Button>
              <Button variant="success" type="submit">
                Confirm Receipt & Inward Stock
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* 1. Viewing Challan Delivery Slip Modal */}
      <Modal
        isOpen={!!viewingChallan}
        onClose={() => setViewingChallan(null)}
        title="Delivery Challan Slip"
        subtitle={`Challan #${viewingChallan?.challan_number}`}
        maxWidth="lg"
      >
        {viewingChallan && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3 font-mono">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <div>
                  <h3 className="font-bold text-sm text-white">CHAAT KULTURE</h3>
                  <p className="text-[10px] text-slate-400">Inter-Location Stock Transfer Slip</p>
                </div>
                <div className="text-right">
                  <span className="text-orange-400 font-bold block">{viewingChallan.challan_number}</span>
                  <span className="text-[10px] text-slate-400">{new Date(viewingChallan.dispatch_date).toLocaleString()}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500 block">SOURCE LOCATION:</span>
                  <span className="font-bold text-slate-200">
                    {locations.find(l => l.id === viewingChallan.from_location_id)?.name || viewingChallan.from_location_id}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">DESTINATION OUTLET:</span>
                  <span className="font-bold text-emerald-400">
                    {locations.find(l => l.id === viewingChallan.to_location_id)?.name || viewingChallan.to_location_id}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">STATUS:</span>
                  <span className="font-bold uppercase text-white">{viewingChallan.status.replace('_', ' ')}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">DISPATCHED BY:</span>
                  <span className="text-slate-200">{viewingChallan.dispatched_by || 'Kitchen Manager'}</span>
                </div>
                {(viewingChallan.vehicle_number || viewingChallan.driver_name) && (
                  <>
                    <div>
                      <span className="text-slate-500 block">VEHICLE NUMBER:</span>
                      <span className="text-slate-200 font-bold">{viewingChallan.vehicle_number || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">DRIVER / CONTACT:</span>
                      <span className="text-slate-200">
                        {viewingChallan.driver_name || 'N/A'} {viewingChallan.driver_phone ? `(${viewingChallan.driver_phone})` : ''}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="border-t border-slate-800 pt-2">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-1">Item Description</th>
                      <th className="py-1 text-right">Dispatched</th>
                      <th className="py-1 text-right">Received</th>
                      <th className="py-1 text-right">Damaged</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {viewingChallan.items?.map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-1 text-slate-200">{it.item_name || it.inventory_item_id}</td>
                        <td className="py-1 text-right font-bold text-white">{it.dispatched_quantity} {it.unit}</td>
                        <td className="py-1 text-right text-emerald-400">{it.received_quantity || 0} {it.unit}</td>
                        <td className="py-1 text-right text-rose-400">{it.damaged_or_missing_quantity || 0} {it.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {viewingChallan.notes && (
                <div className="border-t border-slate-800 pt-2 text-[11px] text-slate-400">
                  <span className="text-slate-500 font-bold">Notes:</span> {viewingChallan.notes}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => window.print()}>
                <Printer className="w-3.5 h-3.5" />
                <span>Print Slip</span>
              </Button>
              <Button variant="primary" size="sm" onClick={() => setViewingChallan(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 2. Editing Challan Modal */}
      <Modal
        isOpen={!!editingChallan}
        onClose={() => setEditingChallan(null)}
        title="Edit Delivery Challan Details"
        subtitle={`Challan #${editingChallan?.challan_number} • Role: ${currentRole === 'owner' ? 'Super Admin' : 'Manager'}`}
        maxWidth="lg"
      >
        <form
          onSubmit={async e => {
            e.preventDefault();
            if (!editingChallan) return;
            try {
              const updatedItems = editingChallan.items?.map((it, idx) => {
                const line = editChallanItems[idx];
                return {
                  ...it,
                  dispatched_quantity: line ? parseFloat(line.qty) || 0 : it.dispatched_quantity,
                };
              });

              await transfersRepo.updateDispatch(
                editingChallan.id,
                {
                  status: editChallanStatus,
                  vehicle_number: editChallanVehicle.trim() || undefined,
                  driver_name: editChallanDriver.trim() || undefined,
                  driver_phone: editChallanPhone.trim() || undefined,
                  notes: editChallanNotes.trim() || undefined,
                  items: updatedItems,
                },
                currentRole
              );
              showToast(`Updated Challan #${editingChallan.challan_number}`, 'success');
              setEditingChallan(null);
              await loadData();
            } catch (err: any) {
              showToast(err.message || 'Error updating challan', 'error');
            }
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Challan Status *"
              value={editChallanStatus}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditChallanStatus(e.target.value as any)}
              options={[
                { value: 'raised', label: 'Raised / Pending Approval' },
                { value: 'approved', label: 'Approved (Ready to Dispatch)' },
                { value: 'sent', label: 'Sent / Dispatched' },
                { value: 'in_transit', label: 'In Transit' },
                { value: 'delivered', label: 'Delivered (At Destination)' },
                { value: 'received', label: 'Received & Verified' },
                { value: 'rejected', label: 'Rejected' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
            />
            <Input
              label="Vehicle Registration Number"
              placeholder="e.g. MP-04-AB-1234"
              value={editChallanVehicle}
              onChange={e => setEditChallanVehicle(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Driver / Transporter Name"
              placeholder="e.g. Ramesh Singh"
              value={editChallanDriver}
              onChange={e => setEditChallanDriver(e.target.value)}
            />
            <Input
              label="Driver Contact Phone"
              placeholder="e.g. 9876543210"
              value={editChallanPhone}
              onChange={e => setEditChallanPhone(e.target.value)}
            />
          </div>

          {/* Dispatched Line Items Quantity Override */}
          {editChallanItems.length > 0 && (
            <div className="border border-slate-800 rounded-xl p-3 bg-slate-950/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Dispatched Line Items ({editChallanItems.length})</span>
                <span className="text-[10px] text-amber-400 font-mono">Manager / Admin Quantity Edit</span>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {editChallanItems.map((item, idx) => (
                  <div key={item.id || idx} className="flex items-center justify-between gap-3 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-white truncate">{item.name}</div>
                      <div className="text-[10px] text-slate-400">Unit: {item.unit}</div>
                    </div>
                    <div className="w-36 flex items-center gap-1.5">
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={item.qty}
                        onChange={e => {
                          const val = e.target.value;
                          setEditChallanItems(prev => prev.map((p, i) => i === idx ? { ...p, qty: val } : p));
                        }}
                        placeholder="0"
                      />
                      <span className="text-[11px] text-slate-400 font-mono w-10 shrink-0">{item.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Dispatch Remarks / Instructions</label>
            <textarea
              value={editChallanNotes}
              onChange={e => setEditChallanNotes(e.target.value)}
              rows={2}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-800">
            <span className="text-[11px] text-amber-400/80">
              Role: <strong>{currentRole === 'owner' ? 'Super Admin' : 'Manager'}</strong> (Authorized to Edit)
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" type="button" onClick={() => setEditingChallan(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Save Changes
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* 3. Voiding Challan Modal */}
      <Modal
        isOpen={!!voidingChallan}
        onClose={() => setVoidingChallan(null)}
        title="Void Delivery Challan"
        subtitle={`Challan #${voidingChallan?.challan_number}`}
        maxWidth="md"
      >
        <form
          onSubmit={async e => {
            e.preventDefault();
            if (!voidingChallan || !voidChallanReason.trim()) {
              showToast('Please state a reason for voiding', 'warning');
              return;
            }
            try {
              await transfersRepo.voidDispatch(voidingChallan.id, voidChallanReason.trim(), currentRole);
              showToast(`Voided Challan #${voidingChallan.challan_number}. Stock returned to source location.`, 'success');
              setVoidingChallan(null);
              await loadData();
            } catch (err: any) {
              showToast(err.message || 'Error voiding challan', 'error');
            }
          }}
          className="space-y-4"
        >
          <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300">
            ⚠️ <strong>Atomic Stock Reversal:</strong> Voiding this in-transit challan will instantly deduct in-transit stock from the destination outlet and restore all {voidingChallan?.items?.length || 0} item quantities back to the source location's available stock. An immutable reversal entry will be recorded in the movement ledger.
          </div>
          <Input
            label="Mandatory Reason for Voiding *"
            placeholder="e.g. Delivery vehicle breakdown / Wrong items loaded"
            value={voidChallanReason}
            onChange={e => setVoidChallanReason(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setVoidingChallan(null)}>
              Cancel
            </Button>
            <Button variant="danger" type="submit">
              Confirm Stock Reversal & Void
            </Button>
          </div>
        </form>
      </Modal>

      {/* 4. Deleting Challan Modal */}
      <Modal
        isOpen={!!deletingChallan}
        onClose={() => setDeletingChallan(null)}
        title="Super Admin: Delete Challan"
        subtitle={`Challan #${deletingChallan?.challan_number}`}
        maxWidth="md"
      >
        <form
          onSubmit={async e => {
            e.preventDefault();
            if (!deletingChallan || !deleteChallanReason.trim()) {
              showToast('Please provide a reason for deletion', 'warning');
              return;
            }
            try {
              await transfersRepo.deleteDispatch(deletingChallan.id, deleteChallanReason.trim(), currentRole);
              showToast(`Deleted Challan #${deletingChallan.challan_number}`, 'success');
              setDeletingChallan(null);
              await loadData();
            } catch (err: any) {
              showToast(err.message || 'Error deleting challan', 'error');
            }
          }}
          className="space-y-4"
        >
          <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-xs text-amber-300">
            ⚠️ <strong>Admin Override:</strong> If this challan is still in transit, its stock balances will be rolled back safely before deletion.
          </div>
          <Input
            label="Audit Reason for Record Deletion *"
            placeholder="e.g. Duplicate demo entry cleanup"
            value={deleteChallanReason}
            onChange={e => setDeleteChallanReason(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setDeletingChallan(null)}>
              Cancel
            </Button>
            <Button variant="danger" type="submit">
              Delete Record
            </Button>
          </div>
        </form>
      </Modal>

      {/* 4b. Rejecting Challan Modal */}
      <Modal
        isOpen={!!rejectingChallan}
        onClose={() => setRejectingChallan(null)}
        title="Reject Delivery Challan"
        subtitle={`Challan #${rejectingChallan?.challan_number}`}
        maxWidth="md"
      >
        <form
          onSubmit={async e => {
            e.preventDefault();
            if (!rejectingChallan || !rejectChallanReason.trim()) {
              showToast('Please state a reason for rejection', 'warning');
              return;
            }
            try {
              await transfersRepo.updateDispatchStatus(rejectingChallan.id, 'rejected', rejectChallanReason.trim(), currentRole);
              showToast(`Rejected Challan #${rejectingChallan.challan_number}`, 'info');
              setRejectingChallan(null);
              await loadData();
            } catch (err: any) {
              showToast(err.message || 'Error rejecting challan', 'error');
            }
          }}
          className="space-y-4"
        >
          <Input
            label="Reason for Rejection *"
            placeholder="e.g. Incomplete batch dispatch / Packaging damaged before leaving kitchen"
            value={rejectChallanReason}
            onChange={e => setRejectChallanReason(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setRejectingChallan(null)}>
              Cancel
            </Button>
            <Button variant="danger" type="submit">
              Confirm Rejection
            </Button>
          </div>
        </form>
      </Modal>

      {/* 5. Viewing Indent Modal */}
      <Modal
        isOpen={!!viewingReq}
        onClose={() => setViewingReq(null)}
        title="Stock Indent Slip"
        subtitle={`Request #${viewingReq?.request_number}`}
        maxWidth="md"
      >
        {viewingReq && (
          <div className="space-y-4 text-xs font-mono">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="font-bold text-white">{viewingReq.request_number}</span>
                <Badge variant="info" size="sm">{viewingReq.status.toUpperCase()}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500 block">OUTLET:</span>
                  <span className="text-white font-bold">{locations.find(l => l.id === viewingReq.from_location_id)?.name}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">FULFILLING:</span>
                  <span className="text-emerald-400 font-bold">{locations.find(l => l.id === viewingReq.to_location_id)?.name}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">REQUIRED DATE:</span>
                  <span className="text-white font-bold">{viewingReq.required_date}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">URGENCY:</span>
                  <span className="text-slate-300 uppercase">{viewingReq.request_type.replace('_', ' ')}</span>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-2">
                <span className="text-slate-400 font-bold block mb-1">Requested Items:</span>
                <div className="space-y-1">
                  {viewingReq.items?.map((it, idx) => (
                    <div key={idx} className="flex justify-between text-[11px]">
                      <span className="text-slate-300">• {it.item_name || it.inventory_item_id}</span>
                      <span className="font-bold text-white">{it.requested_quantity} {it.unit}</span>
                    </div>
                  ))}
                </div>
              </div>

              {viewingReq.notes && (
                <div className="border-t border-slate-800 pt-2 text-slate-400 text-[11px]">
                  <span className="text-slate-500 font-bold">Notes:</span> {viewingReq.notes}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="primary" size="sm" onClick={() => setViewingReq(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 6. Editing Indent Modal */}
      <Modal
        isOpen={!!editingReq}
        onClose={() => setEditingReq(null)}
        title="Edit Stock Indent"
        subtitle={`Request #${editingReq?.request_number}`}
        maxWidth="md"
      >
        <form
          onSubmit={async e => {
            e.preventDefault();
            if (!editingReq) return;
            try {
              await transfersRepo.updateStockRequest(
                editingReq.id,
                {
                  required_date: editReqDate,
                  request_type: editReqType,
                  notes: editReqNotes.trim() || undefined,
                },
                currentRole
              );
              showToast(`Updated Indent #${editingReq.request_number}`, 'success');
              setEditingReq(null);
              await loadData();
            } catch (err: any) {
              showToast(err.message || 'Error updating indent', 'error');
            }
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Required Date *"
              type="date"
              value={editReqDate}
              onChange={e => setEditReqDate(e.target.value)}
              required
            />
            <Select
              label="Request Urgency *"
              value={editReqType}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditReqType(e.target.value as any)}
              options={[
                { value: 'next_day', label: 'Standard Next Day' },
                { value: 'same_day_urgent', label: 'Urgent Same Day' },
              ]}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Remarks / Notes</label>
            <textarea
              value={editReqNotes}
              onChange={e => setEditReqNotes(e.target.value)}
              rows={3}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-orange-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setEditingReq(null)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* 7. Rejecting Indent Modal */}
      <Modal
        isOpen={!!rejectingReq}
        onClose={() => setRejectingReq(null)}
        title="Reject Stock Indent"
        subtitle={`Request #${rejectingReq?.request_number}`}
        maxWidth="md"
      >
        <form
          onSubmit={async e => {
            e.preventDefault();
            if (!rejectingReq || !rejectReason.trim()) {
              showToast('Please state a reason for rejection', 'warning');
              return;
            }
            try {
              await transfersRepo.updateStockRequestStatus(rejectingReq.id, 'rejected', rejectReason.trim(), currentRole);
              showToast(`Rejected Indent #${rejectingReq.request_number}`, 'info');
              setRejectingReq(null);
              await loadData();
            } catch (err: any) {
              showToast(err.message || 'Error rejecting indent', 'error');
            }
          }}
          className="space-y-4"
        >
          <Input
            label="Reason for Rejection *"
            placeholder="e.g. Raw materials out of stock / Kitchen batch pending"
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setRejectingReq(null)}>
              Cancel
            </Button>
            <Button variant="danger" type="submit">
              Confirm Rejection
            </Button>
          </div>
        </form>
      </Modal>

      {/* 8. Deleting Indent Modal */}
      <Modal
        isOpen={!!deletingReq}
        onClose={() => setDeletingReq(null)}
        title="Delete Stock Indent"
        subtitle={`Request #${deletingReq?.request_number}`}
        maxWidth="md"
      >
        <form
          onSubmit={async e => {
            e.preventDefault();
            if (!deletingReq || !deleteReqReason.trim()) {
              showToast('Please provide a reason for deletion', 'warning');
              return;
            }
            try {
              await transfersRepo.deleteStockRequest(deletingReq.id, deleteReqReason.trim(), currentRole);
              showToast(`Deleted Indent #${deletingReq.request_number}`, 'success');
              setDeletingReq(null);
              await loadData();
            } catch (err: any) {
              showToast(err.message || 'Error deleting indent', 'error');
            }
          }}
          className="space-y-4"
        >
          <Input
            label="Reason for Deletion *"
            placeholder="e.g. Created by mistake / Outlet revised requirements"
            value={deleteReqReason}
            onChange={e => setDeleteReqReason(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setDeletingReq(null)}>
              Cancel
            </Button>
            <Button variant="danger" type="submit">
              Delete Indent
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
