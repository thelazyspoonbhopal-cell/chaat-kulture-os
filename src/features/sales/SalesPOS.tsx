import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { db } from '../../lib/db';
import { salesRepo } from '../../lib/dal/salesRepo';
import { menuRepo } from '../../lib/dal/menuRepo';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Tag,
  Gift,
  RotateCcw,
  CheckCircle2,
  Printer,
  Search,
  AlertTriangle,
  Receipt,
  History,
} from 'lucide-react';
import type { MenuItem, MenuCategory, SalesChannel, Sale, InventoryBalance } from '../../types';

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  isComplimentary: boolean;
  complimentaryReason?: string;
  priceOverrideReason?: string;
}

export const SalesPOS: React.FC = () => {
  const { currentLocation, showToast } = useApp();

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [stockMap, setStockMap] = useState<Map<string, number>>(new Map());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<SalesChannel>('walk_in');

  // Cart with persistent auto-saved draft
  const POS_DRAFT_KEY = 'ck_pos_draft_cart';
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('ck_pos_draft_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (cart.length > 0) {
      localStorage.setItem(POS_DRAFT_KEY, JSON.stringify(cart));
    } else {
      localStorage.removeItem(POS_DRAFT_KEY);
    }
  }, [cart]);

  const [discountType, setDiscountType] = useState<'none' | 'fixed' | 'percentage'>('none');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState<string>('');

  // Payment Settlement Modal
  const [isPayModalOpen, setIsPayModalOpen] = useState<boolean>(false);
  const [cashAmount, setCashAmount] = useState<string>('');
  const [upiAmount, setUpiAmount] = useState<string>('');
  const [upiRef, setUpiRef] = useState<string>('');
  const [cardAmount, setCardAmount] = useState<string>('');

  // Completed Receipt Modal
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

  // Recent Sales & Refund Drawer
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [selectedSaleForRefund, setSelectedSaleForRefund] = useState<Sale | null>(null);
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [refundMethod, setRefundMethod] = useState<'cash' | 'upi' | 'card'>('cash');
  const [refundReason, setRefundReason] = useState<string>('');

  const loadPOSData = async () => {
    try {
      const [cats, items] = await Promise.all([
        menuRepo.getCategories(),
        menuRepo.getMenuItems(),
      ]);
      setCategories(cats);
      setMenuItems(items.filter(i => i.is_available));

      // Fetch balances for active location to show Option B warnings
      if (currentLocation) {
        const balances = await db.inventory_balances.where('location_id').equals(currentLocation.id).toArray();
        const map = new Map<string, number>();
        balances.forEach(b => map.set(b.inventory_item_id, b.available_quantity));
        setStockMap(map);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadHistory = async () => {
    if (!currentLocation) return;
    const salesList = await salesRepo.getSales({ location_id: currentLocation.id });
    setRecentSales(salesList.slice(0, 30));
  };

  useEffect(() => {
    loadPOSData();
  }, [currentLocation]);

  // Cart actions
  const addToCart = (item: MenuItem) => {
    // Determine price by channel
    let price = item.base_price;
    if (selectedChannel === 'zomato' && item.channel_prices?.zomato) {
      price = item.channel_prices.zomato;
    } else if (selectedChannel === 'swiggy' && item.channel_prices?.swiggy) {
      price = item.channel_prices.swiggy;
    }

    setCart(prev => {
      const existing = prev.find(c => c.menuItem.id === item.id);
      if (existing) {
        return prev.map(c =>
          c.menuItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [
        ...prev,
        {
          menuItem: item,
          quantity: 1,
          unitPrice: price,
          taxRate: item.tax_rate,
          isComplimentary: false,
        },
      ];
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev =>
      prev
        .map(c => (c.menuItem.id === itemId ? { ...c, quantity: c.quantity + delta } : c))
        .filter(c => c.quantity > 0)
    );
  };

  const toggleComplimentary = (itemId: string) => {
    const reason = prompt('Enter reason for complimentary item (e.g. Guest hospitality / Taste test):');
    if (reason === null) return;

    setCart(prev =>
      prev.map(c =>
        c.menuItem.id === itemId
          ? { ...c, isComplimentary: !c.isComplimentary, complimentaryReason: reason || 'Customer hospitality' }
          : c
      )
    );
  };

  // Calculations
  const grossSubtotal = cart.reduce((acc, c) => {
    if (c.isComplimentary) return acc;
    const isInclusive = c.menuItem.is_tax_inclusive !== false;
    const itemTotal = c.unitPrice * c.quantity;
    if (isInclusive) {
      return acc + itemTotal / (1 + c.taxRate / 100);
    }
    return acc + itemTotal;
  }, 0);

  const totalTax = cart.reduce((acc, c) => {
    if (c.isComplimentary) return acc;
    const isInclusive = c.menuItem.is_tax_inclusive !== false;
    const itemTotal = c.unitPrice * c.quantity;
    if (isInclusive) {
      const base = itemTotal / (1 + c.taxRate / 100);
      return acc + (itemTotal - base);
    }
    return acc + (itemTotal * c.taxRate) / 100;
  }, 0);

  let calculatedDiscount = 0;
  if (discountType === 'percentage') {
    calculatedDiscount = (grossSubtotal * discountValue) / 100;
  } else if (discountType === 'fixed') {
    calculatedDiscount = discountValue;
  }
  calculatedDiscount = Math.min(grossSubtotal, calculatedDiscount);

  const netTotal = Math.max(0, grossSubtotal + totalTax - calculatedDiscount);

  // Open Payment Modal
  const openPaymentModal = () => {
    if (cart.length === 0) return;
    // Default cash amount to exact net total
    setCashAmount(netTotal.toFixed(2));
    setUpiAmount('0');
    setCardAmount('0');
    setUpiRef('');
    setIsPayModalOpen(true);
  };

  const handleCompleteOrder = async () => {
    if (!currentLocation) {
      showToast('Please select an active location first', 'warning');
      return;
    }

    const cashNum = parseFloat(cashAmount) || 0;
    const upiNum = parseFloat(upiAmount) || 0;
    const cardNum = parseFloat(cardAmount) || 0;
    const paidSum = cashNum + upiNum + cardNum;

    if (Math.abs(paidSum - netTotal) > 0.01) {
      showToast(`Settlement mismatch: Entered ₹${paidSum.toFixed(2)}, but bill total is ₹${netTotal.toFixed(2)}`, 'error');
      return;
    }

    const payments = [];
    if (cashNum > 0) payments.push({ payment_method: 'cash' as const, amount: cashNum });
    if (upiNum > 0) payments.push({ payment_method: 'upi' as const, amount: upiNum, reference_id: upiRef || undefined });
    if (cardNum > 0) payments.push({ payment_method: 'card' as const, amount: cardNum });

    try {
      const created = await salesRepo.createSale({
        business_id: 'biz_chaatkulture_01',
        location_id: currentLocation.id,
        channel: selectedChannel,
        items: cart.map(c => {
          const isInclusive = c.menuItem.is_tax_inclusive !== false;
          let itemGross: number;
          let itemTax: number;
          let itemTotal: number;

          if (isInclusive) {
            itemTotal = c.unitPrice * c.quantity;
            itemGross = itemTotal / (1 + c.taxRate / 100);
            itemTax = itemTotal - itemGross;
          } else {
            itemGross = c.unitPrice * c.quantity;
            itemTax = (itemGross * c.taxRate) / 100;
            itemTotal = itemGross + itemTax;
          }

          return {
            menu_item_id: c.menuItem.id,
            item_name: c.menuItem.name,
            quantity: c.quantity,
            unit_price: isInclusive ? itemGross / c.quantity : c.unitPrice,
            tax_rate: c.taxRate,
            tax_amount: itemTax,
            total_price: c.isComplimentary ? 0 : itemTotal,
            is_complimentary: c.isComplimentary,
            complimentary_reason: c.complimentaryReason,
          };
        }),
        payments,
        discount_amount: calculatedDiscount,
        discount_type: discountType,
        discount_reason: discountReason || undefined,
        created_by: 'Cashier Staff',
      });

      setCompletedSale(created);
      setIsPayModalOpen(false);
      setCart([]);
      setDiscountType('none');
      setDiscountValue(0);
      showToast(`Bill #${created.order_number} completed & saved to IndexedDB!`, 'success');
      loadHistory();
    } catch (err) {
      console.error(err);
      showToast('Error completing order', 'error');
    }
  };

  const handleProcessRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSaleForRefund) return;

    const amt = parseFloat(refundAmount);
    if (isNaN(amt) || amt <= 0 || amt > selectedSaleForRefund.net_amount) {
      showToast('Please enter a valid refund amount up to bill total', 'warning');
      return;
    }

    if (!refundReason.trim()) {
      showToast('Refund reason is required for audit trail', 'warning');
      return;
    }

    try {
      await salesRepo.processRefund(selectedSaleForRefund.id, {
        refund_amount: amt,
        refund_method: refundMethod,
        reason: refundReason.trim(),
        authorized_by: 'Manager Approved',
      });

      showToast(`Processed ₹${amt} refund for Bill #${selectedSaleForRefund.order_number}`, 'success');
      setSelectedSaleForRefund(null);
      loadHistory();
    } catch (err) {
      console.error(err);
      showToast('Error processing refund', 'error');
    }
  };

  // Filter menu items
  const filteredDishes = menuItems.filter(item => {
    const matchesCat = selectedCategory === 'all' || item.category_id === selectedCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.code && item.code.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-4">
      {/* Top Channel Bar & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-900 border border-slate-800 rounded-2xl">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400">Sales Channel:</span>
          {(['walk_in', 'zomato', 'swiggy', 'other'] as SalesChannel[]).map(ch => (
            <button
              key={ch}
              onClick={() => setSelectedChannel(ch)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                selectedChannel === ch
                  ? ch === 'zomato'
                    ? 'bg-rose-600 text-white'
                    : ch === 'swiggy'
                    ? 'bg-amber-600 text-white'
                    : 'bg-orange-600 text-white'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {ch.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              loadHistory();
              setIsHistoryOpen(true);
            }}
          >
            <History className="w-4 h-4 text-orange-400" />
            <span>Today's Bills & Refunds ({recentSales.length})</span>
          </Button>
        </div>
      </div>

      {/* Main Split View: Left Menu Grid + Right Cart Pad */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Side: Dish Selector */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-3">
          {/* Category Filter Pills & Search */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search dishes (e.g. Sev Puri, Pav Bhaji)..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === 'all'
                    ? 'bg-orange-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-orange-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Dishes Grid */}
          {filteredDishes.length === 0 ? (
            <EmptyState
              icon={<ShoppingCart className="w-8 h-8" />}
              title="No Dishes in Menu"
              description="Your menu catalog is currently empty. Go to Admin Master Data Hub to add dishes."
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredDishes.map(item => {
                const effectivePrice =
                  selectedChannel === 'zomato' && item.channel_prices?.zomato
                    ? item.channel_prices.zomato
                    : selectedChannel === 'swiggy' && item.channel_prices?.swiggy
                    ? item.channel_prices.swiggy
                    : item.base_price;

                return (
                  <div
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className="p-3 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-orange-500/70 rounded-2xl cursor-pointer transition-all flex flex-col justify-between space-y-2 group shadow-sm active:scale-95"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <h4 className="font-bold text-xs text-white group-hover:text-orange-400 transition-colors line-clamp-2">
                          {item.name}
                        </h4>
                        <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                          {item.is_tax_inclusive !== false ? `${item.tax_rate}% incl.` : `+${item.tax_rate}%`}
                        </span>
                      </div>
                      {item.code && (
                        <span className="text-[10px] text-slate-400 font-mono block">{item.code}</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                      <span className="font-bold text-sm text-orange-400 font-mono">
                        ₹{effectivePrice.toFixed(2)}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-orange-600/20 text-orange-400 font-bold group-hover:bg-orange-600 group-hover:text-white transition-all">
                        + Add
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Running Order Pad */}
        <div className="lg:col-span-5 xl:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-4 shadow-xl">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-orange-400" />
                  <span>Current Bill Order</span>
                </h3>
                <span className="text-[11px] text-slate-400">
                  Channel: <strong className="text-orange-400 uppercase">{selectedChannel.replace('_', ' ')}</strong>
                </span>
              </div>

              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-xs text-rose-400 hover:text-rose-300 font-semibold"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Cart Items List */}
            {cart.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                Tap items on the left to add them to the bill.
              </div>
            ) : (
              <div className="divide-y divide-slate-800 max-h-72 overflow-y-auto text-xs my-2">
                {cart.map(c => {
                  const itemTotal = c.isComplimentary ? 0 : c.unitPrice * c.quantity;
                  return (
                    <div key={c.menuItem.id} className="py-2.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-white">{c.menuItem.name}</span>
                          {c.isComplimentary && (
                            <span className="ml-2 text-[10px] text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded font-bold">
                              COMPLIMENTARY
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-white font-mono">
                          {c.isComplimentary ? '₹0.00' : `₹${itemTotal.toFixed(2)}`}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-400">
                        <span className="text-[11px] font-mono">
                          ₹{c.unitPrice} × {c.quantity} (+{c.taxRate}% GST)
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleComplimentary(c.menuItem.id)}
                            className="p-1 text-slate-400 hover:text-emerald-400"
                            title="Toggle complimentary item"
                          >
                            <Gift className="w-3.5 h-3.5" />
                          </button>
                          <div className="flex items-center gap-1.5 bg-slate-950 px-1.5 py-0.5 rounded-lg border border-slate-800">
                            <button
                              onClick={() => updateQuantity(c.menuItem.id, -1)}
                              className="text-slate-400 hover:text-white"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-bold text-white px-1">{c.quantity}</span>
                            <button
                              onClick={() => updateQuantity(c.menuItem.id, 1)}
                              className="text-slate-400 hover:text-white"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Calculations Breakdown */}
            {cart.length > 0 && (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Gross Subtotal:</span>
                  <span>₹{grossSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Total Configurable GST:</span>
                  <span>₹{totalTax.toFixed(2)}</span>
                </div>
                {calculatedDiscount > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Discount Applied:</span>
                    <span>-₹{calculatedDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-white text-base pt-1.5 border-t border-slate-800">
                  <span>Net Payable:</span>
                  <span className="text-orange-400">₹{netTotal.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            {cart.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const val = prompt('Enter fixed discount amount (₹):');
                    if (val) {
                      setDiscountType('fixed');
                      setDiscountValue(parseFloat(val) || 0);
                      setDiscountReason(prompt('Discount Reason:') || 'Manager Courtesy');
                    }
                  }}
                  className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1"
                >
                  <Tag className="w-3 h-3 text-orange-400" />
                  <span>Discount</span>
                </button>
              </div>
            )}

            <Button
              variant="primary"
              size="lg"
              disabled={cart.length === 0}
              onClick={openPaymentModal}
              className="w-full py-3"
            >
              <span>Settlement & Split Payment</span>
              <span className="font-mono text-sm opacity-90">(₹{netTotal.toFixed(2)})</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Split Payment Modal */}
      <Modal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        title="Split Payment Settlement"
        subtitle={`Total to settle: ₹${netTotal.toFixed(2)}`}
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1 text-xs">
            <div className="flex justify-between font-bold text-slate-300">
              <span>Required Bill Amount:</span>
              <span className="text-white font-mono">₹{netTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-300">
              <span>Entered Total:</span>
              <span className="text-emerald-400 font-mono">
                ₹{((parseFloat(cashAmount) || 0) + (parseFloat(upiAmount) || 0) + (parseFloat(cardAmount) || 0)).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <Input
              label="Cash Amount (₹)"
              type="number"
              step="0.01"
              value={cashAmount}
              onChange={e => setCashAmount(e.target.value)}
              placeholder="0.00"
            />

            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Merchant UPI / QR (₹)"
                type="number"
                step="0.01"
                value={upiAmount}
                onChange={e => setUpiAmount(e.target.value)}
                placeholder="0.00"
              />
              <Input
                label="UPI Ref # (Optional)"
                value={upiRef}
                onChange={e => setUpiRef(e.target.value)}
                placeholder="e.g. 984210"
              />
            </div>

            <Input
              label="Card / Other Payment (₹)"
              type="number"
              step="0.01"
              value={cardAmount}
              onChange={e => setCardAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button variant="secondary" onClick={() => setIsPayModalOpen(false)}>
              Back to Cart
            </Button>
            <Button variant="success" onClick={handleCompleteOrder}>
              <CheckCircle2 className="w-4 h-4" />
              <span>Complete & Save Bill</span>
            </Button>
          </div>
        </div>
      </Modal>

      {/* Completed Receipt Modal */}
      <Modal
        isOpen={!!completedSale}
        onClose={() => setCompletedSale(null)}
        title="Order Completed Successfully"
        subtitle={`Order #${completedSale?.order_number}`}
        maxWidth="sm"
      >
        {completedSale && (
          <div className="space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto text-xl">
              ✓
            </div>

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-left text-xs font-mono space-y-2">
              <div className="text-center font-bold text-white border-b border-slate-800 pb-2">
                CHAAT KULTURE
                <div className="text-[10px] text-slate-400 font-normal">{currentLocation?.name}</div>
              </div>

              <div className="space-y-1">
                {completedSale.items?.map(it => (
                  <div key={it.id} className="flex justify-between">
                    <span>{it.quantity} × {it.item_name}</span>
                    <span>₹{it.total_price.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Gross:</span>
                  <span>₹{completedSale.gross_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>GST:</span>
                  <span>₹{completedSale.tax_amount.toFixed(2)}</span>
                </div>
                {completedSale.discount_amount > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Discount:</span>
                    <span>-₹{completedSale.discount_amount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-white text-sm pt-1 border-t border-slate-800">
                  <span>Net Paid:</span>
                  <span>₹{completedSale.net_amount.toFixed(2)}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-500 text-center">
                TxID: {completedSale.client_tx_id} (IndexedDB Synced)
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => window.print()}
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Bill</span>
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="flex-1"
                onClick={() => setCompletedSale(null)}
              >
                Next Order
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Today's Sales History & Refund Drawer */}
      <Modal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        title="Today's Registered Orders"
        subtitle={`Location: ${currentLocation?.name}`}
        maxWidth="xl"
      >
        <div className="space-y-4">
          {recentSales.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              No orders registered at this location today.
            </div>
          ) : (
            <div className="divide-y divide-slate-800 max-h-96 overflow-y-auto">
              {recentSales.map(sale => (
                <div key={sale.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white font-mono">{sale.order_number}</span>
                      <Badge
                        variant={
                          sale.payment_status === 'completed'
                            ? 'success'
                            : sale.payment_status === 'partially_refunded'
                            ? 'warning'
                            : 'danger'
                        }
                        size="sm"
                      >
                        {sale.payment_status.toUpperCase()}
                      </Badge>
                      <span className="text-[10px] text-slate-400 uppercase font-bold">
                        {sale.channel}
                      </span>
                    </div>
                    <div className="text-slate-400 text-[11px] mt-0.5">
                      {sale.items?.map(i => `${i.quantity}× ${i.item_name}`).join(', ')}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white text-sm">
                      ₹{sale.net_amount.toFixed(2)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCompletedSale(sale)}
                      className="text-orange-400 hover:text-orange-300"
                      title="View Bill Slip & Print"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>Receipt</span>
                    </Button>
                    {sale.payment_status === 'completed' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedSaleForRefund(sale);
                          setRefundAmount(sale.net_amount.toString());
                          setRefundReason('');
                        }}
                        className="text-rose-400 hover:text-rose-300"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Refund</span>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Process Refund Modal */}
      <Modal
        isOpen={!!selectedSaleForRefund}
        onClose={() => setSelectedSaleForRefund(null)}
        title="Authorize Refund (PRD Section 7)"
        subtitle={`Order #${selectedSaleForRefund?.order_number} (Max: ₹${selectedSaleForRefund?.net_amount.toFixed(2)})`}
        maxWidth="md"
      >
        <form onSubmit={handleProcessRefund} className="space-y-4">
          <Input
            label="Refund Amount (₹) *"
            type="number"
            step="0.01"
            value={refundAmount}
            onChange={e => setRefundAmount(e.target.value)}
            required
          />

          <Select
            label="Refund Method *"
            value={refundMethod}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRefundMethod(e.target.value as any)}
            options={[
              { value: 'cash', label: 'Cash Refund' },
              { value: 'upi', label: 'UPI / Bank Reversal' },
              { value: 'card', label: 'Card Reversal' },
            ]}
          />

          <Input
            label="Mandatory Reason for Refund *"
            placeholder="e.g. Customer cancelled order / Quality dissatisfaction"
            value={refundReason}
            onChange={e => setRefundReason(e.target.value)}
            required
          />

          <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-amber-300 text-xs">
            🛡️ <strong>Audit Rule:</strong> The original sale transaction will <strong>never be deleted</strong>. The refund is linked to the bill and recorded in the audit log.
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setSelectedSaleForRefund(null)}>
              Cancel
            </Button>
            <Button variant="danger" type="submit">
              Confirm Refund
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
