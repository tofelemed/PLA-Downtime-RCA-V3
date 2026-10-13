import { addDays, wallOfDate } from '../domain/calendar/wall-clock';
import { OPEN_ENDED, RecalculationRequest } from '../periods/period-recalc';

/**
 * Days subtracted from the first regenerated operational date: covers any UTC offset (≤ 14 h) and an
 * operational day starting up to a day early. Recalculating a few unchanged periods is harmless — the
 * calculation run keeps its result when the input fingerprint did not change.
 */
const MARGIN_DAYS = 2;

export interface CalendarRecalcInput {
  tenantId: string;
  unitIds: readonly string[];
  regenerateFrom: string | undefined;
  actorId: string | null;
}

/**
 * LA-03: a republish that regenerates past shift instances (`regenerateFrom`) changes the schedule of
 * periods already calculated, so their units are recalculated from that date on (future periods
 * included, `OPEN_ENDED`). A publish that only adds future or missing dates changes no calculated
 * period (new periods are picked up by the sweep).
 */
export function calendarRecalcRequest(
  input: CalendarRecalcInput,
): RecalculationRequest | null {
  if (!input.regenerateFrom || input.unitIds.length === 0) return null;
  return {
    tenantId: input.tenantId,
    unitIds: [...input.unitIds],
    from: new Date(wallOfDate(addDays(input.regenerateFrom, -MARGIN_DAYS))),
    to: OPEN_ENDED,
    reason: 'calendar_republished',
    scopeUnitIds: null,
    requestedBy: input.actorId,
  };
}
