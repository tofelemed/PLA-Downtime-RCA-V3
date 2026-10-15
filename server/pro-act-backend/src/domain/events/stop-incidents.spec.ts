import { groupIncidents, IncidentStop, stoppedSeconds } from './stop-incidents';

const T0 = Date.UTC(2026, 9, 15, 10);
const m = (minutes: number) => new Date(T0 + minutes * 60_000);

const stop = (
  id: string,
  span: [number, number | null],
  extra: Partial<IncidentStop> = {},
): IncidentStop => ({
  occurrenceId: id,
  unitId: 'u1',
  assetId: 'conveyor',
  reasonCodeId: 'jam',
  start: m(span[0]),
  end: span[1] === null ? null : m(span[1]),
  ...extra,
});

const OPTIONS = { windowSeconds: 120, breaks: new Set<string>() };

describe('repeat stops grouped into incidents (SME D5, S3)', () => {
  it('SME example: 10:00–10:03 and 10:05–10:09 are one incident of two stops; stopped time 7 min, not 9', () => {
    const stops = [stop('s1', [0, 3]), stop('s2', [5, 9])];
    const [incident] = groupIncidents(stops, OPTIONS);
    expect(incident).toMatchObject({
      firstOccurrenceId: 's1',
      occurrenceIds: ['s1', 's2'],
      start: m(0),
      end: m(9),
    });
    const byId = new Map(stops.map((s) => [s.occurrenceId, s]));
    expect(stoppedSeconds(incident, byId, m(60))).toBe(7 * 60);
  });

  it('a restart longer than the window starts a new failure', () => {
    expect(
      groupIncidents([stop('s1', [0, 3]), stop('s2', [6, 9])], OPTIONS),
    ).toEqual([]);
  });

  it('another reason or another asset is not a repeat; stops without a reason are never grouped', () => {
    expect(
      groupIncidents(
        [
          stop('s1', [0, 3]),
          stop('s2', [4, 6], { reasonCodeId: 'motor' }),
          stop('s3', [7, 8], { assetId: 'bagger' }),
          stop('n1', [20, 21], { reasonCodeId: null }),
          stop('n2', [22, 23], { reasonCodeId: null }),
        ],
        OPTIONS,
      ),
    ).toEqual([]);
  });

  it('chains through several repeats and stops at an open stop', () => {
    const [incident] = groupIncidents(
      [
        stop('s1', [0, 1]),
        stop('s2', [2, 3]),
        stop('s3', [4, null]),
        stop('s4', [5, 6]),
      ],
      OPTIONS,
    );
    expect(incident.occurrenceIds).toEqual(['s1', 's2', 's3']);
    expect(incident.end).toBeNull();
  });

  it('a stop marked as a new failure after a verified repair starts a new chain', () => {
    const incidents = groupIncidents(
      [
        stop('s1', [0, 1]),
        stop('s2', [2, 3]),
        stop('s3', [4, 5]),
        stop('s4', [6, 7]),
      ],
      { windowSeconds: 120, breaks: new Set(['s3']) },
    );
    expect(incidents.map((i) => i.occurrenceIds)).toEqual([
      ['s1', 's2'],
      ['s3', 's4'],
    ]);
  });

  it('property: the grouping does not depend on the input order', () => {
    const stops = [
      stop('a', [0, 1]),
      stop('b', [2, 3]),
      stop('c', [30, 31]),
      stop('d', [32, 33]),
    ];
    const expected = groupIncidents(stops, OPTIONS);
    expect(groupIncidents([...stops].reverse(), OPTIONS)).toEqual(expected);
  });
});
