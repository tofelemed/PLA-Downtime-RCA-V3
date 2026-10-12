import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { friendlyToastContent } from '@/features/ux-kit/errors';
import { useToast } from '@/hooks/use-toast';
import type { RcaCauseView } from '../api/master-data-types';
import { RCA_CAUSES } from '../api/record-resource';
import { useChangeRecord, useRecordLifecycle } from '../api/use-record-commands';
import { useRecordLookup } from '../api/use-record-queries';
import { CauseDialog } from './cause-dialog';
import { MoveNodeDialog } from './move-node-dialog';

export type PendingCause =
  | { kind: 'add'; parent: RcaCauseView | null }
  | { kind: 'edit' | 'move' | 'retire'; cause: RcaCauseView };

function CauseMoveDialog({ cause, onClose }: { cause: RcaCauseView; onClose: () => void }) {
  const { toast } = useToast();
  const all = useRecordLookup<RcaCauseView>(RCA_CAUSES, { status: 'active', sort: 'code' });
  const change = useChangeRecord<{ parentId: string | null }, RcaCauseView>(RCA_CAUSES);
  const move = async (parentId: string | null) => {
    try {
      await change.submit({ record: cause, body: { parentId } });
      toast({ title: 'Cause moved' });
    } catch (error) {
      toast({ ...friendlyToastContent(error), variant: 'destructive' });
      throw error;
    }
  };
  return (
    <MoveNodeDialog
      name={cause.name}
      currentParentId={cause.parentId}
      targets={all.items.filter((entry) => entry.id !== cause.id).map((entry) => ({ id: entry.id, label: `${entry.code} — ${entry.name}` }))}
      onMove={move}
      onClose={onClose}
    />
  );
}

function CauseRetireDialog({ cause, onClose }: { cause: RcaCauseView; onClose: () => void }) {
  const { toast } = useToast();
  const retire = useRecordLifecycle<RcaCauseView>(RCA_CAUSES, 'retire');
  const run = async () => {
    try {
      await retire.submit({ id: cause.id });
      toast({ title: 'Cause retired' });
    } catch (error) {
      toast({ ...friendlyToastContent(error), variant: 'destructive' });
      throw error;
    }
  };
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Retire ${cause.name}?`}
      description="RCAs that named it keep it; it can no longer be picked. A cause with active sub-causes cannot be retired."
      confirmLabel="Retire cause"
      destructive
      onConfirm={run}
    />
  );
}

/** The one open dialog of the cause library (add, edit, move, retire). */
export function CauseDialogs({ pending, onClose }: { pending: PendingCause | null; onClose: () => void }) {
  if (!pending) return null;
  if (pending.kind === 'add') return <CauseDialog cause={null} parent={pending.parent} onClose={onClose} />;
  if (pending.kind === 'edit') return <CauseDialog cause={pending.cause} parent={null} onClose={onClose} />;
  if (pending.kind === 'move') return <CauseMoveDialog cause={pending.cause} onClose={onClose} />;
  return <CauseRetireDialog cause={pending.cause} onClose={onClose} />;
}
