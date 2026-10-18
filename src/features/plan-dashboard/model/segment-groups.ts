import type { SourceSegmentView } from '@/api/v2/types/periods';

/** One source of a slice's actuals: its segments in order and how many of each quality. */
export interface SegmentGroup {
  source: string;
  /** the signal id when the source is `signal:<id>`, otherwise null */
  signalId: string | null;
  method: string;
  from: string;
  to: string;
  segments: SourceSegmentView[];
  qualityCounts: Partial<Record<SourceSegmentView['quality'], number>>;
}

const SIGNAL_PREFIX = 'signal:';

/** `"signal:<id>"` → `<id>`; any other source label → null. */
export function signalIdOf(source: string): string | null {
  return source.startsWith(SIGNAL_PREFIX) ? source.slice(SIGNAL_PREFIX.length) : null;
}

/**
 * The server's segments grouped by source and method, in first-seen order, for a readable summary
 * (a one-minute counter gives 480 segments a shift). Only counts and the time span are taken; no
 * quantity is added up here.
 */
export function groupSegments(segments: readonly SourceSegmentView[]): SegmentGroup[] {
  const groups = new Map<string, SegmentGroup>();
  for (const segment of segments) {
    const key = `${segment.source}|${segment.method}`;
    const group = groups.get(key) ?? { source: segment.source, signalId: signalIdOf(segment.source), method: segment.method, from: segment.from, to: segment.to, segments: [], qualityCounts: {} };
    group.segments.push(segment);
    if (segment.from < group.from) group.from = segment.from;
    if (segment.to > group.to) group.to = segment.to;
    group.qualityCounts[segment.quality] = (group.qualityCounts[segment.quality] ?? 0) + 1;
    groups.set(key, group);
  }
  return [...groups.values()];
}
