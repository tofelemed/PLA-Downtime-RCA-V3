import { zoneOffsetAt } from './zone-timeline';

type OffsetAt = (zone: string, instant: Date) => number;

/** Rules the pilot depends on, with an instant and the offset (minutes east of UTC) current tzdata gives. */
const KNOWN_OFFSETS = [
  {
    zone: 'Asia/Tehran',
    instant: new Date('2027-07-01T12:00:00Z'),
    minutes: 210,
    rule: 'Iran abolished DST in 2022 (tzdata 2022b)',
  },
] as const;

/**
 * LA-13: shift instances and period windows are built from the runtime's ICU time-zone data. Stale data
 * shifts every summer shift of the pilot plant by an hour, so the processes report it at start-up.
 */
export function tzdataProblems(offsetAt: OffsetAt = zoneOffsetAt): string[] {
  return KNOWN_OFFSETS.flatMap(({ zone, instant, minutes, rule }) => {
    const actual = offsetAt(zone, instant);
    if (actual === minutes) return [];
    return [
      `${zone} at ${instant.toISOString()} is UTC${actual / 60 >= 0 ? '+' : ''}${actual / 60} h, expected +${minutes / 60} h: the runtime's time-zone data predates "${rule}"`,
    ];
  });
}
