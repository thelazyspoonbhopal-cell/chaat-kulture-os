import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { suppliersRepo } from '../../lib/dal/suppliersRepo';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { Plus, Search, Building2, Edit2, Phone, MapPin, ToggleLeft, ToggleRight } from 'lucide-react';
import type { Supplier } from '../../types';

export const SuppliersMaster: React.FC = () => {
  const { showToast, refreshData, currentRole } = useApp();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Form
  const [formName, setFormName] = useState<string>('');
  const [formContact, setFormContact] = useState<string>('');
  const [formPhone, setFormPhone] = useState<string>('');
  const [formAddress, setFormAddress] = useState<string>('');
  const [formGstin, setFormGstin] = useState<string>('');
  const [formTerms, setFormTerms] = useState<string>('Cash on Delivery');
  const [formOpeningBal, setFormOpeningBal] = useState<string>('0');
  const [formNotes, setFormNotes] = useState<string>('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await suppliersRepo.getAll();
      setSuppliers(data);
    } catch (err) {
      console.error(err);
      showToast('Error loading suppliers', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = () => {
    setEditingSupplier(null);
    setFormName('');
    setFormContact('');
    setFormPhone('');
    setFormAddress('');
    setFormGstin('');
    setFormTerms('Cash on Delivery');
    setFormOpeningBal('0');
    setFormNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (sup: Supplier) => {
    setEditingSupplier(sup);
    setFormName(sup.name);
    setFormContact(sup.contact_person || '');
    setFormPhone(sup.phone);
    setFormAddress(sup.address || '');
    setFormGstin(sup.gstin || '');
    setFormTerms(sup.payment_terms || 'Cash on Delivery');
    setFormOpeningBal(sup.opening_balance.toString());
    setFormNotes(sup.notes || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) {
      showToast('Supplier name and phone number are required', 'warning');
      return;
    }

    const openingNum = parseFloat(formOpeningBal) || 0;

    try {
      if (editingSupplier) {
        await suppliersRepo.update(editingSupplier.id, {
          name: formName.trim(),
          contact_person: formContact.trim(),
          phone: formPhone.trim(),
          address: formAddress.trim(),
          gstin: formGstin.trim(),
          payment_terms: formTerms.trim(),
          opening_balance: openingNum,
          notes: formNotes.trim(),
        });
        showToast(`Updated supplier: ${formName}`, 'success');
      } else {
        await suppliersRepo.add({
          business_id: 'biz_chaatkulture_01',
          name: formName.trim(),
          contact_person: formContact.trim(),
          phone: formPhone.trim(),
          address: formAddress.trim(),
          gstin: formGstin.trim(),
          payment_terms: formTerms.trim(),
          opening_balance: openingNum,
          notes: formNotes.trim(),
          is_active: true,
        });
        showToast(`Created supplier: ${formName}`, 'success');
      }

      setIsModalOpen(false);
      await loadData();
      await refreshData();
    } catch (err) {
      console.error(err);
      showToast('Error saving supplier', 'error');
    }
  };

  const handleToggleActive = async (sup: Supplier) => {
    try {
      await suppliersRepo.toggleActive(sup.id, !sup.is_active);
      showToast(`${sup.name} status updated`, 'info');
      await loadData();
    } catch (err) {
      console.error(err);
      showToast('Error updating supplier status', 'error');
    }
  };

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.phone.includes(searchTerm) ||
    (s.contact_person && s.contact_person.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">Suppliers Directory & Ledgers</h2>
          <p className="text-xs text-slate-400">
            Manage raw material vendors, contact details, payment terms, and outstanding payables.
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={openAddModal}>
          <Plus className="w-4 h-4" />
          <span>+ Add Supplier</span>
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
        <input
          type="text"
          placeholder="Search suppliers by name, phone or contact person..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
        />
      </div>

      {/* Table or Empty State */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-8 h-8" />}
          title={suppliers.length === 0 ? 'No Suppliers Registered Yet' : 'No matching suppliers found'}
          description={
            suppliers.length === 0
              ? 'Your supplier directory starts completely blank. Click "+ Add Supplier" to record your dairy agency, vegetable mandi vendors, or packaging suppliers.'
              : 'Try searching with another phone number or vendor name.'
          }
          actionLabel={suppliers.length === 0 ? '+ Add First Supplier' : undefined}
          onAction={suppliers.length === 0 ? openAddModal : undefined}
        />
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Supplier Name</th>
                  <th className="py-3 px-4">Contact Person</th>
                  <th className="py-3 px-4">Phone & City</th>
                  <th className="py-3 px-4">Payment Terms</th>
                  <th className="py-3 px-4 text-right">Outstanding Balance</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filtered.map(sup => (
                  <tr key={sup.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>{sup.name}</span>
                        {sup.is_demo && <Badge variant="warning">Demo</Badge>}
                      </div>
                      {sup.gstin && <span className="text-[10px] text-slate-400 font-mono">GST: {sup.gstin}</span>}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {sup.contact_person || <span className="text-slate-500">—</span>}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      <div className="flex items-center gap-1 font-mono text-emerald-400">
                        <Phone className="w-3 h-3" />
                        <span>{sup.phone}</span>
                      </div>
                      {sup.address && (
                        <div className="text-[10px] text-slate-400 truncate max-w-xs">{sup.address}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] font-medium border border-slate-700">
                        {sup.payment_terms || 'Cash on Delivery'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold">
                      {sup.current_outstanding > 0 ? (
                        <span className="text-amber-400">₹{sup.current_outstanding.toFixed(2)}</span>
                      ) : (
                        <span className="text-emerald-400">₹0.00</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggleActive(sup)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold"
                      >
                        {sup.is_active ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <ToggleRight className="w-4 h-4" /> Active
                          </span>
                        ) : (
                          <span className="text-slate-500 flex items-center gap-1">
                            <ToggleLeft className="w-4 h-4" /> Inactive
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {(currentRole === 'owner' || currentRole === 'manager') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(sup)}
                          className="p-1 h-auto text-slate-300 hover:text-white"
                          title="Edit Supplier (Manager & Super Admin)"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
        subtitle="Record vendor contact, payment terms, and opening dues"
        maxWidth="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Supplier / Agency Name *"
              placeholder="e.g. Bhopal Central Dairy & Amul Agency"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              required
            />
            <Input
              label="Contact Person Name"
              placeholder="e.g. Rameshwar Ji"
              value={formContact}
              onChange={e => setFormContact(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Phone Number *"
              placeholder="e.g. 9826199881"
              value={formPhone}
              onChange={e => setFormPhone(e.target.value)}
              required
            />
            <Input
              label="GSTIN Number (Optional)"
              placeholder="e.g. 23AAAAA0000A1Z5"
              value={formGstin}
              onChange={e => setFormGstin(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Payment Terms"
              placeholder="e.g. Weekly Net 7 or Cash on Delivery"
              value={formTerms}
              onChange={e => setFormTerms(e.target.value)}
            />
            <Input
              label="Opening Outstanding Balance (₹)"
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 0.00"
              value={formOpeningBal}
              onChange={e => setFormOpeningBal(e.target.value)}
              helperText="Prior dues carried forward into the ledger"
            />
          </div>

          <Input
            label="Mandi / Shop Address"
            placeholder="e.g. Wholesale Mandi Gate 2, Karond, Bhopal"
            value={formAddress}
            onChange={e => setFormAddress(e.target.value)}
          />

          <Input
            label="Internal Notes"
            placeholder="e.g. Supplies fresh milk, curd, and Amul butter blocks every morning"
            value={formNotes}
            onChange={e => setFormNotes(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              {editingSupplier ? 'Save Changes' : 'Create Supplier'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
