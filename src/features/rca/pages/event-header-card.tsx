import type { EventEvidencePackageView } from '@/api/v2/types/rca';
import { DurationText } from '@/features/ux-kit/duration-text';
import type { EventCaseFacts } from '../model/event-case-prefill';

export interface EventHeaderCardProps {
  event: EventEvidencePackageView['event'];
  facts: EventCaseFacts;
}

/** The stop being investigated: unit, asset, start → end (or "Ongoing"), duration and reason. */
export function EventHeaderCard({ event, facts }: EventHeaderCardProps) {
  const seconds = event.durationSeconds ?? null;
  return (
    <dl className="grid grid-cols-[7rem_1fr] gap-x-2 gap-y-1 rounded border p-3 text-sm" data-testid="event-header-card">
      <dt className="text-muted-foreground">Unit</dt>
      <dd>{facts.unitName}</dd>
      <dt className="text-muted-foreground">Asset</dt>
      <dd>{facts.assetName ?? 'No asset recorded'}</dd>
      <dt className="text-muted-foreground">Time</dt>
      <dd data-testid="event-header-time">
        {facts.start} → {facts.end ?? 'Ongoing'}
      </dd>
      <dt className="text-muted-foreground">Duration</dt>
      <dd>{seconds === null ? (facts.end ? '—' : 'Ongoing') : <DurationText seconds={seconds} />}</dd>
      <dt className="text-muted-foreground">Reason</dt>
      <dd>{facts.reasonName ?? 'Not coded yet'}</dd>
    </dl>
  );
}
