import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { cashTransfersRepo } from '../../lib/dal/cashTransfersRepo';
import { CashTransferToOwner, Location } from '../../types';
import { Banknote, CheckCircle, ArrowRight } from 'lucide-react';

interface CashTransfersModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: Location;
  closingDate: string;
  onTransferRecorded: () => void;
}

export const CashTransfersModal: React.FC<CashTransfersModalProps> = ({
  isOpen,
  onClose,
  location,
  closingDate,
  onTransferRecorded,
}) => {
  const [transfers, setTransfers] = useState<CashTransferToOwner[]>([]);
  const [recipientName, setRecipientName] = useState('Aditya Sharma (Owner)');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash_handover' | 'bank_deposit' | 'upi_transfer'>('cash_handover');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTransfers();
    }
  }, [isOpen, location.id, closingDate]);

  const loadTransfers = async () => {
    const list = await cashTransfersRepo.getTransfersForDate(location.id, closingDate);
    setTransfers(list);
  };

  const handleRecordTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Please enter a valid transfer amount.');
      return;
    }

    try {
      setIsSubmitting(true);
      await cashTransfersRepo.create({
        from_location_id: location.id,
        recipient_name: recipientName,
        amount: numAmount,
        transfer_date: closingDate,
        payment_method: paymentMethod,
        reference_number: referenceNumber.trim() || undefined,
        is_confirmed: false,
        recorded_by: 'Staff',
      });

      setAmount('');
      setReferenceNumber('');
      setNotes('');
      await loadTransfers();
      onTransferRecorded();
    } catch (err: any) {
      alert(err.message || 'Failed to record cash transfer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalTransferred = transfers.reduce((sum, t) => sum + (t.amount || 0), 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Owner Cash Handover & Deposits — ${location.name}`} maxWidth="2xl">
      <div className="space-y-6">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300">
          <strong>PRD Section 13 Accounting Rule:</strong> Cash handed over to the owner or deposited to the bank drawer is strictly separated from operational expenses. It deducts from the cash drawer without distorting the Profit & Loss statement.
        </div>

        {/* Form to log transfer */}
        <form onSubmit={handleRecordTransfer} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-4">
          <h4 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
            <Banknote className="w-4 h-4 text-emerald-400" />
            Record New Cash Transfer
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-neutral-400 mb-1 block">Recipient</label>
              <Input
                value={recipientName}
                onChange={e => setRecipientName(e.target.value)}
                placeholder="Owner / Bank Name"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-400 mb-1 block">Amount (₹)</label>
              <Input
                type="number"
                step="any"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Amount handed over"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-neutral-400 mb-1 block">Handover Method</label>
              <Select
                value={paymentMethod}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPaymentMethod(e.target.value as any)}
                options={[
                  { value: 'cash_handover', label: 'Cash Handover to Owner' },
                  { value: 'bank_deposit', label: 'Cash Deposited to Bank' },
                  { value: 'upi_transfer', label: 'UPI / Direct Transfer' },
                ]}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-400 mb-1 block">Reference / Receipt / Slip No.</label>
              <Input
                value={referenceNumber}
                onChange={e => setReferenceNumber(e.target.value)}
                placeholder="Optional deposit slip or note"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Recording...' : 'Record Cash Transfer'}
            </Button>
          </div>
        </form>

        {/* Existing transfers for date */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              Recorded Handover Records ({closingDate})
            </h4>
            <span className="text-xs font-semibold text-emerald-400">
              Total: ₹{totalTransferred.toLocaleString()}
            </span>
          </div>

          {transfers.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-neutral-800 rounded-xl text-neutral-500 text-xs">
              No cash transfers recorded yet for this date.
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {transfers.map(t => (
                <div
                  key={t.id}
                  className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-medium text-neutral-200 flex items-center gap-2">
                      <span>{t.recipient_name}</span>
                      <span className="text-[10px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded capitalize">
                        {t.payment_method.replace('_', ' ')}
                      </span>
                    </div>
                    {t.reference_number && (
                      <div className="text-neutral-500 text-[11px]">Ref: {t.reference_number}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-emerald-400 text-sm">₹{t.amount.toLocaleString()}</div>
                    <div className="text-[10px] text-neutral-500 flex items-center justify-end gap-1">
                      <CheckCircle className="w-3 h-3 text-neutral-400" />
                      Recorded
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};
