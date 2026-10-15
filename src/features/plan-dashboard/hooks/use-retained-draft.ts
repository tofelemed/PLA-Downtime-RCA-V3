import { useEffect, useState } from 'react';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import { retainedPeriodDrafts } from '../model/retained-period-drafts';
import { usePeriodDraftOwner } from './use-period-draft-owner';
import type { DraftEditor } from './use-draft-editor';

/** Offer the old snapshot explicitly, including its original concurrency preconditions. */
export function useRetainedDraft(view: ReconciliationView, editor: DraftEditor, editable: boolean, returnPath: string) {
  const owner = usePeriodDraftOwner();
  const key = `${view.periodId}:${view.revision.id}`;
  const [pending, setPending] = useState(() => editable ? retainedPeriodDrafts.read(owner, key) : null);
  const [, refresh] = useState(0);
  const { rowVersion, baseRunId } = editor.base;
  useEffect(() => {
    if (editable && !pending) retainedPeriodDrafts.write(owner, key, { draft: editor.draft, rowVersion, baseRunId, returnPath });
  }, [owner, key, editable, pending, editor.draft, rowVersion, baseRunId, returnPath]);
  const otherDrafts = retainedPeriodDrafts.list(owner).filter((entry) => entry.key !== key || !editable);
  return {
    pending: editable ? pending : null,
    atCapacity: retainedPeriodDrafts.atCapacity(owner, key),
    otherDrafts,
    discardOther: (otherKey: string) => { retainedPeriodDrafts.clear(owner, otherKey); refresh((n) => n + 1); },
    changed: pending !== null && (pending.rowVersion !== view.rowVersion || pending.baseRunId !== view.baseRunId),
    restore: () => {
      if (editable && pending) editor.restore(pending);
      setPending(null);
    },
    discard: () => {
      retainedPeriodDrafts.clear(owner, key);
      setPending(null);
      editor.discard();
    },
  };
}
