import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import type { DraftState } from '../model/draft-lines';
import type { WorkflowIssue } from '../model/workflow-errors';
import { CandidateRow } from './candidate-row';

export interface CandidateTableProps {
  view: ReconciliationView;
  draft: DraftState;
  setDraft: (next: (state: DraftState) => DraftState) => void;
  issues: Map<string, WorkflowIssue[]>;
  readOnly: boolean;
  /** plant timezone of the derivation windows */
  timezone: string;
}

/** Automatic candidates of the current run with their saved state and the user's pending decision. */
export function CandidateTable({ view, draft, setDraft, issues, readOnly, timezone }: CandidateTableProps) {
  if (!view.candidates.length) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="no-candidates">
        No automatic candidates in this run (no planning rate over the scheduled time, or no loss events).
      </p>
    );
  }
  return (
    <div className="space-y-2" data-testid="candidates">
      <h4 className="text-xs font-medium uppercase text-muted-foreground">Automatic candidates</h4>
      {view.candidates.map((candidate) => (
        <CandidateRow
          key={candidate.autoKey}
          candidate={candidate}
          uom={view.slices.find((s) => s.sliceId === candidate.sliceId)?.uom ?? null}
          saved={view.lines.find((l) => l.autoKey === candidate.autoKey && l.action !== 'manual') ?? null}
          decision={draft.decisions[candidate.autoKey] ?? null}
          setDraft={setDraft}
          issues={issues.get(`decision:${candidate.autoKey}`) ?? []}
          readOnly={readOnly}
          timezone={timezone}
        />
      ))}
    </div>
  );
}
