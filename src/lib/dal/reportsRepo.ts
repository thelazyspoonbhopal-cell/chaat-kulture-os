import { db } from '../db';
import { salesRepo } from './salesRepo';

export interface DateRangeFilter {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  locationId?: string; // Optional filter for specific location
}

export interface SalesReportSummary {
  totalOrders: number;
  grossSales: number;
  discountTotal: number;
  netSales: number;
  taxTotal: number;
  averageOrderValue: number;
  channelBreakdown: Record<string, { count: number; total: number }>;
  paymentBreakdown: Record<string, number>;
  locationBreakdown: Record<string, { name: string; code: string; total: number; orderCount: number }>;
  topItems: { itemName: string; quantity: number; revenue: number }[];
  dailyTrends: { date: string; sales: number; orders: number }[];
}

export interface EstimatedPLReport {
  dateRange: { startDate: string; endDate: string };
  revenue: {
    grossSales: number;
    discounts: number;
    refunds: number;
    netRevenue: number;
  };
  costOfGoods: {
    totalPurchases: number;
    totalWastageCost: number;
    totalCOGS: number;
  };
  grossProfit: number;
  grossMarginPct: number;
  expenses: {
    byCategory: Record<string, number>;
    totalOperatingExpenses: number;
  };
  estimatedNetProfit: number;
  netMarginPct: number;
  cashTransfersToOwner: number;
}

export const reportsRepo = {
  async getSalesReport(filter: DateRangeFilter): Promise<SalesReportSummary> {
    const locations = await db.locations.toArray();
    const locMap = new Map(locations.map(l => [l.id, l]));

    let sales = await db.sales.toArray();
    if (sales.length === 0) {
      await salesRepo.syncFromCloud();
      sales = await db.sales.toArray();
    }

    // Filter by location if specified
    if (filter.locationId && filter.locationId !== 'all') {
      sales = sales.filter(s => s.location_id === filter.locationId);
    }

    // Filter by date range (created_at starts with YYYY-MM-DD)
    sales = sales.filter(s => {
      const datePart = s.created_at.substring(0, 10);
      return datePart >= filter.startDate && datePart <= filter.endDate;
    });

    let grossSales = 0;
    let discountTotal = 0;
    let netSales = 0;
    let taxTotal = 0;

    const channelBreakdown: Record<string, { count: number; total: number }> = {
      walk_in: { count: 0, total: 0 },
      zomato: { count: 0, total: 0 },
      swiggy: { count: 0, total: 0 },
      other: { count: 0, total: 0 },
    };

    const paymentBreakdown: Record<string, number> = {
      cash: 0,
      upi: 0,
      card: 0,
      other: 0,
    };

    const locationBreakdown: Record<string, { name: string; code: string; total: number; orderCount: number }> = {};
    const itemMap: Record<string, { quantity: number; revenue: number }> = {};
    const trendMap: Record<string, { sales: number; orders: number }> = {};

    for (const s of sales) {
      grossSales += s.gross_amount || 0;
      discountTotal += s.discount_amount || 0;
      netSales += s.net_amount || 0;
      taxTotal += s.tax_amount || 0;

      // Channel
      const ch = s.channel || 'walk_in';
      if (!channelBreakdown[ch]) {
        channelBreakdown[ch] = { count: 0, total: 0 };
      }
      channelBreakdown[ch].count += 1;
      channelBreakdown[ch].total += s.net_amount || 0;

      // Payments
      if (s.payments && s.payments.length > 0) {
        for (const p of s.payments) {
          paymentBreakdown[p.payment_method] = (paymentBreakdown[p.payment_method] || 0) + p.amount;
        }
      }

      // Location
      const loc = locMap.get(s.location_id);
      const locKey = s.location_id;
      if (!locationBreakdown[locKey]) {
        locationBreakdown[locKey] = {
          name: loc?.name || 'Unknown Outlet',
          code: loc?.code || 'OUT',
          total: 0,
          orderCount: 0,
        };
      }
      locationBreakdown[locKey].total += s.net_amount || 0;
      locationBreakdown[locKey].orderCount += 1;

      // Items
      if (s.items) {
        for (const itm of s.items) {
          const name = itm.item_name || 'Item';
          if (!itemMap[name]) {
            itemMap[name] = { quantity: 0, revenue: 0 };
          }
          itemMap[name].quantity += itm.quantity;
          itemMap[name].revenue += itm.total_price;
        }
      }

      // Trends
      const day = s.created_at.substring(0, 10);
      if (!trendMap[day]) {
        trendMap[day] = { sales: 0, orders: 0 };
      }
      trendMap[day].sales += s.net_amount || 0;
      trendMap[day].orders += 1;
    }

    const topItems = Object.entries(itemMap)
      .map(([itemName, data]) => ({ itemName, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const dailyTrends = Object.entries(trendMap)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalOrders: sales.length,
      grossSales,
      discountTotal,
      netSales,
      taxTotal,
      averageOrderValue: sales.length > 0 ? netSales / sales.length : 0,
      channelBreakdown,
      paymentBreakdown,
      locationBreakdown,
      topItems,
      dailyTrends,
    };
  },

  async getEstimatedPL(filter: DateRangeFilter): Promise<EstimatedPLReport> {
    // 1. Revenue from Sales
    let sales = await db.sales.toArray();
    if (sales.length === 0) {
      await salesRepo.syncFromCloud();
      sales = await db.sales.toArray();
    }
    if (filter.locationId && filter.locationId !== 'all') {
      sales = sales.filter(s => s.location_id === filter.locationId);
    }
    sales = sales.filter(s => {
      const d = s.created_at.substring(0, 10);
      return d >= filter.startDate && d <= filter.endDate;
    });

    let grossSales = 0;
    let discounts = 0;
    let refunds = 0;
    let netRevenue = 0;

    for (const s of sales) {
      grossSales += s.gross_amount || 0;
      discounts += s.discount_amount || 0;
      netRevenue += s.net_amount || 0;
      if (s.payment_status === 'partially_refunded' || s.payment_status === 'fully_refunded') {
        refunds += s.discount_amount || 0;
      }
    }

    // 2. Cost of Goods (Inward purchases during this period)
    let purchases = await db.purchases.toArray();
    if (filter.locationId && filter.locationId !== 'all') {
      purchases = purchases.filter(p => p.receiving_location_id === filter.locationId);
    }
    purchases = purchases.filter(p => {
      const d = p.created_at.substring(0, 10);
      return d >= filter.startDate && d <= filter.endDate;
    });

    const totalPurchases = purchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);

    // Wastage costs (estimated from wastage items)
    let wastage = await db.wastage_records.toArray();
    if (filter.locationId && filter.locationId !== 'all') {
      wastage = wastage.filter(w => w.location_id === filter.locationId);
    }
    wastage = wastage.filter(w => {
      const d = w.created_at.substring(0, 10);
      return d >= filter.startDate && d <= filter.endDate;
    });

    // Assume average raw material unit cost around ₹50-100 or calculate if inventory item has cost_per_unit
    const inventoryItems = await db.inventory_items.toArray();
    const itemCostMap = new Map(inventoryItems.map(i => [i.id, i.cost_per_unit || 0]));

    let totalWastageCost = 0;
    for (const w of wastage) {
      const cost = itemCostMap.get(w.inventory_item_id) || 40;
      totalWastageCost += (w.quantity || 0) * cost;
    }

    const totalCOGS = totalPurchases; // Cost of inventory purchased
    const grossProfit = netRevenue - totalCOGS;
    const grossMarginPct = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

    // 3. Operational Expenses
    const expenseCategories = await db.expense_categories.toArray();
    const catMap = new Map(expenseCategories.map(c => [c.id, c.name]));

    let expenses = await db.expenses.toArray();
    if (filter.locationId && filter.locationId !== 'all') {
      expenses = expenses.filter(e => e.location_id === filter.locationId);
    }
    expenses = expenses.filter(e => {
      const d = (e.expense_date || e.created_at).substring(0, 10);
      return d >= filter.startDate && d <= filter.endDate;
    });

    const byCategory: Record<string, number> = {};
    let totalOperatingExpenses = 0;

    for (const exp of expenses) {
      if (exp.payment_status !== 'cancelled') {
        const catName = catMap.get(exp.category_id) || 'General Expenses';
        byCategory[catName] = (byCategory[catName] || 0) + exp.amount;
        totalOperatingExpenses += exp.amount;
      }
    }

    const estimatedNetProfit = grossProfit - totalOperatingExpenses;
    const netMarginPct = netRevenue > 0 ? (estimatedNetProfit / netRevenue) * 100 : 0;

    // 4. Cash Transferred to Owner during this period
    let transfers = await db.cash_transfers_to_owner.toArray();
    if (filter.locationId && filter.locationId !== 'all') {
      transfers = transfers.filter(t => t.from_location_id === filter.locationId);
    }
    transfers = transfers.filter(t => {
      const d = (t.transfer_date || t.created_at).substring(0, 10);
      return d >= filter.startDate && d <= filter.endDate;
    });
    const cashTransfersToOwner = transfers.reduce((sum, t) => sum + (t.amount || 0), 0);

    return {
      dateRange: { startDate: filter.startDate, endDate: filter.endDate },
      revenue: {
        grossSales,
        discounts,
        refunds,
        netRevenue,
      },
      costOfGoods: {
        totalPurchases,
        totalWastageCost,
        totalCOGS,
      },
      grossProfit,
      grossMarginPct,
      expenses: {
        byCategory,
        totalOperatingExpenses,
      },
      estimatedNetProfit,
      netMarginPct,
      cashTransfersToOwner,
    };
  }
};
