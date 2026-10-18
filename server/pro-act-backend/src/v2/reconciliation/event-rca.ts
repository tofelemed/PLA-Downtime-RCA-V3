import { EntityManager, In } from 'typeorm';
import { ProductionEvent } from '../../production-event/production-event.entity';
import { RevisionState } from '../../reconciliation/revision-state';
import type {
  CandidateV2View,
  ReconciliationLineV2View,
} from './reconciliation-v2.view';

/** G-4: an event's RCA state and investigation, as the event list exposes them (`states.rca`, `rcaId`). */
export interface EventRcaV2View {
  /** none | required | linked | completed */
  state: string;
  caseId: string | null;
}

/** RCA of a manual line's cited event (`evidence[].eventId`). */
export interface LinkedEventRcaV2View extends EventRcaV2View {
  eventId: string;
}

/** Event ids the editor shows: candidates' cause events and the events saved lines cite. */
export function rcaEventIdsOf(state: RevisionState): string[] {
  const ids = new Set<string>();
  for (const line of state.candidateLines) {
    if (line.causeEventId) ids.add(line.causeEventId);
  }
  for (const line of state.lines) {
    for (const ref of line.evidence ?? []) ids.add(ref.eventId);
  }
  return [...ids];
}

/**
 * The RCA state of the given events from the event rows themselves (the source of `states.rca` / `rcaId`
 * in the v2 event view): one query, tenant-scoped; unknown ids are absent from the map.
 */
export async function loadEventRca(
  manager: EntityManager,
  tenantId: string,
  eventIds: readonly string[],
): Promise<Map<string, EventRcaV2View>> {
  if (eventIds.length === 0) return new Map();
  const rows = await manager.find(ProductionEvent, {
    select: { id: true, rcaState: true, rcaId: true },
    where: { tenantId, id: In([...eventIds]) },
  });
  return new Map(
    rows.map((row) => [
      row.id,
      { state: row.rcaState, caseId: row.rcaId ?? null },
    ]),
  );
}

/** Candidates with their cause event's RCA state (view only, never in the reviewed content). */
export function withCandidateRca(
  candidates: CandidateV2View[],
  eventRca?: ReadonlyMap<string, EventRcaV2View>,
): CandidateV2View[] {
  if (!eventRca) return candidates;
  return candidates.map((candidate) =>
    candidate.causeEventId
      ? {
          ...candidate,
          causeEventRca: eventRca.get(candidate.causeEventId) ?? null,
        }
      : candidate,
  );
}

/** Saved lines with the RCA state of the events they cite (view only). */
export function withLinkedEventRca(
  lines: ReconciliationLineV2View[],
  eventRca?: ReadonlyMap<string, EventRcaV2View>,
): ReconciliationLineV2View[] {
  if (!eventRca) return lines;
  return lines.map((line) => {
    if (line.evidence.length === 0) return line;
    const linkedEventRca = line.evidence.flatMap(({ eventId }) => {
      const rca = eventRca.get(eventId);
      return rca ? [{ eventId, ...rca }] : [];
    });
    return { ...line, linkedEventRca };
  });
}
