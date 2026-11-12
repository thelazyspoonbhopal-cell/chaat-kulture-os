import { db } from '../db';
import { CashTransferToOwner } from '../../types';

export const cashTransfersRepo = {
  async getAll(locationId?: string): Promise<CashTransferToOwner[]> {
    let transfers = await db.cash_transfers_to_owner.toArray();
    if (locationId) {
      transfers = transfers.filter(t => t.from_location_id === locationId);
    }
    return transfers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async getTransfersForDate(locationId: string, dateStr: string): Promise<CashTransferToOwner[]> {
    const all = await db.cash_transfers_to_owner.where('from_location_id').equals(locationId).toArray();
    return all.filter(t => t.transfer_date === dateStr || t.created_at.startsWith(dateStr));
  },

  async getTotalTransferredForDate(locationId: string, dateStr: string): Promise<number> {
    const list = await this.getTransfersForDate(locationId, dateStr);
    return list.reduce((sum, item) => sum + (item.amount || 0), 0);
  },

  async create(data: Omit<CashTransferToOwner, 'id' | 'business_id' | 'created_at'>): Promise<CashTransferToOwner> {
    const business = await db.businesses.toCollection().first();
    const businessId = business?.id || 'biz_ck_01';
    const now = new Date().toISOString();

    const transfer: CashTransferToOwner = {
      id: `ct_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      business_id: businessId,
      created_at: now,
      ...data,
    };

    await db.cash_transfers_to_owner.put(transfer);
    return transfer;
  },

  async confirm(id: string): Promise<void> {
    await db.cash_transfers_to_owner.update(id, { is_confirmed: true });
  },

  async delete(id: string): Promise<void> {
    await db.cash_transfers_to_owner.delete(id);
  }
};
