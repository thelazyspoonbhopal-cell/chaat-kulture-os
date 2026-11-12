import React, { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { dailyClosingRepo } from '../../lib/dal/dailyClosingRepo';
import { AlertTriangle, LockOpen, History } from 'lucide-react';

interface ReopenClosingModalProps {
  isOpen: boolean;
  onClose: () => void;
  closingId: string;
  onReopened: () => void;
}

export const ReopenClosingModal: React.FC<ReopenClosingModalProps> = ({
  isOpen,
  onClose,
  closingId,
  onReopened,
}) => {
  const [reopenReason, setReopenReason] = useState('');
  const [authorizedBy, setAuthorizedBy] = useState('Aditya Sharma (Owner)');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReopen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenReason.trim()) {
      setError('A mandatory reason is required by PRD Section 14 to reopen a finalized closing.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await dailyClosingRepo.reopenDailyClosing(closingId, authorizedBy, reopenReason);
      setReopenReason('');
      onReopened();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to reopen closing.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Authorize Reopening of Finalized Daily Closing" maxWidth="lg">
      <form onSubmit={handleReopen} className="space-y-4">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-semibold">Strict Audit Protocol:</strong>
            Reopening a finalized closing requires a formal business reason. An immutable snapshot of the existing submission will be preserved in the revision history before unlocking the records.
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400">
            {error}
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-neutral-400 mb-1 block">Authorized Manager / Owner</label>
          <Input
            value={authorizedBy}
            onChange={e => setAuthorizedBy(e.target.value)}
            placeholder="Name of authorizer"
            required
          />
        </div>

        <div>
          <label className="text-xs font-medium text-neutral-400 mb-1 block">
            Mandatory Business Reason for Reopening <span className="text-red-400">*</span>
          </label>
          <textarea
            value={reopenReason}
            onChange={e => setReopenReason(e.target.value)}
            rows={3}
            placeholder="e.g. Late-night cash expense of ₹250 was missed, or physical stock count correction for Paneer..."
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500/50"
            required
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting} className="bg-amber-600 hover:bg-amber-500 text-white">
            <LockOpen className="w-4 h-4 mr-1.5" />
            {isSubmitting ? 'Unlocking...' : 'Confirm Reopen'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
