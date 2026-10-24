import type { ProductionEventView } from '@/api/v2/types/events';
import { StatusBadge } from '@/features/ux-kit/status-badge';
import { EventRcaChip } from '@/features/rca/components/event-rca-chip';
import { AccountingStateChip } from './accounting-state-chip';
import { StateBadges } from './state-badges';

/**
 * C-9: the event's states as one inline row of chips ("Ongoing · Uncoded"), the RCA state as the shared
 * RCA chip (G-4: a link to the investigation, nothing when there is no RCA), plus SME D5
 * "Repeat incident" when the stop is grouped with repeats (counted once in MTBF). The accounting chip is
 * left out while the accounting is a draft (the default, explained by the column header), so it only
 * stands out once a period is in review or approved. The chips wrap inside a bounded cell, so the table
 * keeps every column on screen instead of scrolling sideways.
 */
const RCA_DIMENSION = ['rca'] as const;

export function EventStateCell({ event }: { event: ProductionEventView }) {
  return (
    <span className="flex min-w-[10rem] max-w-[18rem] flex-wrap items-center gap-1" data-testid="event-state-cell">
      <StateBadges states={event.states} className="contents" omit={RCA_DIMENSION} />
      {event.accountingState !== 'draft' && <AccountingStateChip event={event} />}
      <EventRcaChip rcaState={event.states.rca} caseId={event.rcaId} />
      {event.incidentId && (
        <StatusBadge tone="info" className="whitespace-nowrap" data-testid="event-incident" title="Repeat stops of one asset and reason, counted once in MTBF">
          Repeat incident
        </StatusBadge>
      )}
    </span>
  );
}
