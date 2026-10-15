import { DerivedStop, StopState } from './derived-stops';

/** An event the state engine wrote earlier for a stop key (`production_events.event_id = state:<unit>:<key>`). */
export interface EngineOwnedEvent {
  id: string;
  key: string;
  /** live = open / closed; kept = superseded or retracted (a person or an operation owns it now) */
  live: boolean;
  end: Date | null;
  occurrenceId: string;
  description: string | null;
}

export interface DerivedWrite {
  stop: DerivedStop;
  occurrenceId: string;
  description: string;
}

export interface DerivedWritePlan {
  create: Array<DerivedWrite & { id: string }>;
  update: Array<DerivedWrite & { id: string }>;
  retract: string[];
}

const STATE_LABEL: Readonly<Record<StopState, string>> = {
  internal_stop: 'internal stop',
  planned_stop: 'planned stop / changeover',
  starved: 'starved',
  blocked: 'blocked',
  standby: 'standby',
};

/** Event description of a derived stop: the state and the SME D2 bounds it carries. */
export function describeStop(stop: DerivedStop): string {
  const notes = [
    stop.startAfterUnknown ? 'start after unknown signal time' : null,
    stop.endBeforeUnknown
      ? 'end at the last known sample (signal unknown after)'
      : null,
  ].filter((note): note is string => note !== null);
  const label = `State engine: ${STATE_LABEL[stop.state]}`;
  return notes.length > 0 ? `${label} (${notes.join('; ')})` : label;
}

const sameEnd = (a: Date | null, b: Date | null) =>
  (a?.getTime() ?? null) === (b?.getTime() ?? null);

/**
 * Plan 1.10 idempotent reprocessing: compares the stops derived over a window with the events the engine
 * wrote for it before. A known key is updated when its end, occurrence or bounds changed; a new key is
 * created; a live engine event whose key is gone (late samples changed the timeline) is retracted. A key
 * whose event was superseded or retracted is never written again: a person (split, merge, retraction) or
 * a duplicate merge owns it. Stops of one occurrence share the occurrence of their first event already
 * written, else the id of the first new one. `newId` supplies ids for created events.
 */
export function planDerivedWrites(
  existing: readonly EngineOwnedEvent[],
  stops: readonly DerivedStop[],
  newId: () => string,
): DerivedWritePlan {
  const byKey = new Map(existing.map((e) => [e.key, e]));
  const plan: DerivedWritePlan = { create: [], update: [], retract: [] };
  const occurrenceOf = new Map<string, string>();
  for (const stop of stops) {
    const known = byKey.get(stop.key);
    if (known?.live && !occurrenceOf.has(stop.occurrenceKey)) {
      occurrenceOf.set(stop.occurrenceKey, known.occurrenceId);
    }
  }
  for (const stop of stops) {
    const known = byKey.get(stop.key);
    if (known && !known.live) continue;
    const id = known?.id ?? newId();
    if (!occurrenceOf.has(stop.occurrenceKey)) {
      occurrenceOf.set(stop.occurrenceKey, id);
    }
    const write = {
      id,
      stop,
      occurrenceId: occurrenceOf.get(stop.occurrenceKey) as string,
      description: describeStop(stop),
    };
    if (!known) {
      plan.create.push(write);
    } else if (
      !sameEnd(known.end, stop.end) ||
      known.occurrenceId !== write.occurrenceId ||
      known.description !== write.description
    ) {
      plan.update.push(write);
    }
  }
  const keys = new Set(stops.map((s) => s.key));
  plan.retract = existing
    .filter((e) => e.live && !keys.has(e.key))
    .map((e) => e.id);
  return plan;
}
