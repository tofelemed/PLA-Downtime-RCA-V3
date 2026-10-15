import { Dec, secondsBetween, ZERO } from '../actuals/decimal';
import { BoundedInterval, clip } from '../time/interval-algebra';
import {
  LossEvent,
  PeriodAccountingInput,
  SliceInput,
  StreamRun,
} from './accounting.types';

/** A stream run clipped to a window, with its constant capacity share. */
export interface StreamPiece {
  streamId: string;
  productId: string;
  share: Dec;
  window: BoundedInterval;
}

/** True when the unit has streams configured for the run (SME E6); else the 2.5 single-unit model. */
export function hasStreams(input: PeriodAccountingInput): boolean {
  return (input.streamRuns?.length ?? 0) > 0;
}

/** A run's pieces inside `window`; a still-running stream counts to the window end. */
function pieceOf(run: StreamRun, window: BoundedInterval): StreamPiece | null {
  const part = clip({ start: run.start, end: run.end }, window);
  if (!part) return null;
  return {
    streamId: run.streamId,
    productId: run.productId,
    share: new Dec(run.share),
    window: part,
  };
}

function piecesIn(
  input: PeriodAccountingInput,
  window: BoundedInterval,
): StreamPiece[] {
  return (input.streamRuns ?? [])
    .flatMap((run) => pieceOf(run, window) ?? [])
    .sort(
      (a, b) =>
        a.window.start.getTime() - b.window.start.getTime() ||
        a.streamId.localeCompare(b.streamId),
    );
}

/**
 * The stream time a slice's product ran inside the slice window (SME E6 / LA-10): its capacity is the
 * share of each stream over the time that stream ran the product, never the whole window. Null when no
 * streams are configured (the slice keeps its whole window).
 */
export function slicePieces(
  input: PeriodAccountingInput,
  slice: SliceInput,
): StreamPiece[] | null {
  if (!hasStreams(input)) return null;
  return piecesIn(input, slice.window).filter(
    (p) => p.productId === slice.productId,
  );
}

/** Events that act on a stream: its own and the unit-wide ones (no stream named). */
export function eventsOfStream(
  events: readonly LossEvent[],
  streamId: string,
): LossEvent[] {
  return events.filter((e) => !e.streamId || e.streamId === streamId);
}

function overlapSeconds(a: BoundedInterval, b: BoundedInterval): Dec {
  const part = clip(a, b);
  return part ? secondsBetween(part.start.getTime(), part.end.getTime()) : ZERO;
}

const contains = (window: BoundedInterval, at: Date) =>
  window.start <= at && window.end > at;

/** Σ weight × (overlap seconds, or 1 for an instant inside) of the pieces. */
function weighted(
  pieces: readonly StreamPiece[],
  span: BoundedInterval | Date,
  weight: (piece: StreamPiece) => Dec,
): Dec {
  return pieces.reduce((sum, piece) => {
    const amount =
      span instanceof Date
        ? contains(piece.window, span)
          ? new Dec(1)
          : ZERO
        : overlapSeconds(piece.window, span);
    return sum.plus(amount.mul(weight(piece)));
  }, ZERO);
}

/**
 * Share of a declared quantity (quality loss, measured slowdown, transition off-grade) that belongs to
 * the slice's product (SME E6: mass is assigned once). Without streams: 1. A stream's event goes to the
 * product that stream ran (by time); a unit-wide event is split over the products in proportion to the
 * capacity (share × time) each ran while it lasted. Instant events use the products running at their
 * instant. 0 when no stream ran then.
 */
export function declaredWeight(
  input: PeriodAccountingInput,
  slice: SliceInput,
  event: LossEvent,
): Dec {
  if (!hasStreams(input)) return new Dec(1);
  const end = event.end ?? input.asOf;
  const instant = end <= event.start;
  const span: BoundedInterval | Date = instant
    ? event.start
    : (clip({ start: event.start, end }, slice.window) ?? event.start);
  const pieces = piecesIn(input, slice.window);
  const own = (p: StreamPiece) => p.productId === slice.productId;
  if (event.streamId) {
    const stream = pieces.filter((p) => p.streamId === event.streamId);
    const total =
      span instanceof Date
        ? new Dec(1)
        : secondsBetween(span.start.getTime(), span.end.getTime());
    if (total.lte(ZERO)) return ZERO;
    return weighted(stream.filter(own), span, () => new Dec(1)).div(total);
  }
  const all = weighted(pieces, span, (p) => p.share);
  if (all.lte(ZERO)) return ZERO;
  return weighted(pieces.filter(own), span, (p) => p.share).div(all);
}
