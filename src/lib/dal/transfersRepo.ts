import { db } from '../db';
import type {
  StockRequest,
  StockRequestItem,
  Dispatch,
  DispatchItem,
  InventoryMovement,
  InventoryBalance,
} from '../../types';
import { fetchGistFile, updateGistFiles } from '../sync/cloudRegistry';

export const TRANSFERS_GIST_FILE = 'chaat_kulture_transfers.json';

export interface CloudTransfersPayload {
  stock_requests: StockRequest[];
  dispatches: Dispatch[];
  updated_at: string;
}

let isTransfersSyncing = false;
let transfersSyncTimeout: any = null;

export const transfersRepo = {
  // Cloud Registry Sync
  async fetchCloudTransfers(): Promise<CloudTransfersPayload | null> {
    try {
      const data = await fetchGistFile<CloudTransfersPayload>(TRANSFERS_GIST_FILE);
      if (data && (Array.isArray(data.stock_requests) || Array.isArray(data.dispatches))) {
        return data;
      }
    } catch (err) {
      console.warn('[TransfersRepo] Failed to fetch cloud transfers:', err);
    }
    return null;
  },

  async syncTransfersToCloud(): Promise<boolean> {
    try {
      const [reqs, dsps] = await Promise.all([
        db.stock_requests.toArray(),
        db.dispatches.toArray(),
      ]);

      const payload: CloudTransfersPayload = {
        stock_requests: reqs,
        dispatches: dsps,
        updated_at: new Date().toISOString(),
      };

      return await updateGistFiles({
        [TRANSFERS_GIST_FILE]: payload,
      });
    } catch (err) {
      console.error('[TransfersRepo] Failed to sync transfers to cloud:', err);
      return false;
    }
  },

  debouncedSyncToCloud() {
    if (transfersSyncTimeout) clearTimeout(transfersSyncTimeout);
    transfersSyncTimeout = setTimeout(() => {
      this.syncTransfersToCloud().catch(e => console.warn('[TransfersRepo] Background sync failed:', e));
    }, 2000);
  },

  async syncFromCloud(force = false): Promise<void> {
    if (isTransfersSyncing && !force) return;
    isTransfersSyncing = true;
    try {
      const cloudData = await this.fetchCloudTransfers();
      if (cloudData) {
        if (Array.isArray(cloudData.stock_requests) && cloudData.stock_requests.length > 0) {
          for (const r of cloudData.stock_requests) await db.stock_requests.put(r);
        }
        if (Array.isArray(cloudData.dispatches) && cloudData.dispatches.length > 0) {
          for (const d of cloudData.dispatches) await db.dispatches.put(d);
        }
      }
    } catch (err) {
      console.error('[TransfersRepo] Sync from cloud failed:', err);
    } finally {
      isTransfersSyncing = false;
    }
  },

  // Stock Requests / Indents
  async getStockRequests(filters?: { from_location_id?: string; to_location_id?: string }): Promise<StockRequest[]> {
    let list = await db.stock_requests.toArray();
    if (list.length === 0) {
      await this.syncFromCloud();
      list = await db.stock_requests.toArray();
    }
    if (filters?.from_location_id) {
      list = list.filter(r => r.from_location_id === filters.from_location_id);
    }
    if (filters?.to_location_id) {
      list = list.filter(r => r.to_location_id === filters.to_location_id);
    }
    return list.sort((a, b) => (b.created_at || b.required_date || '').localeCompare(a.created_at || a.required_date || ''));
  },

  async createStockRequest(data: {
    business_id: string;
    from_location_id: string;
    to_location_id: string;
    request_type: 'next_day' | 'same_day_urgent';
    required_date: string;
    items: Omit<StockRequestItem, 'id' | 'stock_request_id' | 'approved_quantity' | 'dispatched_quantity' | 'received_quantity'>[];
    notes?: string;
    created_by?: string;
    is_demo?: boolean;
  }): Promise<StockRequest> {
    const now = new Date().toISOString();
    const requestId = 'req_' + Date.now();
    const clientTxId = 'tx_req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

    const fromLoc = await db.locations.get(data.from_location_id);
    const locCode = fromLoc ? fromLoc.code.split('-')[0] : 'OUT';
    const totalRequests = await db.stock_requests.count();
    const requestNumber = `REQ-${locCode}-${totalRequests + 101}`;

    const items: StockRequestItem[] = data.items.map((item, index) => ({
      ...item,
      id: `rqi_${Date.now()}_${index}`,
      stock_request_id: requestId,
      approved_quantity: item.requested_quantity, // default to requested
      dispatched_quantity: 0,
      received_quantity: 0,
    }));

    const newRequest: StockRequest = {
      id: requestId,
      client_tx_id: clientTxId,
      business_id: data.business_id,
      request_number: requestNumber,
      from_location_id: data.from_location_id,
      to_location_id: data.to_location_id,
      request_type: data.request_type,
      required_date: data.required_date,
      status: 'submitted',
      notes: data.notes,
      created_by: data.created_by,
      created_at: now,
      updated_at: now,
      items,
      is_demo: data.is_demo,
    };

    await db.stock_requests.put(newRequest);
    this.debouncedSyncToCloud();

    // Audit log
    await db.audit_logs.put({
      id: 'audit_' + Date.now(),
      business_id: data.business_id,
      action: 'CREATE_STOCK_REQUEST',
      entity: 'stock_requests',
      entity_id: requestId,
      location_id: data.from_location_id,
      new_data: { request_number: requestNumber, items_count: items.length },
      created_at: now,
    });

    return newRequest;
  },

  // Dispatches & Delivery Challans
  async getDispatches(filters?: { from_location_id?: string; to_location_id?: string; status?: string }): Promise<Dispatch[]> {
    let list = await db.dispatches.toArray();
    if (list.length === 0) {
      await this.syncFromCloud();
      list = await db.dispatches.toArray();
    }
    if (filters?.from_location_id) {
      list = list.filter(d => d.from_location_id === filters.from_location_id);
    }
    if (filters?.to_location_id) {
      list = list.filter(d => d.to_location_id === filters.to_location_id);
    }
    if (filters?.status) {
      list = list.filter(d => d.status === filters.status);
    }
    return list.sort((a, b) => (b.dispatch_date || b.created_at || '').localeCompare(a.dispatch_date || a.created_at || ''));
  },

  async createDispatch(data: {
    business_id: string;
    stock_request_id?: string;
    from_location_id: string;
    to_location_id: string;
    items: Omit<DispatchItem, 'id' | 'dispatch_id' | 'received_quantity' | 'damaged_or_missing_quantity'>[];
    vehicle_number?: string;
    driver_name?: string;
    driver_phone?: string;
    notes?: string;
    dispatched_by?: string;
    is_demo?: boolean;
  }): Promise<Dispatch> {
    const now = new Date().toISOString();
    const dispatchId = 'dsp_' + Date.now();
    const clientTxId = 'tx_dsp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

    const fromLoc = await db.locations.get(data.from_location_id);
    const locCode = fromLoc ? fromLoc.code.split('-')[0] : 'BK';
    const totalDispatches = await db.dispatches.count();
    const challanNumber = `CHL-${locCode}-${totalDispatches + 101}`;

    const items: DispatchItem[] = data.items.map((item, index) => ({
      ...item,
      id: `dspi_${Date.now()}_${index}`,
      dispatch_id: dispatchId,
      received_quantity: 0,
      damaged_or_missing_quantity: 0,
    }));

    const newDispatch: Dispatch = {
      id: dispatchId,
      client_tx_id: clientTxId,
      business_id: data.business_id,
      challan_number: challanNumber,
      stock_request_id: data.stock_request_id,
      from_location_id: data.from_location_id,
      to_location_id: data.to_location_id,
      status: 'in_transit',
      dispatch_date: now,
      vehicle_number: data.vehicle_number,
      driver_name: data.driver_name,
      driver_phone: data.driver_phone,
      notes: data.notes,
      dispatched_by: data.dispatched_by,
      created_at: now,
      items,
      is_demo: data.is_demo,
    };

    await db.transaction('rw', [db.dispatches, db.stock_requests, db.inventory_balances, db.inventory_movements, db.audit_logs], async () => {
      // 1. Save dispatch
      await db.dispatches.put(newDispatch);

      // 2. Update stock request status and dispatched quantities if linked
      if (data.stock_request_id) {
        const req = await db.stock_requests.get(data.stock_request_id);
        if (req) {
          const updatedReqItems = (req.items || []).map(rItem => {
            const dItem = items.find(di => di.inventory_item_id === rItem.inventory_item_id);
            return {
              ...rItem,
              dispatched_quantity: dItem ? dItem.dispatched_quantity : rItem.dispatched_quantity,
            };
          });
          await db.stock_requests.update(data.stock_request_id, {
            status: 'dispatched',
            items: updatedReqItems,
            updated_at: now,
          });
        }
      }

      // 3. For each item: Deduct from source location, add to destination in_transit
      for (const item of items) {
        // Source location balance deduction
        const sourceBalKey = `bal_${data.from_location_id}_${item.inventory_item_id}`;
        const sourceBal = await db.inventory_balances.get(sourceBalKey);
        const currentSourceQty = sourceBal ? sourceBal.available_quantity : 0;
        const newSourceQty = currentSourceQty - item.dispatched_quantity;

        await db.inventory_balances.put({
          id: sourceBalKey,
          business_id: data.business_id,
          location_id: data.from_location_id,
          inventory_item_id: item.inventory_item_id,
          available_quantity: newSourceQty,
          in_transit_quantity: sourceBal ? sourceBal.in_transit_quantity : 0,
          last_updated: now,
          last_updated_by: data.dispatched_by,
        });

        // Destination location in_transit addition
        const destBalKey = `bal_${data.to_location_id}_${item.inventory_item_id}`;
        const destBal = await db.inventory_balances.get(destBalKey);
        const currentDestTransit = destBal ? destBal.in_transit_quantity : 0;

        await db.inventory_balances.put({
          id: destBalKey,
          business_id: data.business_id,
          location_id: data.to_location_id,
          inventory_item_id: item.inventory_item_id,
          available_quantity: destBal ? destBal.available_quantity : 0,
          in_transit_quantity: currentDestTransit + item.dispatched_quantity,
          last_updated: now,
          last_updated_by: data.dispatched_by,
        });

        // Movement ledger for source location deduction
        await db.inventory_movements.put({
          id: 'mov_' + Date.now() + Math.random().toString(36).substr(2, 3),
          client_tx_id: clientTxId,
          business_id: data.business_id,
          location_id: data.from_location_id,
          inventory_item_id: item.inventory_item_id,
          movement_type: 'dispatch_out',
          quantity_change: -item.dispatched_quantity,
          balance_after: newSourceQty,
          unit: item.unit,
          batch_reference: challanNumber,
          notes: `Dispatched to outlet via Challan #${challanNumber}`,
          reference_id: dispatchId,
          created_by: data.dispatched_by,
          created_at: now,
          is_demo: data.is_demo,
        });
      }

      // Audit
      await db.audit_logs.put({
        id: 'audit_' + Date.now(),
        business_id: data.business_id,
        action: 'CREATE_DISPATCH_CHALLAN',
        entity: 'dispatches',
        entity_id: dispatchId,
        location_id: data.from_location_id,
        new_data: { challan_number: challanNumber, to_location_id: data.to_location_id },
        created_at: now,
      });
    });

    this.debouncedSyncToCloud();
    return newDispatch;
  },

  async confirmReceiving(
    dispatchId: string,
    receivedItems: { inventory_item_id: string; received_quantity: number; damaged_or_missing_quantity?: number; discrepancy_reason?: string }[],
    receivedBy?: string
  ): Promise<Dispatch> {
    const dispatch = await db.dispatches.get(dispatchId);
    if (!dispatch) throw new Error('Dispatch not found');

    const now = new Date().toISOString();
    let hasDiscrepancy = false;

    const updatedItems = (dispatch.items || []).map(item => {
      const match = receivedItems.find(r => r.inventory_item_id === item.inventory_item_id);
      if (match) {
        const damaged = match.damaged_or_missing_quantity || 0;
        if (match.received_quantity !== item.dispatched_quantity || damaged > 0) {
          hasDiscrepancy = true;
        }
        return {
          ...item,
          received_quantity: match.received_quantity,
          damaged_or_missing_quantity: damaged,
          discrepancy_reason: match.discrepancy_reason,
        };
      }
      return item;
    });

    const finalStatus = hasDiscrepancy ? 'discrepancy' : 'received';

    await db.transaction('rw', [db.dispatches, db.stock_requests, db.inventory_balances, db.inventory_movements, db.audit_logs], async () => {
      // 1. Update dispatch status
      const updatedDispatch: Dispatch = {
        ...dispatch,
        status: finalStatus,
        received_date: now,
        received_by: receivedBy,
        items: updatedItems,
      };
      await db.dispatches.put(updatedDispatch);

      // 2. Update stock request if linked
      if (dispatch.stock_request_id) {
        const req = await db.stock_requests.get(dispatch.stock_request_id);
        if (req) {
          const updatedReqItems = (req.items || []).map(rItem => {
            const rcItem = updatedItems.find(ui => ui.inventory_item_id === rItem.inventory_item_id);
            return {
              ...rItem,
              received_quantity: rcItem ? rcItem.received_quantity : rItem.received_quantity,
            };
          });
          await db.stock_requests.update(dispatch.stock_request_id, {
            status: 'received',
            items: updatedReqItems,
            updated_at: now,
          });
        }
      }

      // 3. For each item: Clear in_transit, add received to destination available_quantity
      for (const item of updatedItems) {
        const destBalKey = `bal_${dispatch.to_location_id}_${item.inventory_item_id}`;
        const destBal = await db.inventory_balances.get(destBalKey);
        const currentDestAvail = destBal ? destBal.available_quantity : 0;
        const currentDestTransit = destBal ? destBal.in_transit_quantity : item.dispatched_quantity;

        const newDestAvail = currentDestAvail + item.received_quantity;
        const newDestTransit = Math.max(0, currentDestTransit - item.dispatched_quantity);

        await db.inventory_balances.put({
          id: destBalKey,
          business_id: dispatch.business_id,
          location_id: dispatch.to_location_id,
          inventory_item_id: item.inventory_item_id,
          available_quantity: newDestAvail,
          in_transit_quantity: newDestTransit,
          last_updated: now,
          last_updated_by: receivedBy,
        });

        // Movement ledger for destination location receipt
        await db.inventory_movements.put({
          id: 'mov_' + Date.now() + Math.random().toString(36).substr(2, 3),
          client_tx_id: 'tx_rec_' + Date.now() + Math.random().toString(36).substr(2, 3),
          business_id: dispatch.business_id,
          location_id: dispatch.to_location_id,
          inventory_item_id: item.inventory_item_id,
          movement_type: 'dispatch_in',
          quantity_change: item.received_quantity,
          balance_after: newDestAvail,
          unit: item.unit,
          batch_reference: dispatch.challan_number,
          notes: `Received from ${dispatch.from_location_id} via Challan #${dispatch.challan_number}`,
          reference_id: dispatch.id,
          created_by: receivedBy,
          created_at: now,
        });

        // If damaged/missing recorded, log a separate damage movement
        if (item.damaged_or_missing_quantity > 0) {
          await db.inventory_movements.put({
            id: 'mov_dmg_' + Date.now() + Math.random().toString(36).substr(2, 3),
            client_tx_id: 'tx_dmg_' + Date.now() + Math.random().toString(36).substr(2, 3),
            business_id: dispatch.business_id,
            location_id: dispatch.to_location_id,
            inventory_item_id: item.inventory_item_id,
            movement_type: 'damage',
            quantity_change: -item.damaged_or_missing_quantity,
            balance_after: newDestAvail, // balance already accounts for damaged not being in received
            unit: item.unit,
            batch_reference: dispatch.challan_number,
            notes: `Transit shortage/damage on Challan #${dispatch.challan_number}: ${item.discrepancy_reason || 'Damaged in transit'}`,
            reference_id: dispatch.id,
            created_by: receivedBy,
            created_at: now,
          });
        }
      }

      // Audit
      await db.audit_logs.put({
        id: 'audit_' + Date.now(),
        business_id: dispatch.business_id,
        action: 'CONFIRM_DISPATCH_RECEIPT',
        entity: 'dispatches',
        entity_id: dispatch.id,
        location_id: dispatch.to_location_id,
        new_data: { status: finalStatus, hasDiscrepancy },
        created_at: now,
      });
    });

    const refreshed = await db.dispatches.get(dispatchId);
    this.debouncedSyncToCloud();
    return refreshed!;
  },

  async updateStockRequest(
    id: string,
    updates: {
      required_date?: string;
      request_type?: 'next_day' | 'same_day_urgent';
      notes?: string;
      items?: StockRequestItem[];
    },
    updatedBy?: string
  ): Promise<StockRequest> {
    const existing = await db.stock_requests.get(id);
    if (!existing) throw new Error('Stock request not found');

    const now = new Date().toISOString();
    const updated: StockRequest = {
      ...existing,
      ...updates,
      updated_at: now,
    };

    await db.stock_requests.put(updated);
    await db.audit_logs.put({
      id: 'audit_' + Date.now(),
      business_id: existing.business_id,
      action: 'UPDATE_STOCK_REQUEST',
      entity: 'stock_requests',
      entity_id: id,
      location_id: existing.from_location_id,
      new_data: updates,
      created_at: now,
    });
    return updated;
  },

  async updateStockRequestStatus(
    id: string,
    status: StockRequest['status'],
    reason?: string,
    updatedBy?: string
  ): Promise<StockRequest> {
    const existing = await db.stock_requests.get(id);
    if (!existing) throw new Error('Stock request not found');

    const now = new Date().toISOString();
    const updated: StockRequest = {
      ...existing,
      status,
      reviewed_by: updatedBy,
      rejection_reason: reason,
      updated_at: now,
    };

    await db.stock_requests.put(updated);
    await db.audit_logs.put({
      id: 'audit_' + Date.now(),
      business_id: existing.business_id,
      action: 'UPDATE_STOCK_REQUEST_STATUS',
      entity: 'stock_requests',
      entity_id: id,
      location_id: existing.from_location_id,
      new_data: { status, reason, updatedBy },
      created_at: now,
    });
    return updated;
  },

  async deleteStockRequest(id: string, reason: string, deletedBy?: string): Promise<void> {
    const existing = await db.stock_requests.get(id);
    if (!existing) throw new Error('Stock request not found');

    const now = new Date().toISOString();
    await db.stock_requests.delete(id);
    await db.audit_logs.put({
      id: 'audit_' + Date.now(),
      business_id: existing.business_id,
      action: 'DELETE_STOCK_REQUEST',
      entity: 'stock_requests',
      entity_id: id,
      location_id: existing.from_location_id,
      new_data: { request_number: existing.request_number, reason, deletedBy },
      created_at: now,
    });
    this.debouncedSyncToCloud();
  },

  async updateDispatchStatus(
    id: string,
    status: Dispatch['status'],
    reason?: string,
    updatedBy?: string
  ): Promise<Dispatch> {
    const existing = await db.dispatches.get(id);
    if (!existing) throw new Error('Dispatch not found');

    const now = new Date().toISOString();
    const updated: Dispatch = {
      ...existing,
      status,
      cancellation_reason: reason || existing.cancellation_reason,
    };

    await db.dispatches.put(updated);
    await db.audit_logs.put({
      id: 'audit_' + Date.now(),
      business_id: existing.business_id,
      action: 'UPDATE_DISPATCH_STATUS',
      entity: 'dispatches',
      entity_id: id,
      location_id: existing.from_location_id,
      new_data: { old_status: existing.status, new_status: status, reason, updatedBy },
      created_at: now,
    });
    return updated;
  },

  async updateDispatch(
    id: string,
    updates: {
      vehicle_number?: string;
      driver_name?: string;
      driver_phone?: string;
      notes?: string;
      status?: Dispatch['status'];
      items?: DispatchItem[];
    },
    updatedBy?: string
  ): Promise<Dispatch> {
    const existing = await db.dispatches.get(id);
    if (!existing) throw new Error('Dispatch not found');

    const now = new Date().toISOString();

    await db.transaction('rw', [db.dispatches, db.inventory_balances, db.audit_logs], async () => {
      // If item quantities are updated while in transit or sent, adjust delta in inventory balances
      if (updates.items && (existing.status === 'in_transit' || existing.status === 'sent')) {
        for (const updatedItem of updates.items) {
          const oldItem = existing.items?.find(it => it.id === updatedItem.id || it.inventory_item_id === updatedItem.inventory_item_id);
          const oldQty = oldItem ? oldItem.dispatched_quantity : 0;
          const newQty = updatedItem.dispatched_quantity;
          const delta = newQty - oldQty; // e.g. from 10 to 12 => +2 extra dispatched

          if (delta !== 0) {
            // Source available balance decreases by delta
            const sourceBalKey = `bal_${existing.from_location_id}_${updatedItem.inventory_item_id}`;
            const sourceBal = await db.inventory_balances.get(sourceBalKey);
            const currentSourceQty = sourceBal ? sourceBal.available_quantity : 0;
            const newSourceQty = Math.max(0, currentSourceQty - delta);

            await db.inventory_balances.put({
              id: sourceBalKey,
              business_id: existing.business_id,
              location_id: existing.from_location_id,
              inventory_item_id: updatedItem.inventory_item_id,
              available_quantity: newSourceQty,
              in_transit_quantity: sourceBal ? sourceBal.in_transit_quantity : 0,
              last_updated: now,
              last_updated_by: updatedBy,
            });

            // Destination in-transit balance increases by delta
            const destBalKey = `bal_${existing.to_location_id}_${updatedItem.inventory_item_id}`;
            const destBal = await db.inventory_balances.get(destBalKey);
            const currentDestTransit = destBal ? destBal.in_transit_quantity : 0;
            const newDestTransit = Math.max(0, currentDestTransit + delta);

            await db.inventory_balances.put({
              id: destBalKey,
              business_id: existing.business_id,
              location_id: existing.to_location_id,
              inventory_item_id: updatedItem.inventory_item_id,
              available_quantity: destBal ? destBal.available_quantity : 0,
              in_transit_quantity: newDestTransit,
              last_updated: now,
              last_updated_by: updatedBy,
            });
          }
        }
      }

      const updated: Dispatch = {
        ...existing,
        ...updates,
      };

      await db.dispatches.put(updated);
      await db.audit_logs.put({
        id: 'audit_' + Date.now(),
        business_id: existing.business_id,
        action: 'UPDATE_DISPATCH_DETAILS',
        entity: 'dispatches',
        entity_id: id,
        location_id: existing.from_location_id,
        new_data: updates,
        created_at: now,
      });
    });

    const refreshed = await db.dispatches.get(id);
    return refreshed || existing;
  },

  async voidDispatch(dispatchId: string, reason: string, cancelledBy?: string): Promise<Dispatch> {
    const dispatch = await db.dispatches.get(dispatchId);
    if (!dispatch) throw new Error('Dispatch not found');
    if (dispatch.status !== 'in_transit' && dispatch.status !== 'sent') {
      throw new Error(`Cannot void dispatch with status '${dispatch.status}'. Only in-transit or sent dispatches can be voided.`);
    }

    const now = new Date().toISOString();
    const clientTxId = 'tx_void_dsp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

    await db.transaction('rw', [db.dispatches, db.stock_requests, db.inventory_balances, db.inventory_movements, db.audit_logs], async () => {
      // 1. For each item in transit, restore to source available balance and clear from destination in_transit
      for (const item of dispatch.items || []) {
        // Restore source available balance
        const sourceBalKey = `bal_${dispatch.from_location_id}_${item.inventory_item_id}`;
        const sourceBal = await db.inventory_balances.get(sourceBalKey);
        const currentSourceQty = sourceBal ? sourceBal.available_quantity : 0;
        const newSourceQty = currentSourceQty + item.dispatched_quantity;

        await db.inventory_balances.put({
          id: sourceBalKey,
          business_id: dispatch.business_id,
          location_id: dispatch.from_location_id,
          inventory_item_id: item.inventory_item_id,
          available_quantity: newSourceQty,
          in_transit_quantity: sourceBal ? sourceBal.in_transit_quantity : 0,
          last_updated: now,
          last_updated_by: cancelledBy,
        });

        // Deduct from destination in-transit balance
        const destBalKey = `bal_${dispatch.to_location_id}_${item.inventory_item_id}`;
        const destBal = await db.inventory_balances.get(destBalKey);
        const currentDestTransit = destBal ? destBal.in_transit_quantity : item.dispatched_quantity;
        const newDestTransit = Math.max(0, currentDestTransit - item.dispatched_quantity);

        await db.inventory_balances.put({
          id: destBalKey,
          business_id: dispatch.business_id,
          location_id: dispatch.to_location_id,
          inventory_item_id: item.inventory_item_id,
          available_quantity: destBal ? destBal.available_quantity : 0,
          in_transit_quantity: newDestTransit,
          last_updated: now,
          last_updated_by: cancelledBy,
        });

        // Append movement ledger reversal
        await db.inventory_movements.put({
          id: 'mov_void_' + Date.now() + Math.random().toString(36).substr(2, 3),
          client_tx_id: clientTxId,
          business_id: dispatch.business_id,
          location_id: dispatch.from_location_id,
          inventory_item_id: item.inventory_item_id,
          movement_type: 'transfer_reversal',
          quantity_change: item.dispatched_quantity,
          balance_after: newSourceQty,
          unit: item.unit,
          batch_reference: dispatch.challan_number,
          notes: `VOID REVERSAL: Cancelled Challan #${dispatch.challan_number}. Reason: ${reason}`,
          reference_id: dispatch.id,
          created_by: cancelledBy,
          created_at: now,
        });
      }

      // 2. Revert linked stock request if exists
      if (dispatch.stock_request_id) {
        await db.stock_requests.update(dispatch.stock_request_id, {
          status: 'approved',
          updated_at: now,
        });
      }

      // 3. Mark dispatch cancelled
      const updated: Dispatch = {
        ...dispatch,
        status: 'cancelled',
        cancellation_reason: reason,
        cancelled_by: cancelledBy,
        cancelled_at: now,
      };
      await db.dispatches.put(updated);

      // 4. Audit
      await db.audit_logs.put({
        id: 'audit_' + Date.now(),
        business_id: dispatch.business_id,
        action: 'VOID_DISPATCH_CHALLAN',
        entity: 'dispatches',
        entity_id: dispatch.id,
        location_id: dispatch.from_location_id,
        new_data: { challan_number: dispatch.challan_number, reason, cancelledBy },
        created_at: now,
      });
    });

    const refreshed = await db.dispatches.get(dispatchId);
    this.debouncedSyncToCloud();
    return refreshed!;
  },

  async deleteDispatch(dispatchId: string, reason: string, deletedBy?: string): Promise<void> {
    const dispatch = await db.dispatches.get(dispatchId);
    if (!dispatch) throw new Error('Dispatch not found');

    // If still in-transit, reverse stock first
    if (dispatch.status === 'in_transit') {
      await this.voidDispatch(dispatchId, reason, deletedBy);
    }

    const now = new Date().toISOString();
    await db.dispatches.delete(dispatchId);
    await db.audit_logs.put({
      id: 'audit_' + Date.now(),
      business_id: dispatch.business_id,
      action: 'DELETE_DISPATCH_CHALLAN',
      entity: 'dispatches',
      entity_id: dispatch.id,
      location_id: dispatch.from_location_id,
      new_data: { challan_number: dispatch.challan_number, reason, deletedBy },
      created_at: now,
    });
    this.debouncedSyncToCloud();
  },

  /**
   * Super Admin & Manager Erase: Completely reverses stock, erases delivery challan AND its linked indent
   */
  async eraseChallanAndIndent(dispatchId: string, reason: string, erasedBy?: string): Promise<void> {
    const dispatch = await db.dispatches.get(dispatchId);
    if (!dispatch) throw new Error('Delivery challan not found');

    const now = new Date().toISOString();
    const clientTxId = 'tx_erase_dsp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

    await db.transaction('rw', [db.dispatches, db.stock_requests, db.inventory_balances, db.inventory_movements, db.audit_logs], async () => {
      // 1. Stock reversal if items were sent/in-transit or received
      if (dispatch.status === 'in_transit' || dispatch.status === 'sent') {
        for (const item of dispatch.items || []) {
          // Restore source available balance
          const sourceBalKey = `bal_${dispatch.from_location_id}_${item.inventory_item_id}`;
          const sourceBal = await db.inventory_balances.get(sourceBalKey);
          const currentSourceQty = sourceBal ? sourceBal.available_quantity : 0;
          const newSourceQty = currentSourceQty + item.dispatched_quantity;

          await db.inventory_balances.put({
            id: sourceBalKey,
            business_id: dispatch.business_id,
            location_id: dispatch.from_location_id,
            inventory_item_id: item.inventory_item_id,
            available_quantity: newSourceQty,
            in_transit_quantity: sourceBal ? sourceBal.in_transit_quantity : 0,
            last_updated: now,
            last_updated_by: erasedBy,
          });

          // Deduct from destination in-transit balance
          const destBalKey = `bal_${dispatch.to_location_id}_${item.inventory_item_id}`;
          const destBal = await db.inventory_balances.get(destBalKey);
          const currentDestTransit = destBal ? destBal.in_transit_quantity : item.dispatched_quantity;
          const newDestTransit = Math.max(0, currentDestTransit - item.dispatched_quantity);

          await db.inventory_balances.put({
            id: destBalKey,
            business_id: dispatch.business_id,
            location_id: dispatch.to_location_id,
            inventory_item_id: item.inventory_item_id,
            available_quantity: destBal ? destBal.available_quantity : 0,
            in_transit_quantity: newDestTransit,
            last_updated: now,
            last_updated_by: erasedBy,
          });

          // Movement ledger
          await db.inventory_movements.put({
            id: 'mov_erase_' + Date.now() + Math.random().toString(36).substr(2, 3),
            client_tx_id: clientTxId,
            business_id: dispatch.business_id,
            location_id: dispatch.from_location_id,
            inventory_item_id: item.inventory_item_id,
            movement_type: 'transfer_reversal',
            quantity_change: item.dispatched_quantity,
            balance_after: newSourceQty,
            unit: item.unit,
            batch_reference: dispatch.challan_number,
            notes: `CHALLAN & INDENT ERASED: Stock restored to source. Reason: ${reason}`,
            reference_id: dispatch.id,
            created_by: erasedBy,
            created_at: now,
          });
        }
      } else if (dispatch.status === 'received' || dispatch.status === 'partially_received' || dispatch.status === 'delivered') {
        for (const item of dispatch.items || []) {
          const qtyToRollback = item.received_quantity || item.dispatched_quantity;

          const destBalKey = `bal_${dispatch.to_location_id}_${item.inventory_item_id}`;
          const destBal = await db.inventory_balances.get(destBalKey);
          const currentDestAvail = destBal ? destBal.available_quantity : 0;
          const newDestAvail = Math.max(0, currentDestAvail - qtyToRollback);

          await db.inventory_balances.put({
            id: destBalKey,
            business_id: dispatch.business_id,
            location_id: dispatch.to_location_id,
            inventory_item_id: item.inventory_item_id,
            available_quantity: newDestAvail,
            in_transit_quantity: destBal ? destBal.in_transit_quantity : 0,
            last_updated: now,
            last_updated_by: erasedBy,
          });

          const sourceBalKey = `bal_${dispatch.from_location_id}_${item.inventory_item_id}`;
          const sourceBal = await db.inventory_balances.get(sourceBalKey);
          const currentSourceQty = sourceBal ? sourceBal.available_quantity : 0;
          const newSourceQty = currentSourceQty + item.dispatched_quantity;

          await db.inventory_balances.put({
            id: sourceBalKey,
            business_id: dispatch.business_id,
            location_id: dispatch.from_location_id,
            inventory_item_id: item.inventory_item_id,
            available_quantity: newSourceQty,
            in_transit_quantity: sourceBal ? sourceBal.in_transit_quantity : 0,
            last_updated: now,
            last_updated_by: erasedBy,
          });

          await db.inventory_movements.put({
            id: 'mov_erase_rec_' + Date.now() + Math.random().toString(36).substr(2, 3),
            client_tx_id: clientTxId,
            business_id: dispatch.business_id,
            location_id: dispatch.from_location_id,
            inventory_item_id: item.inventory_item_id,
            movement_type: 'transfer_reversal',
            quantity_change: item.dispatched_quantity,
            balance_after: newSourceQty,
            unit: item.unit,
            batch_reference: dispatch.challan_number,
            notes: `CHALLAN & INDENT ERASED: Received stock reversed. Reason: ${reason}`,
            reference_id: dispatch.id,
            created_by: erasedBy,
            created_at: now,
          });
        }
      }

      // 2. Erase the delivery challan
      await db.dispatches.delete(dispatchId);

      // 3. Erase the linked stock request (indent)
      if (dispatch.stock_request_id) {
        await db.stock_requests.delete(dispatch.stock_request_id);
      }

      // 4. Audit
      await db.audit_logs.put({
        id: 'audit_' + Date.now(),
        business_id: dispatch.business_id,
        action: 'ERASE_CHALLAN_AND_INDENT',
        entity: 'dispatches',
        entity_id: dispatch.id,
        location_id: dispatch.from_location_id,
        new_data: {
          challan_number: dispatch.challan_number,
          stock_request_id: dispatch.stock_request_id,
          reason,
          erasedBy,
        },
        created_at: now,
      });
    });

    this.debouncedSyncToCloud();
  },
};
