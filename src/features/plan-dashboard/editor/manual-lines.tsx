import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import { Quantity } from '@/features/ux-kit/quantity';
import { KIND_LABELS } from '../model/display';
import { addManual, DraftState, ManualDraft, manualProblems, removeManual } from '../model/draft-lines';
import type { WorkflowIssue } from '../model/workflow-errors';
import { LineIssues } from './line-issues';
import { ManualLineForm } from './manual-line-form';

export interface ManualLinesProps {
  view: ReconciliationView;
  draft: DraftState;
  setDraft: (next: (state: DraftState) => DraftState) => void;
  issues: Map<string, WorkflowIssue[]>;
  readOnly: boolean;
  timezone: string;
}

function evidenceText(line: ManualDraft): string {
  if (line.eventIds.length) return `${line.eventIds.length} linked event(s)`;
  if (line.missingEvent) return line.missingCode ? 'no event · reason code missing' : 'no event (cause without an event)';
  return 'no evidence';
}

/** Manual lines of the draft (reason, kind, quantity, evidence) and the form that adds one. */
export function ManualLines({ view, draft, setDraft, issues, readOnly, timezone }: ManualLinesProps) {
  const [adding, setAdding] = useState(false);
  const uomOf = (sliceId: string) => view.slices.find((s) => s.sliceId === sliceId)?.uom ?? null;
  return (
    <div className="space-y-2" data-testid="manual-lines">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium uppercase text-muted-foreground">Manual lines</h4>
        {!readOnly && !adding && (
          <Button variant="outline" size="sm" data-testid="add-manual-line" onClick={() => setAdding(true)} disabled={!view.slices.length}>
            Add manual line
          </Button>
        )}
      </div>
      {draft.manual.map((line) => (
        <div key={line.uid} className="rounded-md border p-2 text-sm" data-testid="manual-line">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{KIND_LABELS[line.kind] ?? line.kind}</Badge>
            <Quantity value={line.quantity} uom={uomOf(line.sliceId)} />
            <span className="text-xs text-muted-foreground">{evidenceText(line)}</span>
            {line.reason && <span className="text-xs">“{line.reason}”</span>}
            {!readOnly && (
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setDraft((s) => removeManual(s, line.uid))}>
                Remove
              </Button>
            )}
          </div>
          <LineIssues problems={readOnly ? [] : manualProblems(line)} issues={issues.get(`manual:${line.uid}`) ?? []} uom={uomOf(line.sliceId)} />
        </div>
      ))}
      {!draft.manual.length && <p className="text-sm text-muted-foreground">No manual lines.</p>}
      {adding && (
        <ManualLineForm
          view={view}
          timezone={timezone}
          onCancel={() => setAdding(false)}
          onAdd={(line) => {
            setDraft((s) => addManual(s, line));
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}
