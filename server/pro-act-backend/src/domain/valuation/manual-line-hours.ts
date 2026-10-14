import { LossKind } from '../accounting/accounting.types';
import { Dec } from '../actuals/decimal';

/** A half-open interval in epoch milliseconds. */
export interface Span {
  from: number;
  to: number;
}

export interface ManualHoursLine {
  id: string;
  kind: LossKind;
  /** the slice window the line belongs to (hours outside it are not this line's) */
  window: Span;
  /** closed intervals of the events the line cites as evidence */
  eventSpans: Span[];
}

export type ManualHours =
  | { seconds: Dec }
  | { reason: 'hours_unverified' | 'hours_already_charged' };

/** Sorted, merged union of spans (empty spans dropped). */
export function union(spans: readonly Span[]): Span[] {
  const sorted = spans
    .filter((s) => s.to > s.from)
    .sort((a, b) => a.from - b.from);
  const merged: Span[] = [];
  for (const span of sorted) {
    const last = merged[merged.length - 1];
    if (last && span.from <= last.to) last.to = Math.max(last.to, span.to);
    else merged.push({ ...span });
  }
  return merged;
}

/** `spans` minus `taken` (both unions). */
function subtract(spans: readonly Span[], taken: readonly Span[]): Span[] {
  let rest = [...spans];
  for (const cut of taken) {
    rest = rest.flatMap((s) => {
      if (cut.to <= s.from || cut.from >= s.to) return [s];
      const parts: Span[] = [];
      if (cut.from > s.from) parts.push({ from: s.from, to: cut.from });
      if (cut.to < s.to) parts.push({ from: cut.to, to: s.to });
      return parts;
    });
  }
  return rest;
}

const clip = (span: Span, window: Span): Span => ({
  from: Math.max(span.from, window.from),
  to: Math.min(span.to, window.to),
});

const length = (spans: readonly Span[]) =>
  spans.reduce((sum, s) => sum + (s.to - s.from), 0);

/**
 * SME V4 (14 Oct 2026): a manual line gets an hourly cost only for verified attributable hours — the
 * union of its evidenced events inside its slice — and only for downtime (availability) lines: an
 * off-grade or unexplained quantity implies no idle hours. Hours already charged by a kept automatic
 * line or by an earlier manual line are removed, so no asset-hour is charged twice. Lines of other kinds
 * are absent from the result (no hourly view).
 */
export function manualLineHours(
  lines: readonly ManualHoursLine[],
  claimed: readonly Span[],
): Map<string, ManualHours> {
  const result = new Map<string, ManualHours>();
  let taken = union(claimed);
  for (const line of lines) {
    if (line.kind !== 'availability') continue;
    const own = union(line.eventSpans.map((s) => clip(s, line.window)));
    if (own.length === 0) {
      result.set(line.id, { reason: 'hours_unverified' });
      continue;
    }
    const free = subtract(own, taken);
    const ms = length(free);
    if (ms === 0) {
      result.set(line.id, { reason: 'hours_already_charged' });
      continue;
    }
    result.set(line.id, { seconds: new Dec(ms).div(1000) });
    taken = union([...taken, ...free]);
  }
  return result;
}
