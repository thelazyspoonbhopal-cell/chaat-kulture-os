import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { db } from '../../lib/db';
import { expensesRepo } from '../../lib/dal/expensesRepo';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  FileSpreadsheet,
  Plus,
  CreditCard,
  Search,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  Clock,
  Eye,
  Edit2,
  Trash2,
  Printer,
  Camera,
  Upload,
  X,
  Maximize2,
  FileText,
} from 'lucide-react';
import type { Expense, ExpenseCategory, ExpensePayment, Location } from '../../types';

export const ExpensesManager: React.FC = () => {
  const { locations, currentLocation, currentRole, showToast } = useApp();
  const isStaff = currentRole === 'outlet_staff' || currentRole === 'kitchen_manager';

  const [activeTab, setActiveTab] = useState<'expenses' | 'credit'>('expenses');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [selectedLocFilter, setSelectedLocFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Item Controls & Modals State
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editDesc, setEditDesc] = useState<string>('');
  const [editPayee, setEditPayee] = useState<string>('');
  const [editDueDate, setEditDueDate] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editReceiptImages, setEditReceiptImages] = useState<string[]>([]);
  const [voidingExpense, setVoidingExpense] = useState<Expense | null>(null);
  const [voidExpenseReason, setVoidExpenseReason] = useState<string>('');

  // Lightbox Image Preview
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Add Expense Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [formLocId, setFormLocId] = useState<string>(currentLocation?.id || 'loc_shah_03');
  const [formCatId, setFormCatId] = useState<string>('');
  const [formDesc, setFormDesc] = useState<string>('');
  const [formAmount, setFormAmount] = useState<string>('');
  const [formPayStatus, setFormPayStatus] = useState<'paid' | 'unpaid' | 'partially_paid'>('paid');
  const [formPaidAmount, setFormPaidAmount] = useState<string>('');
  const [formPayMethod, setFormPayMethod] = useState<'cash' | 'upi' | 'bank_transfer' | 'other'>('cash');
  const [formPayee, setFormPayee] = useState<string>('');
  const [formDueDate, setFormDueDate] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formNotes, setFormNotes] = useState<string>('');
  const [formReceiptImages, setFormReceiptImages] = useState<string[]>([]);
  const [isHandwritten, setIsHandwritten] = useState<boolean>(false);

  // Settle Credit Modal
  const [settlingExpense, setSettlingExpense] = useState<Expense | null>(null);
  const [settleAmount, setSettleAmount] = useState<string>('');
  const [settleMethod, setSettleMethod] = useState<'cash' | 'upi' | 'bank_transfer' | 'cheque'>('upi');
  const [settleDate, setSettleDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [settleRef, setSettleRef] = useState<string>('');
  const [settleNotes, setSettleNotes] = useState<string>('');

  const loadData = async () => {
    try {
      const [allExpenses, allCats] = await Promise.all([
        expensesRepo.getExpenses(),
        expensesRepo.getCategories(),
      ]);
      setExpenses(allExpenses);
      setCategories(allCats);

      if (allCats.length > 0 && !formCatId) {
        setFormCatId(allCats[0].id);
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

  const openAddExpenseModal = () => {
    setFormLocId(currentLocation?.id || locations[0]?.id || 'loc_shah_03');
    setFormDesc('');
    setFormAmount('');
    setFormPaidAmount('');
    setFormPayee('');
    setFormNotes('');
    setFormReceiptImages([]);
    setIsHandwritten(false);
    setFormPayStatus('paid');
    setFormPayMethod('cash');
    setIsAddModalOpen(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) {
        showToast('Only image files (JPG, PNG, WebP) are supported', 'warning');
        return;
      }
      const reader = new FileReader();
      reader.onload = ev => {
        if (ev.target?.result) {
          const base64 = ev.target.result as string;
          setFormReceiptImages(prev => [...prev, base64]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setFormReceiptImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleEditImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) {
        showToast('Only image files (JPG, PNG, WebP) are supported', 'warning');
        return;
      }
      const reader = new FileReader();
      reader.onload = ev => {
        if (ev.target?.result) {
          const base64 = ev.target.result as string;
          setEditReceiptImages(prev => [...prev, base64]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeEditImage = (index: number) => {
    setEditReceiptImages(prev => prev.filter((_, i) => i !== index));
  };

  const openEditExpenseModal = (exp: Expense) => {
    setEditingExpense(exp);
    setEditDesc(exp.description);
    setEditPayee(exp.supplier_payee || exp.vendor_name || '');
    setEditDueDate(exp.due_date || '');
    setEditNotes(exp.notes || '');
    setEditReceiptImages(exp.receipt_images || (exp.receipt_url ? [exp.receipt_url] : []));
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDesc.trim() || !formAmount || !formCatId) {
      showToast('Description, category and amount are required', 'warning');
      return;
    }

    const amt = parseFloat(formAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid expense amount', 'warning');
      return;
    }

    if (formReceiptImages.length === 0 && !formNotes.trim()) {
      showToast('Please provide details/notes explaining the purchase when no bill image is uploaded', 'warning');
      return;
    }

    const creatorLabel =
      currentRole === 'outlet_staff'
        ? `Outlet Staff (${currentLocation?.code || 'Counter'})`
        : currentRole === 'kitchen_manager'
        ? `Kitchen Staff (${currentLocation?.code || 'Kitchen'})`
        : currentRole === 'manager'
        ? 'Manager'
        : 'Super Admin';

    try {
      const created = await expensesRepo.createExpense({
        business_id: 'biz_chaatkulture_01',
        location_id: isStaff ? (currentLocation?.id || formLocId) : formLocId,
        category_id: formCatId,
        description: formDesc.trim(),
        amount: amt,
        payment_method: formPayMethod,
        payment_status: isStaff ? 'paid' : formPayStatus,
        amount_paid: (isStaff || formPayStatus === 'paid') ? amt : parseFloat(formPaidAmount) || 0,
        due_date: isStaff ? undefined : (formDueDate || undefined),
        supplier_payee: formPayee.trim() || undefined,
        receipt_images: formReceiptImages.length > 0 ? formReceiptImages : undefined,
        is_handwritten: isHandwritten || formReceiptImages.length === 0,
        created_by_role: currentRole,
        expense_date: formDate,
        paid_by: creatorLabel,
        notes: formNotes.trim(),
      });

      showToast(`Expense & bill recorded: ₹${amt.toFixed(2)} (${formReceiptImages.length} image(s))`, 'success');
      setIsAddModalOpen(false);
      setFormDesc('');
      setFormAmount('');
      setFormPaidAmount('');
      setFormPayee('');
      setFormNotes('');
      setFormReceiptImages([]);
      setIsHandwritten(false);
      await loadData();
    } catch (err) {
      console.error(err);
      showToast('Error recording expense', 'error');
    }
  };

  const handleSettleCreditPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingExpense) return;

    const amt = parseFloat(settleAmount);
    if (isNaN(amt) || amt <= 0 || amt > (settlingExpense.outstanding_balance || settlingExpense.amount)) {
      showToast('Please enter a valid settlement amount up to outstanding balance', 'warning');
      return;
    }

    try {
      await expensesRepo.recordExpensePayment(settlingExpense.id, {
        amount: amt,
        payment_method: settleMethod,
        payment_date: settleDate,
        reference_number: settleRef.trim() || undefined,
        notes: settleNotes.trim() || undefined,
        paid_by: 'Authorized Manager',
      });

      showToast(`Settled ₹${amt.toFixed(2)} against credit expense! Outstanding reduced.`, 'success');
      setSettlingExpense(null);
      await loadData();
    } catch (err) {
      console.error(err);
      showToast('Error settling credit expense', 'error');
    }
  };

  // Scoped filtering: Staff ONLY sees expenses and bills uploaded at their outlet or by staff
  const filteredExpenses = expenses.filter(exp => {
    if (isStaff) {
      const staffLocId = currentLocation?.id;
      if (staffLocId && exp.location_id !== staffLocId) return false;

      const isStaffCreated =
        exp.created_by_role === 'outlet_staff' ||
        exp.created_by_role === 'kitchen_manager' ||
        (exp.paid_by && (exp.paid_by.includes('Staff') || exp.paid_by.includes('Outlet') || exp.paid_by.includes('Kitchen') || exp.paid_by.includes('Counter')));

      // Exclude management-only commercial expenses (e.g. rent, electricity, commercial vendor payables)
      const isManagementCorp = (exp.created_by_role === 'owner' || exp.created_by_role === 'manager') && !isStaffCreated;
      if (isManagementCorp) return false;
    } else {
      const matchesLoc = selectedLocFilter === 'all' || exp.location_id === selectedLocFilter;
      if (!matchesLoc) return false;
    }

    const matchesSearch =
      exp.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (exp.supplier_payee && exp.supplier_payee.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (exp.notes && exp.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSearch;
  });

  const creditExpenses = expenses.filter(e => e.payment_status === 'unpaid' || e.payment_status === 'partially_paid');
  const totalCreditDues = creditExpenses.reduce((acc, e) => acc + (e.outstanding_balance || 0), 0);

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">
            {isStaff ? 'Outlet Expenses & Petty Cash Bills' : 'Expenses & Credit Payables'}
          </h2>
          <p className="text-xs text-slate-400">
            {isStaff
              ? 'Upload bill photos, record local raw material purchases, transport, gas, or handwritten expense notes.'
              : 'Outlet operational expenses, gas cylinders, utilities, and credit expense settlement ledgers.'}
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={openAddExpenseModal}>
          <Plus className="w-3.5 h-3.5" />
          <span>{isStaff ? '+ Upload Bill / Record Expense' : '+ Record Expense'}</span>
        </Button>
      </div>

      {/* Tabs / Scoped View */}
      {!isStaff ? (
        <div className="flex gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold w-fit">
          <button
            onClick={() => setActiveTab('expenses')}
            className={`px-4 py-1.5 rounded-lg transition-all ${
              activeTab === 'expenses' ? 'bg-orange-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            All Expenses ({expenses.length})
          </button>
          <button
            onClick={() => setActiveTab('credit')}
            className={`px-4 py-1.5 rounded-lg transition-all ${
              activeTab === 'credit' ? 'bg-orange-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Credit Payables ({creditExpenses.length}) • Due ₹{totalCreditDues.toFixed(2)}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="info" size="sm">
            📍 Outlet Scoped View: {currentLocation?.name || 'Assigned Outlet'}
          </Badge>
          <span className="text-slate-400 text-[11px]">
            Showing only expenses and bills logged for this outlet ({filteredExpenses.length})
          </span>
        </div>
      )}

      {/* TAB 1: All Expenses */}
      {activeTab === 'expenses' && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder={isStaff ? "Search outlet bills or item descriptions..." : "Search by description or payee name..."}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
              />
            </div>

            {!isStaff && (
              <div className="w-full sm:w-64">
                <Select
                  value={selectedLocFilter}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedLocFilter(e.target.value)}
                  options={[
                    { value: 'all', label: 'All Locations' },
                    ...locations.map(l => ({ value: l.id, label: `${l.name} (${l.code})` })),
                  ]}
                />
              </div>
            )}
          </div>

          {filteredExpenses.length === 0 ? (
            <EmptyState
              icon={<FileSpreadsheet className="w-8 h-8" />}
              title="No Expenses Recorded"
              description="Click '+ Record Expense' to enter LPG cylinders, fuel, local groceries, cleaning supplies, or rent."
              actionLabel="+ Record Expense"
              onAction={() => setIsAddModalOpen(true)}
            />
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Location</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Description & Payee</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4 text-right">Outstanding</th>
                      <th className="py-3 px-4 text-center">Payment Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredExpenses.map(exp => {
                      const loc = locations.find(l => l.id === exp.location_id);
                      const cat = categories.find(c => c.id === exp.category_id);

                      return (
                        <tr key={exp.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-mono text-slate-300 text-[11px]">
                            {exp.expense_date}
                          </td>
                          <td className="py-3 px-4 text-slate-200 font-bold">
                            {loc ? loc.code : exp.location_id}
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            {cat ? cat.name : 'General'}
                          </td>
                          <td className="py-3 px-4 text-white font-semibold">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{exp.description}</span>
                              {exp.receipt_images && exp.receipt_images.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => setViewingExpense(exp)}
                                  className="inline-flex items-center gap-1 text-[10px] text-cyan-400 bg-cyan-950/70 border border-cyan-800/60 px-1.5 py-0.5 rounded font-mono font-normal hover:bg-cyan-900/60 transition-colors"
                                  title="View bill photos"
                                >
                                  <Camera className="w-3 h-3" />
                                  <span>{exp.receipt_images.length} Photo{exp.receipt_images.length > 1 ? 's' : ''}</span>
                                </button>
                              ) : exp.receipt_url ? (
                                <button
                                  type="button"
                                  onClick={() => setViewingExpense(exp)}
                                  className="inline-flex items-center gap-1 text-[10px] text-cyan-400 bg-cyan-950/70 border border-cyan-800/60 px-1.5 py-0.5 rounded font-mono font-normal hover:bg-cyan-900/60 transition-colors"
                                >
                                  <Camera className="w-3 h-3" />
                                  <span>1 Photo</span>
                                </button>
                              ) : null}
                              {exp.is_handwritten && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-950/70 border border-amber-800/60 px-1.5 py-0.5 rounded font-mono font-normal">
                                  📝 Note Only
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-normal flex items-center gap-2 mt-0.5">
                              {exp.supplier_payee && <span>Payee: {exp.supplier_payee}</span>}
                              {exp.paid_by && <span className="text-slate-500">• {exp.paid_by}</span>}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-white text-sm">
                            ₹{exp.amount.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                            {exp.outstanding_balance && exp.outstanding_balance > 0
                              ? `₹${exp.outstanding_balance.toFixed(2)}`
                              : '₹0.00'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge
                              variant={
                                exp.payment_status === 'paid'
                                  ? 'success'
                                  : exp.payment_status === 'partially_paid'
                                  ? 'warning'
                                  : 'danger'
                              }
                              size="sm"
                            >
                              {exp.payment_status.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setViewingExpense(exp)}
                                title="View Expense Voucher"
                                className="text-orange-400 hover:text-orange-300"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Voucher</span>
                              </Button>

                              {exp.payment_status !== 'paid' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSettlingExpense(exp);
                                    setSettleAmount((exp.outstanding_balance || exp.amount).toString());
                                  }}
                                  className="text-emerald-400 hover:text-emerald-300"
                                >
                                  Settle
                                </Button>
                              )}

                              {(currentRole === 'owner' || currentRole === 'manager') && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditExpenseModal(exp)}
                                  title="Edit Expense"
                                  className="text-amber-400 hover:text-amber-300 font-semibold"
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
                                    setVoidingExpense(exp);
                                    setVoidExpenseReason('');
                                  }}
                                  title="Delete Expense"
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

      {/* TAB 2: Credit Payables & Due Dates */}
      {activeTab === 'credit' && (
        <div className="space-y-4">
          <div className="p-4 bg-amber-950/30 border border-amber-800/60 rounded-2xl flex items-center justify-between text-xs text-amber-200">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <span className="font-bold text-sm text-white">Credit Expenses Accounting Rule (PRD 13):</span>
                <p className="text-amber-300/80 mt-0.5">
                  When a credit expense is logged, payable is recognised immediately. Subsequent payments <strong>reduce the payable without creating a second expense</strong>.
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-amber-400 uppercase font-mono block">Total Payables:</span>
              <span className="font-mono font-black text-white text-base">₹{totalCreditDues.toFixed(2)}</span>
            </div>
          </div>

          {creditExpenses.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="w-8 h-8 text-emerald-400" />}
              title="Zero Outstanding Credit Dues"
              description="All operational expenses are 100% paid. No pending vendor payables."
            />
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Expense Date</th>
                      <th className="py-3 px-4">Due Date</th>
                      <th className="py-3 px-4">Location</th>
                      <th className="py-3 px-4">Payee / Vendor</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4 text-right">Total Bill</th>
                      <th className="py-3 px-4 text-right">Amount Paid</th>
                      <th className="py-3 px-4 text-right">Balance Due</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {creditExpenses.map(exp => {
                      const loc = locations.find(l => l.id === exp.location_id);
                      return (
                        <tr key={exp.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-mono text-slate-400">{exp.expense_date}</td>
                          <td className="py-3 px-4 font-mono font-bold text-amber-400">
                            {exp.due_date || 'No due date'}
                          </td>
                          <td className="py-3 px-4 text-slate-200 font-bold">{loc ? loc.code : exp.location_id}</td>
                          <td className="py-3 px-4 text-white font-bold">{exp.supplier_payee || exp.vendor_name || '—'}</td>
                          <td className="py-3 px-4 text-slate-300">{exp.description}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-white">
                            ₹{exp.amount.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                            ₹{(exp.amount_paid || 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-rose-400 text-sm">
                            ₹{(exp.outstanding_balance || exp.amount).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setViewingExpense(exp)}
                                title="View Expense Voucher"
                                className="text-orange-400 hover:text-orange-300"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="success"
                                size="sm"
                                onClick={() => {
                                  setSettlingExpense(exp);
                                  setSettleAmount((exp.outstanding_balance || exp.amount).toString());
                                }}
                              >
                                Settle
                              </Button>
                              {(currentRole === 'owner' || currentRole === 'manager') && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditExpenseModal(exp)}
                                  title="Edit Expense"
                                  className="text-amber-400 hover:text-amber-300 font-semibold"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                  <span>Edit</span>
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

      {/* Record Expense & Upload Bill Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={isStaff ? 'Upload Outlet Bill / Record Expense' : 'Record Operational Expense & Bill'}
        subtitle={
          isStaff
            ? 'Attach bill photos or enter handwritten details for emergency purchases / petty cash'
            : 'Log utility bills, fuel, LPG, local market purchases, and credit payables'
        }
        maxWidth="lg"
      >
        <form onSubmit={handleSaveExpense} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {isStaff ? (
              <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs">
                <span className="text-slate-500 block text-[10px] uppercase font-mono">Current Outlet:</span>
                <span className="font-bold text-white text-xs">{currentLocation?.name || 'Assigned Outlet'} ({currentLocation?.code})</span>
              </div>
            ) : (
              <Select
                label="Location *"
                value={formLocId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormLocId(e.target.value)}
                options={locations.map(l => ({ value: l.id, label: `${l.name} (${l.code})` }))}
              />
            )}

            <Select
              label="Expense Category *"
              value={formCatId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormCatId(e.target.value)}
              options={categories.map(c => ({ value: c.id, label: c.name }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Item / Purpose Description *"
              placeholder="e.g. 5 kg Lemons & Coriander from local Mandi"
              value={formDesc}
              onChange={e => setFormDesc(e.target.value)}
              required
            />
            <Input
              label="Total Amount Spent (₹) *"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="e.g. 350.00"
              value={formAmount}
              onChange={e => setFormAmount(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {!isStaff ? (
              <Select
                label="Payment Terms / Status *"
                value={formPayStatus}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormPayStatus(e.target.value as any)}
                options={[
                  { value: 'paid', label: 'Paid Immediately' },
                  { value: 'unpaid', label: 'Credit Bill (Pay Later)' },
                  { value: 'partially_paid', label: 'Partially Paid' },
                ]}
              />
            ) : (
              <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs">
                <span className="text-slate-500 block text-[10px] uppercase font-mono">Payment Status:</span>
                <span className="font-bold text-emerald-400">Paid from Counter Till / Cash</span>
              </div>
            )}

            <Select
              label="Payment Mode *"
              value={formPayMethod}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormPayMethod(e.target.value as any)}
              options={[
                { value: 'cash', label: 'Cash (Counter Cash / Till)' },
                { value: 'upi', label: 'UPI QR Scan' },
                { value: 'bank_transfer', label: 'Bank Transfer' },
                { value: 'other', label: 'Other' },
              ]}
            />

            <Input
              label="Payee / Vendor / Shop Name"
              placeholder="e.g. Shahpura Sabzi Mandi Shop #4"
              value={formPayee}
              onChange={e => setFormPayee(e.target.value)}
            />
          </div>

          {!isStaff && formPayStatus !== 'paid' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
              <Input
                label="Amount Paid Upfront (₹)"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formPaidAmount}
                onChange={e => setFormPaidAmount(e.target.value)}
              />
              <Input
                label="Credit Due Date"
                type="date"
                value={formDueDate}
                onChange={e => setFormDueDate(e.target.value)}
              />
            </div>
          )}

          {/* Multiple Bill Image Upload Section */}
          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Attach Bill / Invoice Photos (Multiple Allowed)</span>
                  <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                </label>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Upload paper bills, payment receipts, or photos of the raw material. Multiple images supported.
                </p>
              </div>

              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950 border border-cyan-700/60 text-cyan-300 hover:bg-cyan-900/60 text-xs font-semibold transition-colors shrink-0">
                <Upload className="w-3.5 h-3.5" />
                <span>+ Upload Photos</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Thumbnail previews */}
            {formReceiptImages.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                {formReceiptImages.map((img, idx) => (
                  <div key={idx} className="relative group border border-slate-800 rounded-xl overflow-hidden bg-slate-900 aspect-video shadow-md">
                    <img
                      src={img}
                      alt={`Receipt ${idx + 1}`}
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => setPreviewImage(img)}
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 p-1 bg-rose-600/90 hover:bg-rose-500 text-white rounded-full transition-colors shadow-md"
                      title="Remove image"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <span className="absolute bottom-1 left-1 text-[9px] bg-black/70 text-white px-1.5 py-0.5 rounded font-mono">
                      Photo #{idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Handwritten or Note-Only Toggle */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={isHandwritten || formReceiptImages.length === 0}
                  onChange={e => setIsHandwritten(e.target.checked)}
                  className="rounded border-slate-700 text-orange-600 focus:ring-orange-500 bg-slate-900"
                />
                <span>Handwritten or Note-only Expense (No printed bill required)</span>
              </label>
              {formReceiptImages.length === 0 && (
                <span className="text-[10px] text-amber-400 font-mono">Note mode active</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Expense Date *"
              type="date"
              value={formDate}
              onChange={e => setFormDate(e.target.value)}
              required
            />
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Purchase Details / Reason {formReceiptImages.length === 0 && <span className="text-amber-400">*</span>}
              </label>
              <textarea
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                rows={2}
                placeholder="What was this for, why was it purchased, shop name, or handwritten note explanation..."
                required={formReceiptImages.length === 0}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-800">
            <span className="text-[11px] text-slate-400">
              Role: <strong className="text-white">{isStaff ? 'Outlet Staff' : currentRole === 'manager' ? 'Manager' : 'Super Admin'}</strong>
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" type="button" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                {isStaff ? 'Upload Bill & Save' : 'Save Expense'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Settle Credit Payment Modal */}
      <Modal
        isOpen={!!settlingExpense}
        onClose={() => setSettlingExpense(null)}
        title="Settle Credit Expense Payment"
        subtitle={`Expense: ${settlingExpense?.description} (Due: ₹${(settlingExpense?.outstanding_balance || settlingExpense?.amount)?.toFixed(2)})`}
        maxWidth="md"
      >
        <form onSubmit={handleSettleCreditPayment} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Settlement Amount (₹) *"
              type="number"
              step="0.01"
              value={settleAmount}
              onChange={e => setSettleAmount(e.target.value)}
              required
            />

            <Select
              label="Payment Method *"
              value={settleMethod}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSettleMethod(e.target.value as any)}
              options={[
                { value: 'upi', label: 'UPI QR' },
                { value: 'cash', label: 'Cash' },
                { value: 'bank_transfer', label: 'Bank Transfer' },
                { value: 'cheque', label: 'Cheque' },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Payment Date *"
              type="date"
              value={settleDate}
              onChange={e => setSettleDate(e.target.value)}
              required
            />
            <Input
              label="Payment Reference / Voucher #"
              placeholder="e.g. UPI-Ref-90412"
              value={settleRef}
              onChange={e => setSettleRef(e.target.value)}
            />
          </div>

          <Input
            label="Settlement Notes"
            placeholder="e.g. Partial settlement against Indane cylinder bill"
            value={settleNotes}
            onChange={e => setSettleNotes(e.target.value)}
          />

          <div className="p-3 bg-emerald-950/40 border border-emerald-800 rounded-xl text-emerald-300 text-xs">
            🛡️ <strong>Accounting Integrity:</strong> This settlement records a payment against the existing payable. It will <strong>never create a duplicate expense entry</strong> in your profit and loss report.
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setSettlingExpense(null)}>
              Cancel
            </Button>
            <Button variant="success" type="submit">
              Confirm Settlement
            </Button>
          </div>
        </form>
      </Modal>

      {/* 1. Viewing Expense Voucher Modal */}
      <Modal
        isOpen={!!viewingExpense}
        onClose={() => setViewingExpense(null)}
        title="Expense Payment Voucher & Bill"
        subtitle={`Voucher #${viewingExpense?.id}`}
        maxWidth="lg"
      >
        {viewingExpense && (
          <div className="space-y-4 text-xs font-mono">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <div>
                  <h3 className="font-bold text-sm text-white">CHAAT KULTURE</h3>
                  <p className="text-[10px] text-slate-400">Operating Expense & Bill Voucher</p>
                </div>
                <div className="text-right">
                  <span className="text-orange-400 font-bold block text-sm">₹{viewingExpense.amount.toFixed(2)}</span>
                  <span className="text-[10px] text-slate-400">{viewingExpense.expense_date}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500 block">LOCATION:</span>
                  <span className="font-bold text-slate-200">
                    {locations.find(l => l.id === viewingExpense.location_id)?.name || viewingExpense.location_id}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">CATEGORY:</span>
                  <span className="font-bold text-white">
                    {categories.find(c => c.id === viewingExpense.category_id)?.name || 'General Expense'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">PAYEE / VENDOR:</span>
                  <span className="font-bold text-white">{viewingExpense.supplier_payee || viewingExpense.vendor_name || 'Counter Expense'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">PAYMENT STATUS:</span>
                  <Badge
                    variant={
                      viewingExpense.payment_status === 'paid'
                        ? 'success'
                        : viewingExpense.payment_status === 'partially_paid'
                        ? 'warning'
                        : 'danger'
                    }
                    size="sm"
                  >
                    {viewingExpense.payment_status.toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <span className="text-slate-500 block">LOGGED BY:</span>
                  <span className="font-bold text-cyan-400">{viewingExpense.paid_by || 'Staff'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">OUTSTANDING:</span>
                  <span className="text-rose-400 font-bold">₹{(viewingExpense.outstanding_balance || 0).toFixed(2)}</span>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-2 text-[11px]">
                <span className="text-slate-500 font-bold block mb-0.5">Description / Item:</span>
                <p className="text-white font-sans font-semibold">{viewingExpense.description}</p>
              </div>

              {viewingExpense.notes && (
                <div className="border-t border-slate-800 pt-2 text-slate-300 text-[11px] font-sans">
                  <span className="text-slate-500 font-bold font-mono block mb-0.5">Purchase Details / Notes:</span>
                  <p className="p-2 bg-slate-900 rounded-lg border border-slate-800/80">{viewingExpense.notes}</p>
                </div>
              )}

              {/* Attached Bill Images Section */}
              {viewingExpense.receipt_images && viewingExpense.receipt_images.length > 0 ? (
                <div className="border-t border-slate-800 pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-bold block text-xs flex items-center gap-1.5 font-sans">
                      <Camera className="w-3.5 h-3.5 text-cyan-400" />
                      Attached Bill / Invoice Photos ({viewingExpense.receipt_images.length})
                    </span>
                    <span className="text-[10px] text-cyan-400 font-mono">Click thumbnail to enlarge</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {viewingExpense.receipt_images.map((img, idx) => (
                      <div
                        key={idx}
                        onClick={() => setPreviewImage(img)}
                        className="group relative cursor-pointer border border-slate-800 rounded-xl overflow-hidden bg-slate-900 aspect-video hover:border-cyan-500 transition-all shadow-md"
                      >
                        <img src={img} alt={`Receipt ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-bold gap-1 font-sans">
                          <Maximize2 className="w-3.5 h-3.5" />
                          <span>View Full Photo</span>
                        </div>
                        <span className="absolute bottom-1 left-1 text-[9px] bg-black/70 text-white px-1.5 py-0.5 rounded font-mono">
                          Photo #{idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : viewingExpense.receipt_url ? (
                <div className="border-t border-slate-800 pt-3 space-y-2">
                  <span className="text-slate-300 font-bold block text-xs flex items-center gap-1.5 font-sans">
                    <Camera className="w-3.5 h-3.5 text-cyan-400" />
                    Uploaded Bill Receipt
                  </span>
                  <div
                    onClick={() => setPreviewImage(viewingExpense.receipt_url!)}
                    className="cursor-pointer border border-slate-800 rounded-xl overflow-hidden bg-slate-900 max-h-52 flex items-center justify-center hover:border-cyan-500 shadow-md"
                  >
                    <img src={viewingExpense.receipt_url} alt="Bill Receipt" className="max-h-52 object-contain" />
                  </div>
                </div>
              ) : (
                <div className="border-t border-slate-800 pt-3">
                  <div className="p-3 bg-amber-950/30 border border-amber-800/50 rounded-xl text-amber-300 text-xs flex items-start gap-2.5 font-sans">
                    <span className="text-base">📝</span>
                    <div>
                      <strong className="block text-white">Handwritten / Note-Only Expense</strong>
                      <span>No physical bill was uploaded. Expense authorized and logged with staff explanation.</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => window.print()}>
                <Printer className="w-3.5 h-3.5" />
                <span>Print Voucher</span>
              </Button>
              <Button variant="primary" size="sm" onClick={() => setViewingExpense(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 2. Editing Expense Modal */}
      <Modal
        isOpen={!!editingExpense}
        onClose={() => setEditingExpense(null)}
        title="Edit Expense Record & Bill Photos"
        subtitle={`Expense #${editingExpense?.id}`}
        maxWidth="lg"
      >
        <form
          onSubmit={async e => {
            e.preventDefault();
            if (!editingExpense || !editDesc.trim()) return;
            try {
              await expensesRepo.updateExpense(
                editingExpense.id,
                {
                  description: editDesc.trim(),
                  supplier_payee: editPayee.trim() || undefined,
                  due_date: editDueDate || undefined,
                  notes: editNotes.trim() || undefined,
                  receipt_images: editReceiptImages,
                  is_handwritten: editReceiptImages.length === 0,
                },
                currentRole
              );
              showToast('Updated expense details & bill photos', 'success');
              setEditingExpense(null);
              await loadData();
            } catch (err: any) {
              showToast(err.message || 'Error updating expense', 'error');
            }
          }}
          className="space-y-4"
        >
          <Input
            label="Expense Description *"
            value={editDesc}
            onChange={e => setEditDesc(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Payee / Vendor"
              value={editPayee}
              onChange={e => setEditPayee(e.target.value)}
            />
            <Input
              label="Due Date (if credit)"
              type="date"
              value={editDueDate}
              onChange={e => setEditDueDate(e.target.value)}
            />
          </div>

          {/* Edit Bill Photos */}
          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-cyan-400" />
                  Bill / Invoice Photos ({editReceiptImages.length})
                </span>
                <span className="text-[11px] text-slate-400">Add more photos or delete existing receipt images</span>
              </div>
              <label className="cursor-pointer text-xs px-2.5 py-1 rounded-lg bg-cyan-950 border border-cyan-700/60 text-cyan-300 hover:bg-cyan-900/60 font-semibold flex items-center gap-1">
                <Upload className="w-3.5 h-3.5" />
                <span>+ Upload Photos</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleEditImageUpload}
                  className="hidden"
                />
              </label>
            </div>
            {editReceiptImages.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {editReceiptImages.map((img, idx) => (
                  <div key={idx} className="relative group border border-slate-800 rounded-xl overflow-hidden aspect-video shadow">
                    <img src={img} alt={`Edit Receipt ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeEditImage(idx)}
                      className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-full hover:bg-rose-500 shadow"
                      title="Remove image"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <span className="absolute bottom-1 left-1 text-[9px] bg-black/70 text-white px-1.5 py-0.5 rounded font-mono">
                      Photo #{idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-amber-400/80 italic p-2 bg-amber-950/20 border border-amber-900/40 rounded-lg">
                📝 No bill photos attached (Note-only mode).
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Details & Justification Notes</label>
            <textarea
              value={editNotes}
              onChange={e => setEditNotes(e.target.value)}
              rows={3}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setEditingExpense(null)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* 3. Void / Delete Expense Modal */}
      <Modal
        isOpen={!!voidingExpense}
        onClose={() => setVoidingExpense(null)}
        title="Delete Expense Record"
        subtitle={`Expense #${voidingExpense?.id}`}
        maxWidth="md"
      >
        <form
          onSubmit={async e => {
            e.preventDefault();
            if (!voidingExpense || !voidExpenseReason.trim()) {
              showToast('Please state a reason for deletion', 'warning');
              return;
            }
            try {
              await expensesRepo.deleteExpense(voidingExpense.id, voidExpenseReason.trim(), currentRole);
              showToast('Expense record deleted', 'success');
              setVoidingExpense(null);
              await loadData();
            } catch (err: any) {
              showToast(err.message || 'Error deleting expense', 'error');
            }
          }}
          className="space-y-4"
        >
          <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300">
            ⚠️ <strong>Accounting Notice:</strong> Deleting this expense removes the voucher of ₹{voidingExpense?.amount.toFixed(2)} and any associated settlement payment entries.
          </div>

          <Input
            label="Mandatory Reason for Deletion *"
            placeholder="e.g. Duplicate expense entry / Entered under wrong location"
            value={voidExpenseReason}
            onChange={e => setVoidExpenseReason(e.target.value)}
            required
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setVoidingExpense(null)}>
              Cancel
            </Button>
            <Button variant="danger" type="submit">
              Delete Expense
            </Button>
          </div>
        </form>
      </Modal>

      {/* 4. Lightbox / Full Image Preview Modal */}
      <Modal
        isOpen={!!previewImage}
        onClose={() => setPreviewImage(null)}
        title="Bill / Receipt Image Full View"
        subtitle="Original uploaded receipt file"
        maxWidth="xl"
      >
        {previewImage && (
          <div className="space-y-3">
            <div className="flex items-center justify-center p-2 bg-slate-950 rounded-xl border border-slate-800 max-h-[70vh] overflow-auto">
              <img
                src={previewImage}
                alt="Bill Receipt Full"
                className="max-h-[65vh] w-auto object-contain rounded-lg shadow-lg"
              />
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Click Close or outside to dismiss</span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const w = window.open('');
                    w?.document.write(`<img src="${previewImage}" style="max-width:100%; height:auto;" />`);
                    w?.print();
                  }}
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Photo</span>
                </Button>
                <Button variant="primary" size="sm" onClick={() => setPreviewImage(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
