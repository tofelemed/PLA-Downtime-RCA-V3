import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { v2Keys } from '@/api/v2/queries/query-keys';
import { useSaveDraftLines } from '@/api/v2/queries/period-workflow';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import { draftFromView, DraftState, LineRef, rebaseDraft, toPayload } from '../model/draft-lines';
import { workflowProblemOf, WorkflowProblem } from '../model/workflow-errors';

export const serverKeyOf = (view: ReconciliationView) => `${view.revision.id}:${view.rowVersion}:${view.baseRunId ?? '-'}`;

export const reconciliationKey = (tenantId: string | null, periodId: string) =>
  v2Keys.detail(tenantId ?? '-', 'period-accounting', periodId, 'reconciliation:current');

export const periodRefOf = (view: ReconciliationView) => ({ periodId: view.periodId, unitId: view.unitId, utcStart: view.utcStart, utcEnd: view.utcEnd });

export interface DraftEditor {
  draft: DraftState;
  setDraft: (next: (state: DraftState) => DraftState) => void;
  refs: LineRef[];
  problem: WorkflowProblem | null;
  saving: boolean;
  /** decisions dropped by the last rebase (their candidate is gone from the new run) */
  dropped: string[] | null;
  save: () => Promise<void>;
  /** after 409 RUN_CHANGED / 412: load the latest view and keep the user's lines on top of it */
  rebase: () => Promise<void>;
  dismissProblem: () => void;
  discard: () => void;
}

/**
 * Follows the server view: a new saved state replaces a clean draft; after a rebase — asked for, or because
 * a new run arrived (realtime) while the user was editing — the user's lines are kept on the new run.
 */
function useServerSync(view: ReconciliationView, draft: DraftState, setDraft: (d: DraftState) => void) {
  const [serverKey, setServerKey] = useState(() => serverKeyOf(view));
  const [serverRun, setServerRun] = useState(view.baseRunId);
  const [rebasing, setRebasing] = useState(false);
  const [dropped, setDropped] = useState<string[] | null>(null);
  if (serverKeyOf(view) !== serverKey) {
    setServerKey(serverKeyOf(view));
    setServerRun(view.baseRunId);
    if (rebasing || (draft.dirty && serverRun !== view.baseRunId)) {
      const rebased = rebaseDraft(draft, view);
      setDraft(rebased.state);
      setDropped(rebased.dropped);
      setRebasing(false);
    } else if (!draft.dirty) {
      setDraft(draftFromView(view));
    }
  }
  const accept = (saved: ReconciliationView) => {
    setServerKey(serverKeyOf(saved));
    setServerRun(saved.baseRunId);
    setDropped(null);
  };
  return { accept, setRebasing, dropped, setDropped };
}

/**
 * Editing state of one draft revision (plan 3.5 step 2): the user's decisions and manual lines, the atomic
 * save (`PUT …/draft-lines` with If-Match and baseRunId), the refused-save problem and the rebase after a
 * conflict. A failed save changes nothing on the server (T33) and keeps the user's unsaved lines.
 */
export function useDraftEditor(view: ReconciliationView): DraftEditor {
  const tenantId = useV2TenantId();
  const queryClient = useQueryClient();
  const command = useSaveDraftLines();
  const [draft, setDraftState] = useState<DraftState>(() => draftFromView(view));
  const [refs, setRefs] = useState<LineRef[]>([]);
  const [problem, setProblem] = useState<WorkflowProblem | null>(null);
  const sync = useServerSync(view, draft, setDraftState);

  const save = async () => {
    if (!view.baseRunId) return;
    const payload = toPayload(draft, view.candidates);
    setRefs(payload.refs);
    setProblem(null);
    try {
      const saved = await command.submit({ period: periodRefOf(view), revision: view.revision.revision, rowVersion: view.rowVersion, baseRunId: view.baseRunId, lines: payload.lines });
      queryClient.setQueryData(reconciliationKey(tenantId, view.periodId), saved);
      setDraftState(draftFromView(saved));
      sync.accept(saved);
    } catch (error) {
      setProblem(workflowProblemOf(error));
    }
  };

  return {
    draft,
    setDraft: (next) => setDraftState((state) => next(state)),
    refs,
    problem,
    saving: command.isPending,
    dropped: sync.dropped,
    save,
    rebase: async () => {
      sync.setRebasing(true);
      setProblem(null);
      await queryClient.invalidateQueries({ queryKey: reconciliationKey(tenantId, view.periodId) });
    },
    dismissProblem: () => setProblem(null),
    discard: () => {
      setDraftState(draftFromView(view));
      setProblem(null);
      sync.setDropped(null);
    },
  };
}
