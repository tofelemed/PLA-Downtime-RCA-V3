import type { ProductionEventView } from '@/api/v2/types/events';
import { EVENT_ACCOUNTING_LABELS, GRID_WORKFLOW_TONES, labelOf } from '@/features/ux-kit/labels';
import { StatusBadge } from '@/features/ux-kit/status-badge';
import { toneOf } from '@/features/ux-kit/status-tone';

/**
 * Owner finding 2: the accounting workflow of the periods the event overlaps ("Accounting: in review"),
 * from the server's `accountingState`, next to the coding chip so a stop under review never reads only
 * "Uncoded" / "Coded". Nothing when no period is calculated yet (or an older server sends no state).
 */
export function AccountingStateChip({ event }: { event: Pick<ProductionEventView, 'accountingState'> }) {
  const state = event.accountingState;
  if (!state || state === 'none') return null;
  return (
    <StatusBadge
      tone={toneOf(GRID_WORKFLOW_TONES, state)}
      className="whitespace-nowrap"
      data-testid="event-accounting-state"
      data-state={state}
      title="Workflow of the shift accounting this event belongs to"
    >
      {labelOf(EVENT_ACCOUNTING_LABELS, state)}
    </StatusBadge>
  );
}
