import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { dailyClosingRepo } from '../../lib/dal/dailyClosingRepo';
import { RecordRevision } from '../../types';
import { History, Calendar, User, FileText } from 'lucide-react';

interface RevisionsHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  closingId: string;
}

export const RevisionsHistoryModal: React.FC<RevisionsHistoryModalProps> = ({
  isOpen,
  onClose,
  closingId,
}) => {
  const [revisions, setRevisions] = useState<RecordRevision[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadRevisions();
    }
  }, [isOpen, closingId]);

  const loadRevisions = async () => {
    setLoading(true);
    const list = await dailyClosingRepo.getRevisions(closingId);
    setRevisions(list.sort((a, b) => b.revision_number - a.revision_number));
    setLoading(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Closing Revision & Audit History" maxWidth="2xl">
      <div className="space-y-4">
        <p className="text-xs text-neutral-400">
          Showing all authorized modifications, re-openings, and previous snapshots captured under PRD Section 14.
        </p>

        {loading ? (
          <div className="text-center py-6 text-neutral-500 text-xs">Loading audit logs...</div>
        ) : revisions.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-neutral-800 rounded-xl text-neutral-500 text-xs">
            No revisions logged. This closing has maintained its original state without modifications.
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {revisions.map(rev => (
              <div key={rev.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-amber-400 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    Revision #{rev.revision_number}
                  </span>
                  <span className="text-neutral-500 text-[11px] flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(rev.created_at).toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-neutral-300">
                  <User className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Authorized by: <strong className="text-neutral-200">{rev.modified_by || 'Unknown'}</strong></span>
                </div>

                <div className="bg-neutral-950 border border-neutral-800/80 rounded-lg p-2.5">
                  <div className="text-[11px] text-neutral-400 font-medium mb-1 flex items-center gap-1">
                    <FileText className="w-3 h-3 text-amber-400" />
                    Reason Given:
                  </div>
                  <div className="text-neutral-200 italic">{rev.change_reason}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
