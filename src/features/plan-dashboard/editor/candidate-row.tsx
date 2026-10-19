import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { CandidateView, ManualKind, ReconciliationLineView } from '@/api/v2/types/reconciliation';
import { EventRcaChip } from '@/features/rca/components/event-rca-chip';
import { StartRcaLink } from '@/features/rca/components/start-rca-link';
import { DecimalInput } from '@/features/ux-kit/decimal-input';
import { DRAFT_ACTION_LABELS, lossBasisLabel } from '@/features/ux-kit/labels';
import { RequiredMarker } from '@/features/ux-kit/form-field';
import { Quantity } from '@/features/ux-kit/quantity';
import { effectiveDiffers } from '../model/candidate-derivation';
import { CANDIDATE_STATE_LABELS, KIND_LABELS } from '../model/display';
import { CandidateDecision, DecisionAction, decisionProblems, DraftState, setDecision } from '../model/draft-lines';
import type { WorkflowIssue } from '../model/workflow-errors';
import { CandidateDerivation } from './candidate-derivation';
import { EventLink } from './event-link';
import { LineCodes } from './line-codes';
import { LineIssues } from './line-issues';

export interface CandidateRowProps {
  candidate: CandidateView;
  uom: string | null;
  saved: ReconciliationLineView | null;
  decision: CandidateDecision | null;
  setDraft: (next: (state: DraftState) => DraftState) => void;
  issues: WorkflowIssue[];
  readOnly: boolean;
  timezone: string;
}

const ACTIONS: DecisionAction[] = ['accept', 'adjust', 'replace', 'reject'];
const REPLACE_KINDS: ManualKind[] = ['availability', 'performance', 'quality', 'bridge'];

/** One candidate (ACC07/ACC08): provenance, server state, the pending decision and its fields. */
export function CandidateRow({ candidate, uom, saved, decision, setDraft, issues, readOnly, timezone }: CandidateRowProps) {
  const update = (next: CandidateDecision | null) => setDraft((s) => setDecision(s, candidate.autoKey, next));
  const patch = (fields: Partial<CandidateDecision>) => decision && update({ ...decision, ...fields });
  const problems = decision ? decisionProblems(decision) : [];
  const overrideRemoved = saved !== null && decision === null;
  return (
    <div className="rounded-md border p-2 text-sm" data-testid="candidate-row" data-auto-key={candidate.autoKey} data-state={candidate.state}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{KIND_LABELS[candidate.kind] ?? candidate.kind}</Badge>
        <Quantity value={candidate.quantity} uom={uom} />
        {effectiveDiffers(candidate) && (
          <span className="text-xs" data-testid="candidate-effective">
            counts as <Quantity value={candidate.effectiveQuantity} uom={uom} />
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          Automatic ({lossBasisLabel(candidate.basis).toLowerCase()}) ·{' '}
          {candidate.causeEventId ? <EventLink eventId={candidate.causeEventId}>from a recorded event</EventLink> : 'no cause event'}
        </span>
        {candidate.causeEventRca && <EventRcaChip rcaState={candidate.causeEventRca.state} caseId={candidate.causeEventRca.caseId} />}
        <LineCodes reasonCodeId={saved?.reasonCodeId ?? candidate.reasonCodeId} impactCodeId={saved?.impactCodeId ?? candidate.impactCodeId} showImpact flagUncoded={candidate.causeEventId !== null} />
        <Badge variant="secondary">{CANDIDATE_STATE_LABELS[candidate.state]}</Badge>
        <StartRcaLink context={{ eventId: candidate.causeEventId, lossLineId: candidate.lossLineId }} label="Start investigation for this loss line" />
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
      {candidate.derivation && <CandidateDerivation derivation={candidate.derivation} uom={uom} timezone={timezone} />}
      {overrideRemoved && !readOnly && (
        <p className="mt-1 text-xs text-warning" data-testid="override-preview">
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
          {decision.action !== 'accept' && (
            <label className="space-y-1 text-sm">
              <span>Reason<RequiredMarker /></span>
              <Input aria-label="Reason" required value={decision.reason ?? ''} onChange={(e) => patch({ reason: e.target.value })} />
            </label>
          )}
        </div>
      )}
      <LineIssues problems={readOnly ? [] : problems} issues={issues} uom={uom} />
    </div>
  );
}
