import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { CandidateView, ManualKind, ReconciliationLineView } from '@/api/v2/types/reconciliation';
import { DecimalInput } from '@/features/ux-kit/decimal-input';
import { DRAFT_ACTION_LABELS, humanize } from '@/features/ux-kit/labels';
import { Quantity } from '@/features/ux-kit/quantity';
import { CANDIDATE_STATE_LABELS, KIND_LABELS } from '../model/display';
import { CandidateDecision, DecisionAction, decisionProblems, DraftState, setDecision } from '../model/draft-lines';
import type { WorkflowIssue } from '../model/workflow-errors';
import { LineIssues } from './line-issues';

export interface CandidateRowProps {
  candidate: CandidateView;
  uom: string | null;
  saved: ReconciliationLineView | null;
  decision: CandidateDecision | null;
  setDraft: (next: (state: DraftState) => DraftState) => void;
  issues: WorkflowIssue[];
  readOnly: boolean;
}

const ACTIONS: DecisionAction[] = ['accept', 'adjust', 'replace', 'reject'];
const REPLACE_KINDS: ManualKind[] = ['availability', 'performance', 'quality', 'bridge'];

/** One candidate (ACC07/ACC08): provenance, server state, the pending decision and its fields. */
export function CandidateRow({ candidate, uom, saved, decision, setDraft, issues, readOnly }: CandidateRowProps) {
  const update = (next: CandidateDecision | null) => setDraft((s) => setDecision(s, candidate.autoKey, next));
  const patch = (fields: Partial<CandidateDecision>) => decision && update({ ...decision, ...fields });
  const problems = decision ? decisionProblems(decision) : [];
  const overrideRemoved = saved !== null && decision === null;
  return (
    <div className="rounded-md border p-2 text-sm" data-testid="candidate-row" data-auto-key={candidate.autoKey} data-state={candidate.state}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{KIND_LABELS[candidate.kind] ?? candidate.kind}</Badge>
        <Quantity value={candidate.quantity} uom={uom} />
        <span className="text-xs text-muted-foreground">
          Automatic ({humanize(candidate.basis).toLowerCase()})
          {candidate.causeEventId ? ' · from a recorded event' : ' · no cause event'}
        </span>
        <Badge variant="secondary">{CANDIDATE_STATE_LABELS[candidate.state]}</Badge>
        {saved?.flags.includes('baseline_changed') && <Badge variant="destructive">Candidate changed since the decision — save again</Badge>}
        {!readOnly && (
          <select aria-label="Decision" data-testid="candidate-decision" className="ml-auto h-8 rounded-md border border-input bg-background px-2" value={decision?.action ?? ''} onChange={(e) => update(e.target.value ? { action: e.target.value as DecisionAction } : null)}>
            <option value="">Proposed (no decision)</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {DRAFT_ACTION_LABELS[a]}
              </option>
            ))}
          </select>
        )}
      </div>
      {overrideRemoved && !readOnly && (
        <p className="mt-1 text-xs text-amber-700" data-testid="override-preview">
          Decision removed: after saving, the candidate counts again as proposed (<Quantity value={candidate.quantity} uom={uom} />).
        </p>
      )}
      {decision && !readOnly && (
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {(decision.action === 'adjust' || decision.action === 'replace') && (
            <DecimalInput aria-label="Quantity" value={decision.quantity ?? null} onChange={(q) => patch({ quantity: q ?? undefined })} />
          )}
          {decision.action === 'replace' && (
            <select aria-label="Replacement kind" className="h-9 rounded-md border border-input bg-background px-2" value={decision.kind ?? ''} onChange={(e) => patch({ kind: e.target.value as ManualKind })}>
              <option value="">Kind…</option>
              {REPLACE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
          )}
          {decision.action !== 'accept' && <Input aria-label="Reason" placeholder="Reason (required)" value={decision.reason ?? ''} onChange={(e) => patch({ reason: e.target.value })} />}
        </div>
      )}
      <LineIssues problems={readOnly ? [] : problems} issues={issues} uom={uom} />
    </div>
  );
}
