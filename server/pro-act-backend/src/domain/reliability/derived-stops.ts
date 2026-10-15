import { ScheduleClass } from '../events/event-classification';
import { PhysicalState, StateSegment } from './unit-state';

/** SME D1 states that stop the unit; running and not scheduled never produce a stop event. */
export type StopState = Exclude<PhysicalState, 'running' | 'not_scheduled'>;

/**
 * Schedule class of a derived stop by state (plan 1.10, SME D1 / D3 / D4): an internal stop is
 * unplanned, planned maintenance / changeover and standby are planned (standby inside scheduled time still
 * lowers availability, DECISIONS "Reliability plant-data items"), starved / blocked are external (the
 * cause is another unit, SME D3). The cause itself stays on the event's coding.
 */
export const STOP_SCHEDULE_CLASS: Readonly<Record<StopState, ScheduleClass>> = {
  internal_stop: 'unplanned',
  planned_stop: 'planned',
  starved: 'external',
  blocked: 'external',
  standby: 'planned',
};

const isStopState = (state: StateSegment['state']): state is StopState =>
  state !== 'unknown' && state !== 'running' && state !== 'not_scheduled';

/** DT02 pilot defaults: a stop must last 5 s (debounce); a restart must hold 10 s (confirmation). */
export interface StopDerivationConfig {
  debounceSeconds: number;
  restartConfirmSeconds: number;
}

export const STOP_DERIVATION_DEFAULTS: StopDerivationConfig = {
  debounceSeconds: 5,
  restartConfirmSeconds: 10,
};

/** One stop event the state engine derives: one state, one known span. */
export interface DerivedStop {
  /** stable identity within the unit: state and start (a different state or start is another event) */
  key: string;
  /** key of the first stop of the same physical occurrence (contiguous stop states, gaps of unknown) */
  occurrenceKey: string;
  state: StopState;
  scheduleClass: ScheduleClass;
  start: Date;
  /** null = still stopped at the live edge */
  end: Date | null;
  /** SME D2: the stop starts at the first known sample after unknown time (a lower bound) */
  startAfterUnknown: boolean;
  /** SME D2: the stop ran into unknown time; its end is the last known instant, never filled */
  endBeforeUnknown: boolean;
}

interface Piece {
  state: StateSegment['state'];
  start: number;
  end: number;
}

const toPieces = (segments: readonly StateSegment[]): Piece[] =>
  segments.map((s) => ({
    state: s.state,
    start: s.start.getTime(),
    end: s.end.getTime(),
  }));

/** Adjacent pieces of one state become one (after re-labelling). */
function coalesce(pieces: readonly Piece[]): Piece[] {
  const out: Piece[] = [];
  for (const piece of pieces) {
    const last = out[out.length - 1];
    if (last && last.state === piece.state && last.end === piece.start) {
      last.end = piece.end;
    } else {
      out.push({ ...piece });
    }
  }
  return out;
}

/**
 * DT02 restart confirmation: running shorter than the confirmation between two stop states is not a
 * restart — the stop continues through it (the confirmation delay itself is never added to a stop).
 */
function absorbUnconfirmedRestarts(
  pieces: Piece[],
  confirmMs: number,
): Piece[] {
  return coalesce(
    pieces.map((piece, i) => {
      const before = pieces[i - 1];
      const after = pieces[i + 1];
      const blip =
        piece.state === 'running' &&
        piece.end - piece.start < confirmMs &&
        before !== undefined &&
        after !== undefined &&
        isStopState(before.state) &&
        isStopState(after.state) &&
        before.end === piece.start &&
        after.start === piece.end;
      return blip ? { ...piece, state: before.state } : piece;
    }),
  );
}

/**
 * Stop chatter: a stop-state piece shorter than the debounce between two other stop states takes the
 * state of the piece before it (one physical stop does not change cause every few seconds).
 */
function absorbStateChatter(pieces: Piece[], debounceMs: number): Piece[] {
  return coalesce(
    pieces.map((piece, i) => {
      const before = pieces[i - 1];
      const chatter =
        isStopState(piece.state) &&
        piece.end - piece.start < debounceMs &&
        before !== undefined &&
        isStopState(before.state) &&
        before.end === piece.start &&
        before.state !== piece.state;
      return chatter ? { ...piece, state: before.state } : piece;
    }),
  );
}

/**
 * Physical stop occurrences: runs of stop pieces joined directly or through unknown time with a stop on
 * both sides (the gap is not filled, but the same stop resumes after it).
 */
function occurrences(pieces: readonly Piece[]): Piece[][] {
  const groups: Piece[][] = [];
  let current: Piece[] = [];
  let pendingUnknown = false;
  for (const piece of pieces) {
    if (isStopState(piece.state)) {
      const joined =
        current.length > 0 &&
        (pendingUnknown || current[current.length - 1].end === piece.start);
      if (!joined && current.length > 0) groups.push(current);
      if (!joined) current = [];
      current.push(piece);
      pendingUnknown = false;
      continue;
    }
    if (piece.state === 'unknown' && current.length > 0) {
      pendingUnknown = true;
      continue;
    }
    if (current.length > 0) groups.push(current);
    current = [];
    pendingUnknown = false;
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

const knownSeconds = (group: readonly Piece[]) =>
  group.reduce((total, p) => total + (p.end - p.start), 0) / 1000;

/**
 * Plan 1.10 `DerivedEventBuilder` on the SME D1 / D2 state timeline: every stop state (internal stop,
 * planned stop, starved, blocked, standby) becomes a downtime event of its schedule class; running and not
 * scheduled close it. Unknown time is a data-quality condition, never a stop: it ends the known part of a
 * stop (`endBeforeUnknown`) and a stop resuming after it is a new event of the same occurrence. A stop
 * occurrence shorter than the debounce is chatter (DT02) — also at the live edge, where it is not yet
 * confirmed. A stop reaching `liveEdge` is open (end null). Deterministic: the same timeline gives the
 * same events, so reprocessing after late samples is idempotent.
 */
export function deriveStops(
  segments: readonly StateSegment[],
  config: StopDerivationConfig,
  liveEdge: Date | null,
): DerivedStop[] {
  const confirmed = absorbStateChatter(
    absorbUnconfirmedRestarts(
      coalesce(toPieces(segments)),
      config.restartConfirmSeconds * 1000,
    ),
    config.debounceSeconds * 1000,
  );
  const neighbours = new Map(confirmed.map((p, i) => [p, i]));
  const edge = liveEdge?.getTime() ?? null;
  return occurrences(confirmed)
    .filter((group) => knownSeconds(group) >= config.debounceSeconds)
    .flatMap((group) => {
      const occurrenceKey = keyOf(group[0]);
      return group.map((piece) => {
        const i = neighbours.get(piece) as number;
        const state = piece.state as StopState;
        return {
          key: keyOf(piece),
          occurrenceKey,
          state,
          scheduleClass: STOP_SCHEDULE_CLASS[state],
          start: new Date(piece.start),
          end: edge !== null && piece.end >= edge ? null : new Date(piece.end),
          startAfterUnknown: confirmed[i - 1]?.state === 'unknown',
          endBeforeUnknown: confirmed[i + 1]?.state === 'unknown',
        };
      });
    });
}

const keyOf = (piece: Piece) => `${piece.state}@${piece.start}`;
