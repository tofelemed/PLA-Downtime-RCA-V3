import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { EventRcaView, ReconciliationView } from '@/api/v2/types/reconciliation';
import { EventRcaChip } from '@/features/rca/components/event-rca-chip';
import { Quantity } from '@/features/ux-kit/quantity';
import { KIND_LABELS } from '../model/display';
import { eventRcaById } from '../model/event-rca';
import { addManual, DraftState, ManualDraft, manualProblems, removeManual } from '../model/draft-lines';
import type { WorkflowIssue } from '../model/workflow-errors';
import { EventLink } from './event-link';
import { LineCodes } from './line-codes';
import { LineIssues } from './line-issues';
import { ManualLineForm } from './manual-line-form';
import { type NumberFormat, useNumberFormat } from '@/features/ux-kit/use-number-format';

export interface ManualLinesProps {
  view: ReconciliationView;
  draft: DraftState;
  setDraft: (next: (state: DraftState) => DraftState) => void;
  issues: Map<string, WorkflowIssue[]>;
  readOnly: boolean;
  timezone: string;
}

function Evidence({ line, number, rca }: { line: ManualDraft; number: NumberFormat['number']; rca: ReadonlyMap<string, EventRcaView> }) {
  if (!line.eventIds.length) {
    const text = line.missingEvent ? (line.missingCode ? 'no event · reason code missing' : 'no event (cause without an event)') : 'no evidence';
    return <span className="text-xs text-muted-foreground">{text}</span>;
  }
  return (
    <span className="text-xs text-muted-foreground" data-testid="manual-line-events">
      {number(line.eventIds.length)} linked {line.eventIds.length === 1 ? 'event' : 'events'}:{' '}
      {line.eventIds.map((eventId, index) => (
        <span key={eventId}>
          {index > 0 && ', '}
          <EventLink eventId={eventId}>event {number(index + 1)}</EventLink>
          {rca.has(eventId) && (
            <span className="ml-1 inline-flex align-middle">
              <EventRcaChip rcaState={rca.get(eventId)?.state} caseId={rca.get(eventId)?.caseId} />
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

/** Manual lines of the draft (reason, kind, quantity, evidence) and the form that adds one. */
export function ManualLines({ view, draft, setDraft, issues, readOnly, timezone }: ManualLinesProps) {
  const { number } = useNumberFormat();
  const rca = eventRcaById(view);
  const pending = draft.pendingManual;
  const start = () => setDraft((current) => ({ ...current, dirty: true, pendingManual: { sliceId: view.slices[0]?.sliceId ?? '', kind: 'availability', quantity: null, eventIds: [], missingEvent: false, missingCode: false } }));
  const uomOf = (sliceId: string) => view.slices.find((s) => s.sliceId === sliceId)?.uom ?? null;
  return (
    <div className="space-y-2" data-testid="manual-lines">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium uppercase text-muted-foreground">Manual lines</h4>
        {!readOnly && !pending && (
          <Button variant="outline" size="sm" data-testid="add-manual-line" onClick={start} disabled={!view.slices.length}>
            Add manual line
          </Button>
        )}
      </div>
      {draft.manual.map((line) => (
        <div key={line.uid} className="rounded-md border p-2 text-sm" data-testid="manual-line">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{KIND_LABELS[line.kind] ?? line.kind}</Badge>
            <Quantity value={line.quantity} uom={uomOf(line.sliceId)} />
            <Evidence line={line} number={number} rca={rca} />
            <LineCodes reasonCodeId={line.reasonCodeId} />
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
      {pending && !readOnly && (
        <ManualLineForm
          view={view}
          timezone={timezone}
          line={pending}
          onChange={(line) => setDraft((current) => ({ ...current, dirty: true, pendingManual: line }))}
          onCancel={() => setDraft((current) => ({ ...current, pendingManual: null }))}
          onAdd={(line) => {
            setDraft((s) => ({ ...addManual(s, line), pendingManual: null }));
          }}
        />
      )}
    </div>
  );
}
