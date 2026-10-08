import { IANAZone } from 'luxon';
import { BoundedInterval } from '../time/interval-algebra';
import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE } from './wall-clock';

/** A stretch of UTC time with one offset from UTC. */
interface OffsetSegment {
  start: number;
  end: number;
  offsetMinutes: number;
}

/** Offsets in use are within ±14 h; a margin of a day keeps every preimage inside the timeline. */
const MARGIN_MS = MS_PER_DAY + 14 * MS_PER_HOUR;
/** Offsets are sampled hourly; no zone changes its offset twice within an hour. */
const SAMPLE_MS = MS_PER_HOUR;

export function isValidTimeZone(zone: string): boolean {
  return IANAZone.isValidZone(zone);
}

/** Offset (minutes east of UTC) of an IANA zone at an instant. */
export function zoneOffsetAt(zone: string, instant: Date): number {
  if (!isValidTimeZone(zone)) {
    throw new RangeError(`unknown IANA time zone ${zone}`);
  }
  return IANAZone.create(zone).offset(instant.getTime());
}

/**
 * The offsets of one IANA zone over a UTC range (luxon resolves the tz database). Wall-clock intervals
 * are mapped to UTC by taking every instant whose local wall time falls inside them (CAL02):
 * a spring-forward gap contributes no time, a fall-back hour is counted twice — once per offset — and a
 * day is as long as it really is (23 or 25 h, never forced to 24 h).
 */
export class ZoneTimeline {
  private constructor(
    readonly zone: string,
    private readonly segments: OffsetSegment[],
  ) {}

  /** Timeline covering the wall-clock range `[wallFrom, wallTo)` with a margin on both sides. */
  static forWallRange(
    zone: string,
    wallFrom: number,
    wallTo: number,
  ): ZoneTimeline {
    if (!isValidTimeZone(zone)) {
      throw new RangeError(`unknown IANA time zone ${zone}`);
    }
    const iana = IANAZone.create(zone);
    return new ZoneTimeline(
      zone,
      buildSegments(iana, wallFrom - MARGIN_MS, wallTo + MARGIN_MS),
    );
  }

  /** Offset (minutes) in force at a UTC instant. */
  offsetAt(utcMs: number): number {
    const segment = this.segments.find(
      (s) => utcMs >= s.start && utcMs < s.end,
    );
    if (!segment) throw new RangeError('instant outside the zone timeline');
    return segment.offsetMinutes;
  }

  /**
   * UTC intervals whose local wall time lies in `[wallStart, wallEnd)`, sorted, adjacent pieces merged.
   * One interval normally; two when the fall-back repeat cuts the range (a boundary inside the
   * repeated hour); none when the range lies wholly inside a spring-forward gap.
   */
  preimage(wallStart: number, wallEnd: number): BoundedInterval[] {
    const pieces: Array<[number, number]> = [];
    for (const segment of this.segments) {
      const offset = segment.offsetMinutes * MS_PER_MINUTE;
      const start = Math.max(segment.start, wallStart - offset);
      const end = Math.min(segment.end, wallEnd - offset);
      if (end <= start) continue;
      const last = pieces[pieces.length - 1];
      if (last && last[1] === start) last[1] = end;
      else pieces.push([start, end]);
    }
    return pieces
      .sort((a, b) => a[0] - b[0])
      .map(([start, end]) => ({ start: new Date(start), end: new Date(end) }));
  }

  /** The UTC instant of a wall time: its first occurrence, or the end of the gap it falls in. */
  instantOf(wall: number): number {
    const [first] = this.preimage(wall, wall + MS_PER_DAY);
    if (!first) throw new RangeError('wall time outside the zone timeline');
    return first.start.getTime();
  }
}

function buildSegments(
  zone: IANAZone,
  from: number,
  to: number,
): OffsetSegment[] {
  const segments: OffsetSegment[] = [];
  let start = from;
  let offset = zone.offset(from);
  for (
    let probe = from + SAMPLE_MS;
    probe < to + SAMPLE_MS;
    probe += SAMPLE_MS
  ) {
    const at = Math.min(probe, to);
    const next = zone.offset(at);
    if (next === offset) continue;
    const change = transitionBetween(zone, at - SAMPLE_MS, at);
    segments.push({ start, end: change, offsetMinutes: offset });
    start = change;
    offset = next;
  }
  segments.push({ start, end: to, offsetMinutes: offset });
  return segments;
}

/** First millisecond in `(before, after]` with the offset of `after` (binary search). */
function transitionBetween(
  zone: IANAZone,
  before: number,
  after: number,
): number {
  const target = zone.offset(after);
  let low = before;
  let high = after;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (zone.offset(mid) === target) high = mid;
    else low = mid;
  }
  return high;
}
