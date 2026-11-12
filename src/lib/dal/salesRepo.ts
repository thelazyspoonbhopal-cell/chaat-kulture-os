import { db } from '../db';
import type { Sale, SaleItem, SalePayment, SalesChannel } from '../../types';

export const salesRepo = {
  async getSales(filters?: { location_id?: string; channel?: SalesChannel; date?: string }): Promise<Sale[]> {
    let list = await db.sales.toArray();

    if (filters?.location_id) {
      list = list.filter(s => s.location_id === filters.location_id);
    }
    if (filters?.channel) {
      list = list.filter(s => s.channel === filters.channel);
    }
    if (filters?.date) {
      list = list.filter(s => s.created_at.startsWith(filters.date!));
    }

    return list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  },

  async getSaleById(id: string): Promise<Sale | undefined> {
    return await db.sales.get(id);
  },

  async createSale(saleData: {
    business_id: string;
    location_id: string;
    channel: SalesChannel;
    items: Omit<SaleItem, 'id' | 'sale_id' | 'created_at'>[];
    payments: Omit<SalePayment, 'id' | 'sale_id' | 'created_at'>[];
    discount_amount?: number;
    discount_type?: 'percentage' | 'fixed' | 'none';
    discount_reason?: string;
    discount_authorized_by?: string;
    notes?: string;
    created_by?: string;
    is_demo?: boolean;
  }): Promise<Sale> {
    const now = new Date().toISOString();
    const saleId = 'sale_' + Date.now();
    const clientTxId = 'tx_pos_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

    // Count today's sales for order number
    const todayStr = now.split('T')[0];
    const todayCount = await db.sales
      .filter(s => s.location_id === saleData.location_id && s.created_at.startsWith(todayStr))
      .count();

    const orderNumber = `ORD-${todayCount + 1001}`;

    // Process items
    let grossAmount = 0;
    let totalTax = 0;

    const saleItems: SaleItem[] = saleData.items.map((item, index) => {
      grossAmount += item.total_price;
      totalTax += item.tax_amount;
      return {
        ...item,
        id: `sitem_${Date.now()}_${index}`,
        sale_id: saleId,
        created_at: now,
      };
    });

    const discountAmount = saleData.discount_amount || 0;
    const netAmount = Math.max(0, grossAmount + totalTax - discountAmount);

    const salePayments: SalePayment[] = saleData.payments.map((p, index) => ({
      ...p,
      id: `spay_${Date.now()}_${index}`,
      sale_id: saleId,
      created_at: now,
    }));

    const newSale: Sale = {
      id: saleId,
      client_tx_id: clientTxId,
      business_id: saleData.business_id,
      location_id: saleData.location_id,
      order_number: orderNumber,
      channel: saleData.channel,
      gross_amount: grossAmount,
      tax_amount: totalTax,
      discount_amount: discountAmount,
      discount_type: saleData.discount_type || 'none',
      discount_reason: saleData.discount_reason,
      discount_authorized_by: saleData.discount_authorized_by,
      net_amount: netAmount,
      payment_status: 'completed',
      notes: saleData.notes,
      created_by: saleData.created_by,
      created_at: now,
      items: saleItems,
      payments: salePayments,
      is_demo: saleData.is_demo,
    };

    await db.sales.put(newSale);

    // Audit log
    await db.audit_logs.put({
      id: 'audit_' + Date.now(),
      business_id: saleData.business_id,
      action: 'CREATE_SALE',
      entity: 'sales',
      entity_id: saleId,
      location_id: saleData.location_id,
      new_data: { order_number: orderNumber, net_amount: netAmount, channel: saleData.channel },
      created_at: now,
    });

    return newSale;
  },

  async processRefund(
    saleId: string,
    refundData: {
      refund_amount: number;
      refund_method: 'cash' | 'upi' | 'card' | 'other';
      reason: string;
      authorized_by?: string;
    }
  ): Promise<Sale> {
    const sale = await db.sales.get(saleId);
    if (!sale) throw new Error('Sale not found');

    const now = new Date().toISOString();
    const newStatus = refundData.refund_amount >= sale.net_amount ? 'fully_refunded' : 'partially_refunded';

    const updatedSale: Sale = {
      ...sale,
      payment_status: newStatus,
      notes: `${sale.notes || ''} | Refunded ₹${refundData.refund_amount} via ${refundData.refund_method}: ${refundData.reason}`.trim(),
    };

    await db.sales.put(updatedSale);

    // Audit log (never delete original sale)
    await db.audit_logs.put({
      id: 'audit_' + Date.now(),
      business_id: sale.business_id,
      action: 'PROCESS_REFUND',
      entity: 'sales',
      entity_id: saleId,
      location_id: sale.location_id,
      reason: refundData.reason,
      old_data: { status: sale.payment_status, net_amount: sale.net_amount },
      new_data: { status: newStatus, refund_amount: refundData.refund_amount },
      created_at: now,
    });

    return updatedSale;
  },

  async getDailyMetrics(locationId?: string, dateStr?: string) {
    const targetDate = dateStr || new Date().toISOString().split('T')[0];
    let query = db.sales.filter(s => s.created_at.startsWith(targetDate));

    if (locationId) {
      query = query.filter(s => s.location_id === locationId);
    }

    const salesList = await query.toArray();

    let totalGross = 0;
    let totalNet = 0;
    let totalTax = 0;
    let totalDiscounts = 0;
    let cashCollections = 0;
    let upiCollections = 0;
    let cardCollections = 0;
    let complimentaryFoodValue = 0;
    const channelBreakdown: Record<SalesChannel, { count: number; total: number }> = {
      walk_in: { count: 0, total: 0 },
      zomato: { count: 0, total: 0 },
      swiggy: { count: 0, total: 0 },
      other: { count: 0, total: 0 },
    };

    salesList.forEach(sale => {
      totalGross += sale.gross_amount;
      totalNet += sale.net_amount;
      totalTax += sale.tax_amount;
      totalDiscounts += sale.discount_amount;

      if (channelBreakdown[sale.channel]) {
        channelBreakdown[sale.channel].count += 1;
        channelBreakdown[sale.channel].total += sale.net_amount;
      }

      sale.payments?.forEach(p => {
        if (p.payment_method === 'cash') cashCollections += p.amount;
        if (p.payment_method === 'upi') upiCollections += p.amount;
        if (p.payment_method === 'card') cardCollections += p.amount;
      });

      sale.items?.forEach(item => {
        if (item.is_complimentary) {
          complimentaryFoodValue += item.total_price;
        }
      });
    });

    return {
      orderCount: salesList.length,
      totalGross,
      totalNet,
      totalTax,
      totalDiscounts,
      cashCollections,
      upiCollections,
      cardCollections,
      complimentaryFoodValue,
      channelBreakdown,
      averageOrderValue: salesList.length > 0 ? totalNet / salesList.length : 0,
    };
  },
};
