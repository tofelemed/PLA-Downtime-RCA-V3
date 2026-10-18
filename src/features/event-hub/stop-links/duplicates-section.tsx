import { Link } from 'react-router-dom';
import { useDuplicateDecision } from '@/api/v2/queries/stop-events';
import type { StopEventSummaryView, StopReconciliationView } from '@/api/v2/types/stop-events';
import { Badge } from '@/components/ui/badge';
import { usePlantFormat } from '../hooks/use-plant-format';
import { ReasonAction } from './reason-action';
import { fieldList, PAIR_STATE_LABELS, SOURCE_KIND_LABELS, SUGGESTION_LABELS } from './stop-links-text';

interface PairProps {
  pair: StopReconciliationView;
  eventId: string;
  canDecide: boolean;
}

function OtherStop({ other, role }: { other: StopEventSummaryView | null; role: string }) {
  const format = usePlantFormat();
  if (!other) return <span className="text-muted-foreground">The other stop is not visible to you.</span>;
  return (
    <span>
      {role}: <Link className="underline" to={`/events/${other.id}`}>{format.dateTime(other.startTime)}</Link>
      {' – '}
      {other.endTime ? format.dateTime(other.endTime) : 'still open'} · {SOURCE_KIND_LABELS[other.sourceKind] ?? other.sourceKind}
    </span>
  );
}

function PairDetail({ pair }: { pair: StopReconciliationView }) {
  const format = usePlantFormat();
  const copied = Object.keys(pair.copied);
  return (
    <p className="text-xs text-muted-foreground">
      Starts {format.duration(pair.startDeltaSeconds)} apart
      {pair.endDeltaSeconds !== null && `, ends ${format.duration(pair.endDeltaSeconds)} apart`} (tolerance{' '}
      {format.duration(pair.toleranceSeconds)}).
      {pair.suggestionReason && ` Not merged automatically: ${SUGGESTION_LABELS[pair.suggestionReason]}.`}
      {pair.conflicts.length > 0 && ` Different ${fieldList(pair.conflicts)}.`}
      {pair.state === 'merged' && copied.length > 0 && ` Copied to the kept stop: ${fieldList(copied)}.`}
      {pair.decisionReason && ` Decision: ${pair.decisionReason}`}
    </p>
  );
}

function PairActions({ pair }: { pair: StopReconciliationView }) {
  const decide = useDuplicateDecision();
  const run = (decision: 'accept' | 'reject' | 'undo') => (reason: string) => decide.submit({ id: pair.id, decision, reason });
  if (pair.state === 'merged') {
    return (
      <ReasonAction
        label="Undo merge"
        title="Undo this duplicate merge?"
        description="The duplicate becomes a live stop again and the cause values the merge copied are cleared where nobody changed them. The pair is not merged automatically again."
        confirmLabel="Undo merge"
        error={decide.error}
        testId="duplicate-undo"
        onConfirm={run('undo')}
      />
    );
  }
  if (pair.state !== 'suggested') return null;
  return (
    <span className="flex gap-2">
      <ReasonAction
        label="Merge"
        title="Merge these stops?"
        description="The stop with the better timing source is kept; empty cause fields are filled from the other, which stays as evidence (superseded). You can undo it."
        confirmLabel="Merge stops"
        error={decide.error}
        testId="duplicate-accept"
        onConfirm={run('accept')}
      />
      <ReasonAction
        label="Not a duplicate"
        title="Keep both stops?"
        description="Both stay as separate stops and the pair is not proposed again."
        confirmLabel="Keep both"
        error={decide.error}
        testId="duplicate-reject"
        onConfirm={run('reject')}
      />
    </span>
  );
}

function PairRow({ pair, eventId, canDecide }: PairProps) {
  const isKept = pair.kept?.id === eventId;
  return (
    <li className="space-y-1 rounded border p-2" data-testid="duplicate-pair" data-state={pair.state}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{PAIR_STATE_LABELS[pair.state]}</Badge>
          <OtherStop other={isKept ? pair.evidence : pair.kept} role={isKept ? 'Duplicate' : 'Kept stop'} />
        </span>
        {canDecide && <PairActions pair={pair} />}
      </div>
      <PairDetail pair={pair} />
    </li>
  );
}

/**
 * DT-04: this stop recorded twice (manual, source frame, state engine). A merged duplicate keeps the stop
 * with the better timing source and the other as evidence; suggestions wait for a person.
 */
export function DuplicatesSection({ pairs, eventId, canDecide }: { pairs: StopReconciliationView[]; eventId: string; canDecide: boolean }) {
  if (pairs.length === 0) {
    return <p className="text-sm text-muted-foreground">No other record of this stop was found.</p>;
  }
  return (
    <ul className="space-y-2" data-testid="duplicate-pairs">
      {pairs.map((pair) => (
        <PairRow key={pair.id} pair={pair} eventId={eventId} canDecide={canDecide} />
      ))}
    </ul>
  );
}
