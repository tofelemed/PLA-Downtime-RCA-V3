import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import { defaultFilters, type EventFilterState } from '@/features/event-hub/model/event-filters';
import { toEventSearchParams } from '@/features/event-hub/model/event-url';

/** Which of the period's stops the Event Hub lists: all, the uncoded ones, or those waiting for verification. */
export type PeriodStopsFilter = 'all' | 'uncoded' | 'not_verified';

function narrowed(state: EventFilterState, filter: PeriodStopsFilter): EventFilterState {
  if (filter === 'uncoded') return { ...state, codingStates: ['uncoded'] };
  if (filter === 'not_verified') return { ...state, verificationStates: ['not_verified'] };
  return state;
}

/**
 * E-7: the Event Hub listing this period's stops of its unit (the period window as explicit bounds),
 * optionally only the uncoded ones or only those not yet verified by a supervisor.
 */
export function periodStopsHref(view: Pick<ReconciliationView, 'unitId' | 'utcStart' | 'utcEnd'>, filter: PeriodStopsFilter): string {
  const state = { ...defaultFilters({ from: view.utcStart, to: view.utcEnd, label: 'This period' }), unitIds: [view.unitId], physicalTypes: ['downtime'] };
  return `/events?${toEventSearchParams(narrowed(state, filter))}`;
}
