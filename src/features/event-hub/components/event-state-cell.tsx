import type { ProductionEventView } from '@/api/v2/types/events';
import { StatusBadge } from '@/features/ux-kit/status-badge';
import { EventRcaChip } from '@/features/rca/components/event-rca-chip';
import { AccountingStateChip } from './accounting-state-chip';
import { StateBadges } from './state-badges';

/**
 * C-9: the event's states as one inline row of chips ("Ongoing · Uncoded"), the RCA state as the shared
 * RCA chip (G-4: a link to the investigation, nothing when there is no RCA), plus SME D5
 * "Repeat incident" when the stop is grouped with repeats (counted once in MTBF). It wraps only when the
 * chips do not fit the cell's minimum width, so rows stay one line high.
 */
const RCA_DIMENSION = ['rca'] as const;

export function EventStateCell({ event }: { event: ProductionEventView }) {
  return (
    <span className="flex min-w-[15rem] flex-wrap items-center gap-1" data-testid="event-state-cell">
      <StateBadges states={event.states} className="contents" omit={RCA_DIMENSION} />
      <AccountingStateChip event={event} />
      <EventRcaChip rcaState={event.states.rca} caseId={event.rcaId} />
      {event.incidentId && (
        <StatusBadge tone="info" data-testid="event-incident" title="Repeat stops of one asset and reason, counted once in MTBF">
          Repeat incident
        </StatusBadge>
      )}
    </span>
  );
}
