import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { db } from '../../lib/db';
import { purchasesRepo } from '../../lib/dal/purchasesRepo';
import { suppliersRepo } from '../../lib/dal/suppliersRepo';
import { inventoryRepo } from '../../lib/dal/inventoryRepo';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  Receipt,
  Plus,
  Building2,
  CreditCard,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Boxes,
  Eye,
  Edit2,
  Trash2,
  Printer,
  Lock,
} from 'lucide-react';
import type { Purchase, PurchaseItem, Supplier, InventoryItem, Location } from '../../types';

export const PurchasesManager: React.FC = () => {
  const { locations, currentLocation, accessibleLocations, currentRole, showToast } = useApp();

  const isScoped = currentRole !== 'owner' && currentRole !== 'manager';
  const accessibleLocIds = useMemo(() => accessibleLocations.map(l => l.id), [accessibleLocations]);

  const [activeTab, setActiveTab] = useState<'invoices' | 'ledgers'>('invoices');
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Item Controls & Modals State
  const [viewingPurchase, setViewingPurchase] = useState<Purchase | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [editInvoiceNum, setEditInvoiceNum] = useState<string>('');
  const [editInvoiceDate, setEditInvoiceDate] = useState<string>('');
  const [editPurchaseNotes, setEditPurchaseNotes] = useState<string>('');
  const [voidingPurchase, setVoidingPurchase] = useState<Purchase | null>(null);
  const [voidPurchaseReason, setVoidPurchaseReason] = useState<string>('');
  const [voidingPayment, setVoidingPayment] = useState<any | null>(null);
  const [voidPaymentReason, setVoidPaymentReason] = useState<string>('');

  // Selected supplier for Ledger view
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [supplierLedgerData, setSupplierLedgerData] = useState<any>(null);

  // Add Purchase Modal
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState<boolean>(false);
  const [formSupplierId, setFormSupplierId] = useState<string>('');
  const [formLocationId, setFormLocationId] = useState<string>('loc_stor_02'); // Default Central Store Room
  const [formInvoiceNum, setFormInvoiceNum] = useState<string>('');
  const [formInvoiceDate, setFormInvoiceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formDiscount, setFormDiscount] = useState<string>('0');
  const [formPaidAmount, setFormPaidAmount] = useState<string>('0');
  const [formPayMethod, setFormPayMethod] = useState<'bank_transfer' | 'cash' | 'upi' | 'cheque'>('bank_transfer');
  const [formNotes, setFormNotes] = useState<string>('');
  const [purchaseLines, setPurchaseLines] = useState<
    { itemId: string; qty: string; rate: string; taxRate: string }[]
  >([{ itemId: '', qty: '', rate: '', taxRate: '0' }]);

  // Record Payment Modal
  const [isPayModalOpen, setIsPayModalOpen] = useState<boolean>(false);
  const [paySupId, setPaySupId] = useState<string>('');
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<'bank_transfer' | 'cash' | 'upi' | 'cheque'>('bank_transfer');
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [payRef, setPayRef] = useState<string>('');
  const [payNotes, setPayNotes] = useState<string>('');

  const loadData = async () => {
    try {
      const [allPurchases, allSuppliers, allItems] = await Promise.all([
        purchasesRepo.getPurchases(),
        suppliersRepo.getAll(),
        inventoryRepo.getItems(),
      ]);
      setPurchases(allPurchases);
      setSuppliers(allSuppliers);
      setInventoryItems(allItems);

      if (allSuppliers.length > 0 && !formSupplierId) {
        setFormSupplierId(allSuppliers[0].id);
        if (!selectedSupplierId) {
          setSelectedSupplierId(allSuppliers[0].id);
        }
      }
      if (allItems.length > 0 && !purchaseLines[0].itemId) {
        setPurchaseLines([{ itemId: allItems[0].id, qty: '10', rate: (allItems[0].cost_per_unit || 50).toString(), taxRate: '0' }]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedSupplierId) {
      purchasesRepo.getSupplierLedger(selectedSupplierId).then(data => {
        setSupplierLedgerData(data);
      }).catch(console.error);
    }
  }, [selectedSupplierId, purchases]);

  // Handle Save Purchase Bill
  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSupplierId || !formInvoiceNum.trim()) {
      showToast('Supplier and Invoice Number are required', 'warning');
      return;
    }

    const validLines = purchaseLines.filter(l => l.itemId && parseFloat(l.qty) > 0 && parseFloat(l.rate) >= 0);
    if (validLines.length === 0) {
      showToast('Please specify at least one valid line item with quantity and rate', 'warning');
      return;
    }

    try {
      const created = await purchasesRepo.createPurchase({
        business_id: 'biz_chaatkulture_01',
        supplier_id: formSupplierId,
        receiving_location_id: formLocationId,
        invoice_number: formInvoiceNum.trim(),
        invoice_date: formInvoiceDate,
        discount_amount: parseFloat(formDiscount) || 0,
        paid_amount: parseFloat(formPaidAmount) || 0,
        payment_method: formPayMethod,
        notes: formNotes.trim(),
        created_by: 'Inventory Manager',
        items: validLines.map(l => {
          const itm = inventoryItems.find(i => i.id === l.itemId);
          const qty = parseFloat(l.qty);
          const rate = parseFloat(l.rate);
          const taxPct = parseFloat(l.taxRate) || 0;
          const gross = qty * rate;
          const tax = (gross * taxPct) / 100;
          return {
            inventory_item_id: l.itemId,
            item_name: itm?.name || 'Raw Material',
            quantity: qty,
            unit: itm?.base_unit || 'unit',
            rate,
            tax_amount: tax,
            total_amount: gross + tax,
          };
        }),
      });

      showToast(`Purchase Invoice #${created.invoice_number} recorded! Stock auto-inwarded to receiving location.`, 'success');
      setIsPurchaseModalOpen(false);
      setFormInvoiceNum('');
      setFormPaidAmount('0');
      setFormNotes('');
      await loadData();
    } catch (err) {
      console.error(err);
      showToast('Error recording purchase invoice', 'error');
    }
  };

  // Handle Save Supplier Payment
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(payAmount);
    if (!paySupId || isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid payment amount', 'warning');
      return;
    }

    try {
      await purchasesRepo.recordSupplierPayment({
        business_id: 'biz_chaatkulture_01',
        supplier_id: paySupId,
        amount: amt,
        payment_method: payMethod,
        payment_date: payDate,
        reference_id: payRef.trim() || undefined,
        notes: payNotes.trim() || undefined,
        created_by: 'Owner Account',
      });

      showToast(`Recorded payment of ₹${amt.toFixed(2)} to supplier! Outstanding balance reduced.`, 'success');
      setIsPayModalOpen(false);
      setPayAmount('');
      setPayRef('');
      setPayNotes('');
      await loadData();
    } catch (err) {
      console.error(err);
      showToast('Error recording supplier payment', 'error');
    }
  };

  // Handle Void / Delete Supplier Payment
  const handleVoidPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidingPayment?.id || !voidPaymentReason.trim()) {
      showToast('Please state a reason for voiding this payment', 'warning');
      return;
    }
    try {
      await purchasesRepo.deleteSupplierPayment(voidingPayment.id, voidPaymentReason.trim(), currentRole);
      showToast(`Voided payment of ₹${voidingPayment.credit.toFixed(2)}. Supplier balance recalculated.`, 'success');
      setVoidingPayment(null);
      setVoidPaymentReason('');
      await loadData();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error voiding supplier payment', 'error');
    }
  };

  const filteredPurchases = purchases.filter(p => {
    if (isScoped && !accessibleLocIds.includes(p.receiving_location_id)) return false;
    const sup = suppliers.find(s => s.id === p.supplier_id);
    return (
      p.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sup && sup.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">Purchases & Supplier Payables</h2>
          <p className="text-xs text-slate-400">
            Vendor purchase invoices, auto-inward of raw materials, and supplier payment ledgers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => {
            if (suppliers.length > 0) setPaySupId(suppliers[0].id);
            setIsPayModalOpen(true);
          }}>
            <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
            <span>+ Settle Supplier Dues</span>
          </Button>

          <Button variant="primary" size="sm" onClick={() => setIsPurchaseModalOpen(true)}>
            <Plus className="w-3.5 h-3.5" />
            <span>+ Record Purchase Invoice</span>
          </Button>
        </div>
      </div>

      {/* Outlet Scoped Warning Banner */}
      {isScoped && (
        <div className="flex items-center gap-2 p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-xs text-amber-300">
          <Lock className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <span className="font-bold">Outlet Scoped Purchases:</span> Showing purchase bills received strictly at{' '}
            <strong className="text-white">
              {accessibleLocations.map(l => `${l.name} (${l.code})`).join(', ')}
            </strong>
            . Invoices for other locations are isolated.
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold w-fit">
        <button
          onClick={() => setActiveTab('invoices')}
          className={`px-4 py-1.5 rounded-lg transition-all ${
            activeTab === 'invoices' ? 'bg-orange-600 text-white font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          Purchase Invoices ({filteredPurchases.length})
        </button>
        <button
          onClick={() => setActiveTab('ledgers')}
          className={`px-4 py-1.5 rounded-lg transition-all ${
            activeTab === 'ledgers' ? 'bg-orange-600 text-white font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          Supplier Statements & Ledgers
        </button>
      </div>

      {/* TAB 1: Invoices List */}
      {activeTab === 'invoices' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="Search by invoice number or supplier name..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
            />
          </div>

          {filteredPurchases.length === 0 ? (
            <EmptyState
              icon={<Receipt className="w-8 h-8" />}
              title="No Purchase Invoices Found"
              description="Click '+ Record Purchase Invoice' to enter vendor purchase bills. Stock will automatically be added to your Central Store Room or receiving outlet."
              actionLabel="+ Record Purchase Bill"
              onAction={() => setIsPurchaseModalOpen(true)}
            />
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Invoice #</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Supplier</th>
                      <th className="py-3 px-4">Inward Location</th>
                      <th className="py-3 px-4 text-right">Total Bill</th>
                      <th className="py-3 px-4 text-right">Paid</th>
                      <th className="py-3 px-4 text-right">Outstanding Dues</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredPurchases.map(p => {
                      const sup = suppliers.find(s => s.id === p.supplier_id);
                      const loc = locations.find(l => l.id === p.receiving_location_id);

                      return (
                        <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-orange-400">
                            {p.invoice_number}
                          </td>
                          <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                            {p.invoice_date}
                          </td>
                          <td className="py-3 px-4 font-bold text-white">
                            {sup ? sup.name : p.supplier_id}
                          </td>
                          <td className="py-3 px-4 text-slate-300 font-mono">
                            {loc ? loc.code : p.receiving_location_id}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-white text-sm">
                            ₹{p.total_amount.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                            ₹{p.paid_amount.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                            ₹{p.outstanding_balance.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge
                              variant={
                                p.payment_status === 'paid'
                                  ? 'success'
                                  : p.payment_status === 'partially_paid'
                                  ? 'warning'
                                  : 'danger'
                              }
                              size="sm"
                            >
                              {p.payment_status.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setViewingPurchase(p)}
                                title="View Itemized Bill Slip"
                                className="text-orange-400 hover:text-orange-300"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Bill</span>
                              </Button>

                              {p.outstanding_balance > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setPaySupId(p.supplier_id);
                                    setPayAmount(p.outstanding_balance.toString());
                                    setPayNotes(`Payment for Bill #${p.invoice_number}`);
                                    setIsPayModalOpen(true);
                                  }}
                                  className="text-emerald-400 hover:text-emerald-300"
                                  title="Pay Dues"
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                  <span>Pay</span>
                                </Button>
                              )}

                              {(currentRole === 'owner' || currentRole === 'manager') && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingPurchase(p);
                                    setEditInvoiceNum(p.invoice_number);
                                    setEditInvoiceDate(p.invoice_date);
                                    setEditPurchaseNotes(p.notes || '');
                                  }}
                                  title="Edit Bill Details"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                                </Button>
                              )}

                              {currentRole === 'owner' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setVoidingPurchase(p);
                                    setVoidPurchaseReason('');
                                  }}
                                  title="Void Bill & Reverse Stock"
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
        </div>
      )}

      {/* TAB 2: Supplier Statements & Ledgers */}
      {activeTab === 'ledgers' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-2xl">
            <div className="w-full sm:w-80">
              <label className="block text-xs font-semibold text-slate-300 mb-1">Select Supplier:</label>
              <Select
                value={selectedSupplierId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedSupplierId(e.target.value)}
                options={suppliers.map(s => ({
                  value: s.id,
                  label: `${s.name} ${
                    s.current_outstanding > 0
                      ? `(Due: ₹${s.current_outstanding.toFixed(2)})`
                      : s.current_outstanding < 0
                      ? `(Advance: ₹${Math.abs(s.current_outstanding).toFixed(2)})`
                      : '(Settled)'
                  }`,
                }))}
              />
            </div>

            {supplierLedgerData && (
              <div className="flex gap-4 text-xs">
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Opening Balance</span>
                  <span className="font-mono font-bold text-white text-sm">
                    ₹{supplierLedgerData.openingBalance.toFixed(2)}
                  </span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">
                    {supplierLedgerData.currentOutstanding > 0
                      ? 'Current Outstanding Dues'
                      : supplierLedgerData.currentOutstanding < 0
                      ? 'Advance Balance with Vendor'
                      : 'Settlement Status'}
                  </span>
                  <span
                    className={`font-mono font-bold text-sm ${
                      supplierLedgerData.currentOutstanding > 0
                        ? 'text-amber-400'
                        : supplierLedgerData.currentOutstanding < 0
                        ? 'text-emerald-400'
                        : 'text-slate-300'
                    }`}
                  >
                    {supplierLedgerData.currentOutstanding > 0
                      ? `₹${supplierLedgerData.currentOutstanding.toFixed(2)}`
                      : supplierLedgerData.currentOutstanding < 0
                      ? `₹${Math.abs(supplierLedgerData.currentOutstanding).toFixed(2)} (Advance)`
                      : 'All Settled (₹0.00)'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Chronological Statement Table */}
          {supplierLedgerData && supplierLedgerData.ledger.length > 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Reference / Description</th>
                      <th className="py-3 px-4 text-right">Debit (Purchases +)</th>
                      <th className="py-3 px-4 text-right">Credit (Payments -)</th>
                      <th className="py-3 px-4 text-right">Running Outstanding</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {supplierLedgerData.ledger.map((entry: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-400">{entry.date}</td>
                        <td className="py-3 px-4">
                          <Badge variant={entry.type === 'purchase' ? 'danger' : 'success'} size="sm">
                            {entry.type === 'purchase' ? 'BILL' : 'PAYMENT'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-white font-medium">{entry.description}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-rose-400">
                          {entry.debit > 0 ? `+₹${entry.debit.toFixed(2)}` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                          {entry.credit > 0 ? `-₹${entry.credit.toFixed(2)}` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-sm bg-slate-950/40">
                          {entry.runningBalance > 0 ? (
                            <span className="text-amber-400">₹{entry.runningBalance.toFixed(2)}</span>
                          ) : entry.runningBalance < 0 ? (
                            <span className="text-emerald-400">₹{Math.abs(entry.runningBalance).toFixed(2)} Adv</span>
                          ) : (
                            <span className="text-slate-400">₹0.00</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {entry.type === 'payment' && entry.id ? (
                            <Button
                              variant="danger"
                              size="sm"
                              className="!p-1.5"
                              title="Void / Delete Payment"
                              onClick={() => setVoidingPayment(entry)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<Building2 className="w-8 h-8" />}
              title="No Ledger History for Selected Supplier"
              description="Record a purchase invoice or log a payment to view this vendor's statement."
            />
          )}
        </div>
      )}

      {/* Record Purchase Invoice Modal */}
      <Modal
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        title="Record Supplier Purchase Invoice"
        subtitle="Auto-inwards raw materials into receiving location & updates vendor ledger"
        maxWidth="xl"
      >
        <form onSubmit={handleSavePurchase} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Supplier Vendor *"
              value={formSupplierId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormSupplierId(e.target.value)}
              options={suppliers.map(s => ({ value: s.id, label: s.name }))}
            />

            <Select
              label="Receiving Location (Auto-Inward) *"
              value={formLocationId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormLocationId(e.target.value)}
              options={(isScoped ? accessibleLocations : locations).map(l => ({ value: l.id, label: `${l.name} (${l.code})` }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Supplier Invoice Number *"
              placeholder="e.g. INV-2026-9041"
              value={formInvoiceNum}
              onChange={e => setFormInvoiceNum(e.target.value)}
              required
            />
            <Input
              label="Invoice Date *"
              type="date"
              value={formInvoiceDate}
              onChange={e => setFormInvoiceDate(e.target.value)}
              required
            />
          </div>

          {/* Line items */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">Purchase Line Items *</label>
            {purchaseLines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <div className="col-span-5">
                  <Select
                    value={line.itemId}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                      const updated = [...purchaseLines];
                      updated[idx].itemId = e.target.value;
                      const itm = inventoryItems.find(i => i.id === e.target.value);
                      if (itm?.cost_per_unit) updated[idx].rate = itm.cost_per_unit.toString();
                      setPurchaseLines(updated);
                    }}
                    options={inventoryItems.map(i => ({ value: i.id, label: `${i.name} (${i.base_unit})` }))}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Qty"
                    value={line.qty}
                    onChange={e => {
                      const updated = [...purchaseLines];
                      updated[idx].qty = e.target.value;
                      setPurchaseLines(updated);
                    }}
                    required
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Rate ₹"
                    value={line.rate}
                    onChange={e => {
                      const updated = [...purchaseLines];
                      updated[idx].rate = e.target.value;
                      setPurchaseLines(updated);
                    }}
                    required
                  />
                </div>
                <div className="col-span-2 text-right font-mono font-bold text-white text-xs">
                  ₹{((parseFloat(line.qty) || 0) * (parseFloat(line.rate) || 0)).toFixed(2)}
                </div>
                <div className="col-span-1 text-center">
                  {purchaseLines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setPurchaseLines(prev => prev.filter((_, i) => i !== idx))}
                      className="text-slate-500 hover:text-rose-400 font-bold"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setPurchaseLines(prev => [...prev, { itemId: inventoryItems[0]?.id || '', qty: '10', rate: '50', taxRate: '0' }])}
              className="text-xs text-orange-400 hover:text-orange-300 font-semibold"
            >
              + Add Another Line Item
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <Input
              label="Immediate Upfront Payment (₹)"
              type="number"
              step="0.01"
              value={formPaidAmount}
              onChange={e => setFormPaidAmount(e.target.value)}
              helperText="Leave 0 if full invoice is on credit"
            />

            <Select
              label="Payment Method"
              value={formPayMethod}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormPayMethod(e.target.value as any)}
              options={[
                { value: 'bank_transfer', label: 'Bank RTGS / NEFT' },
                { value: 'upi', label: 'UPI QR' },
                { value: 'cash', label: 'Cash Payment' },
                { value: 'cheque', label: 'Cheque' },
              ]}
            />
          </div>

          <div className="p-3 bg-emerald-950/40 border border-emerald-800 rounded-xl text-emerald-300 text-xs">
            📦 <strong>Auto-Inward Guarantee:</strong> Saving this bill will <strong>automatically increase stock</strong> of the selected items at the receiving location and append a <code>purchase_receipt</code> to the movement ledger.
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setIsPurchaseModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Bill & Inward Stock
            </Button>
          </div>
        </form>
      </Modal>

      {/* Settle Supplier Dues Modal */}
      <Modal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        title="Record Supplier Payment"
        subtitle="Reduces vendor outstanding dues & logs into ledger"
        maxWidth="md"
      >
        <form onSubmit={handleSavePayment} className="space-y-4">
          <Select
            label="Supplier *"
            value={paySupId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPaySupId(e.target.value)}
            options={suppliers.map(s => ({
              value: s.id,
              label: `${s.name} ${
                s.current_outstanding > 0
                  ? `(Due: ₹${s.current_outstanding.toFixed(2)})`
                  : s.current_outstanding < 0
                  ? `(Advance: ₹${Math.abs(s.current_outstanding).toFixed(2)})`
                  : '(Settled)'
              }`,
            }))}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Payment Amount (₹) *"
              type="number"
              step="0.01"
              value={payAmount}
              onChange={e => setPayAmount(e.target.value)}
              placeholder="e.g. 5000.00"
              required
            />

            <Select
              label="Payment Mode *"
              value={payMethod}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPayMethod(e.target.value as any)}
              options={[
                { value: 'bank_transfer', label: 'Bank Transfer / RTGS' },
                { value: 'upi', label: 'UPI' },
                { value: 'cash', label: 'Cash' },
                { value: 'cheque', label: 'Cheque' },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Payment Date *"
              type="date"
              value={payDate}
              onChange={e => setPayDate(e.target.value)}
              required
            />
            <Input
              label="Bank Ref / Cheque # (Optional)"
              placeholder="e.g. UTR-982187"
              value={payRef}
              onChange={e => setPayRef(e.target.value)}
            />
          </div>

          <Input
            label="Notes / Description"
            placeholder="e.g. Weekly settlement against milk bills"
            value={payNotes}
            onChange={e => setPayNotes(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setIsPayModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="success" type="submit">
              Confirm Payment
            </Button>
          </div>
        </form>
      </Modal>

      {/* 1. Itemized Purchase Bill Slip Modal */}
      <Modal
        isOpen={!!viewingPurchase}
        onClose={() => setViewingPurchase(null)}
        title="Purchase Bill Slip"
        subtitle={`Invoice #${viewingPurchase?.invoice_number}`}
        maxWidth="lg"
      >
        {viewingPurchase && (
          <div className="space-y-4 text-xs font-mono">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <div>
                  <h3 className="font-bold text-sm text-white">CHAAT KULTURE</h3>
                  <p className="text-[10px] text-slate-400">Inward Purchase Invoice Breakdown</p>
                </div>
                <div className="text-right">
                  <span className="text-orange-400 font-bold block">{viewingPurchase.invoice_number}</span>
                  <span className="text-[10px] text-slate-400">{viewingPurchase.invoice_date}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500 block">SUPPLIER:</span>
                  <span className="font-bold text-white">
                    {suppliers.find(s => s.id === viewingPurchase.supplier_id)?.name || viewingPurchase.supplier_id}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">RECEIVING LOCATION:</span>
                  <span className="font-bold text-emerald-400">
                    {locations.find(l => l.id === viewingPurchase.receiving_location_id)?.name || viewingPurchase.receiving_location_id}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">PAYMENT STATUS:</span>
                  <span className="font-bold uppercase text-white">{viewingPurchase.payment_status.replace('_', ' ')}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">ENTERED BY:</span>
                  <span className="text-slate-200">{viewingPurchase.created_by || 'Inventory Manager'}</span>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-2">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-1">Item</th>
                      <th className="py-1 text-right">Qty</th>
                      <th className="py-1 text-right">Rate</th>
                      <th className="py-1 text-right">Tax</th>
                      <th className="py-1 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {viewingPurchase.items?.map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-1 text-slate-200">{it.item_name || it.inventory_item_id}</td>
                        <td className="py-1 text-right font-bold text-white">{it.quantity} {it.unit}</td>
                        <td className="py-1 text-right text-slate-300">₹{it.rate.toFixed(2)}</td>
                        <td className="py-1 text-right text-slate-400">₹{it.tax_amount.toFixed(2)}</td>
                        <td className="py-1 text-right font-bold text-white">₹{it.total_amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-800 pt-2 flex justify-between items-center text-xs">
                <div className="text-slate-400">
                  {viewingPurchase.notes && <div><strong>Notes:</strong> {viewingPurchase.notes}</div>}
                </div>
                <div className="space-y-1 text-right">
                  <div><span className="text-slate-400">Total Invoice:</span> <strong className="text-white">₹{viewingPurchase.total_amount.toFixed(2)}</strong></div>
                  <div><span className="text-slate-400">Paid Amount:</span> <strong className="text-emerald-400">₹{viewingPurchase.paid_amount.toFixed(2)}</strong></div>
                  <div><span className="text-slate-400">Outstanding:</span> <strong className="text-amber-400">₹{viewingPurchase.outstanding_balance.toFixed(2)}</strong></div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => window.print()}>
                <Printer className="w-3.5 h-3.5" />
                <span>Print Bill</span>
              </Button>
              <Button variant="primary" size="sm" onClick={() => setViewingPurchase(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 2. Edit Purchase Invoice Modal */}
      <Modal
        isOpen={!!editingPurchase}
        onClose={() => setEditingPurchase(null)}
        title="Edit Purchase Invoice"
        subtitle={`Invoice #${editingPurchase?.invoice_number}`}
        maxWidth="md"
      >
        <form
          onSubmit={async e => {
            e.preventDefault();
            if (!editingPurchase || !editInvoiceNum.trim()) return;
            try {
              await purchasesRepo.updatePurchase(
                editingPurchase.id,
                {
                  invoice_number: editInvoiceNum.trim(),
                  invoice_date: editInvoiceDate,
                  notes: editPurchaseNotes.trim() || undefined,
                },
                currentRole
              );
              showToast(`Updated Purchase Bill #${editInvoiceNum}`, 'success');
              setEditingPurchase(null);
              await loadData();
            } catch (err: any) {
              showToast(err.message || 'Error updating purchase', 'error');
            }
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Invoice Number *"
              value={editInvoiceNum}
              onChange={e => setEditInvoiceNum(e.target.value)}
              required
            />
            <Input
              label="Invoice Date *"
              type="date"
              value={editInvoiceDate}
              onChange={e => setEditInvoiceDate(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Invoice Notes</label>
            <textarea
              value={editPurchaseNotes}
              onChange={e => setEditPurchaseNotes(e.target.value)}
              rows={3}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setEditingPurchase(null)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* 3. Void Purchase Invoice Modal */}
      <Modal
        isOpen={!!voidingPurchase}
        onClose={() => setVoidingPurchase(null)}
        title="Void Purchase Invoice"
        subtitle={`Invoice #${voidingPurchase?.invoice_number}`}
        maxWidth="md"
      >
        <form
          onSubmit={async e => {
            e.preventDefault();
            if (!voidingPurchase || !voidPurchaseReason.trim()) {
              showToast('Please state a reason for voiding', 'warning');
              return;
            }
            try {
              await purchasesRepo.deletePurchase(voidingPurchase.id, voidPurchaseReason.trim(), currentRole);
              showToast(`Voided Purchase Bill #${voidingPurchase.invoice_number}. Inward stock & supplier dues reversed.`, 'success');
              setVoidingPurchase(null);
              await loadData();
            } catch (err: any) {
              showToast(err.message || 'Error voiding purchase', 'error');
            }
          }}
          className="space-y-4"
        >
          <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300">
            ⚠️ <strong>Atomic Rollback:</strong> Deleting this purchase invoice will deduct all inwarded item quantities from the receiving location's stock balance, reduce the supplier's outstanding dues by ₹{voidingPurchase?.outstanding_balance.toFixed(2)}, and log an immutable reversal in the movement ledger.
          </div>

          <Input
            label="Mandatory Reason for Voiding *"
            placeholder="e.g. Duplicate invoice entry / Goods rejected upon receipt"
            value={voidPurchaseReason}
            onChange={e => setVoidPurchaseReason(e.target.value)}
            required
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setVoidingPurchase(null)}>
              Cancel
            </Button>
            <Button variant="danger" type="submit">
              Confirm Stock Reversal & Void
            </Button>
          </div>
        </form>
      </Modal>

      {/* 4. Void Supplier Payment Modal */}
      <Modal
        isOpen={!!voidingPayment}
        onClose={() => setVoidingPayment(null)}
        title="Void Supplier Payment"
        subtitle={`Payment of ₹${voidingPayment?.credit ? Number(voidingPayment.credit).toFixed(2) : '0.00'}`}
        maxWidth="md"
      >
        <form onSubmit={handleVoidPayment} className="space-y-4">
          <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300">
            ⚠️ <strong>Payment Reversal:</strong> Deleting this payment entry will deduct ₹{voidingPayment?.credit ? Number(voidingPayment.credit).toFixed(2) : '0.00'} from the credit statement, reverse any linked invoice settlements, and restore the supplier's balance.
          </div>

          <Input
            label="Mandatory Reason for Voiding Payment *"
            placeholder="e.g. Duplicate payment punched / Wrong amount"
            value={voidPaymentReason}
            onChange={e => setVoidPaymentReason(e.target.value)}
            required
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setVoidingPayment(null)}>
              Cancel
            </Button>
            <Button variant="danger" type="submit">
              Confirm Payment Reversal & Void
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
