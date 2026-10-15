import { Dec, formatDec, toDec, ZERO } from '../decimal';
import { PeriodOutputEvent } from './output-distribution';

/** A stream run as output attribution reads it (SME E6). */
export interface OutputStreamRun {
  id: string;
  streamId: string;
  productId: string;
  lotCode: string | null;
  start: Date;
  end: Date | null;
}

/** An output event with the stream / lot it names (absent = unit-level output). */
export interface StreamedOutputEvent extends PeriodOutputEvent {
  streamId?: string | null;
  lotCode?: string | null;
}

/** An output (or a piece of one) with the product it belongs to; null = not attributable to a product. */
export interface AttributedOutput {
  productId: string | null;
  event: PeriodOutputEvent;
}

const SCALE = 8;

const plain = (event: StreamedOutputEvent): PeriodOutputEvent => ({
  identity: event.identity,
  revision: event.revision,
  start: event.start,
  end: event.end,
  quantity: event.quantity,
  rejects: event.rejects,
  uom: event.uom,
  distribution: event.distribution ?? null,
});

/**
 * A lot-coded output belongs to the product of the run that made the lot, over the run's interval
 * (SME E6: the silo / packaging keeps the grade it was made as; E3: align to the production interval,
 * not the measurement time). A run still open counts to the measurement's end.
 */
function lotOutput(
  event: StreamedOutputEvent,
  run: OutputStreamRun,
): AttributedOutput {
  const end = event.end === null ? null : (run.end ?? event.end);
  return {
    productId: run.productId,
    event: { ...plain(event), start: run.start, end, distribution: null },
  };
}

function cumulative(total: Dec, part: number, whole: number): Dec {
  return total
    .times(part)
    .div(whole)
    .toDecimalPlaces(SCALE, Dec.ROUND_HALF_EVEN);
}

/** Pieces of a closed stream output over the stream's runs, prorated by time (an estimate when split). */
function streamOutput(
  event: StreamedOutputEvent,
  runs: readonly OutputStreamRun[],
): AttributedOutput[] {
  const own = runs.filter((r) => r.streamId === event.streamId);
  const start = event.start.getTime();
  const end = event.end?.getTime() ?? start;
  const at = (run: OutputStreamRun, ms: number) =>
    run.start.getTime() <= ms && (run.end === null || run.end.getTime() > ms);
  if (end <= start || !event.end) {
    const run = own.find((r) => at(r, start));
    return [{ productId: run?.productId ?? null, event: plain(event) }];
  }
  const cuts = [
    ...new Set([
      start,
      end,
      ...own.flatMap((r) => [r.start.getTime(), r.end?.getTime() ?? end]),
    ]),
  ]
    .filter((t) => t >= start && t <= end)
    .sort((a, b) => a - b);
  if (cuts.length === 2) {
    const run = own.find((r) => at(r, start));
    return [{ productId: run?.productId ?? null, event: plain(event) }];
  }
  const quantity = toDec(event.quantity) ?? ZERO;
  const rejects = toDec(event.rejects);
  return cuts.slice(0, -1).map((from, i) => {
    const to = cuts[i + 1];
    const share = (total: Dec) =>
      cumulative(total, to - start, end - start).minus(
        cumulative(total, from - start, end - start),
      );
    return {
      productId: own.find((r) => at(r, from))?.productId ?? null,
      event: {
        ...plain(event),
        identity: `${event.identity}@${i}`,
        start: new Date(from),
        end: new Date(to),
        quantity: formatDec(share(quantity)),
        rejects: rejects === null ? null : formatDec(share(rejects)),
        distribution: null,
        estimated: true,
      },
    };
  });
}

/**
 * SME E6 output attribution: each output belongs to exactly one product (or to none), so concurrent
 * products never count the same tonnes twice. A lot-coded output goes to the run that made the lot; a
 * stream output to the product(s) that stream ran while it was measured (split by time across a product
 * change, marked estimated); any other output stays unit-level (null) — exactly the 2.4 input when the
 * unit has no stream runs.
 */
export function attributeOutputs(
  events: readonly StreamedOutputEvent[],
  runs: readonly OutputStreamRun[],
): AttributedOutput[] {
  if (runs.length === 0)
    return events.map((event) => ({ productId: null, event: plain(event) }));
  return latest(events).flatMap((event) => attributeOne(event, runs));
}

/** The latest revision per identity, before pieces get identities of their own. */
function latest(events: readonly StreamedOutputEvent[]): StreamedOutputEvent[] {
  const held = new Map<string, StreamedOutputEvent>();
  for (const event of events) {
    const known = held.get(event.identity);
    if (!known || (event.revision ?? 0) >= (known.revision ?? 0))
      held.set(event.identity, event);
  }
  return [...held.values()];
}

function attributeOne(
  event: StreamedOutputEvent,
  runs: readonly OutputStreamRun[],
): AttributedOutput[] {
  const lot = event.lotCode
    ? runs.find((r) => r.lotCode === event.lotCode)
    : undefined;
  if (lot) return [lotOutput(event, lot)];
  if (event.streamId) return streamOutput(event, runs);
  return [{ productId: null, event: plain(event) }];
}
