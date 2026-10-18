import type { EventRcaView, ReconciliationView } from '@/api/v2/types/reconciliation';

/**
 * UX G-4: the RCA state the server returned for the events the editor shows — candidates' cause events and
 * the events saved lines cite — by event id. Events only added in the browser have no entry until saved.
 */
export function eventRcaById(view: Pick<ReconciliationView, 'candidates' | 'lines'>): Map<string, EventRcaView> {
  const byId = new Map<string, EventRcaView>();
  for (const candidate of view.candidates) {
    if (candidate.causeEventId && candidate.causeEventRca) byId.set(candidate.causeEventId, candidate.causeEventRca);
  }
  for (const line of view.lines) {
    for (const { eventId, state, caseId } of line.linkedEventRca ?? []) byId.set(eventId, { state, caseId });
  }
  return byId;
}
