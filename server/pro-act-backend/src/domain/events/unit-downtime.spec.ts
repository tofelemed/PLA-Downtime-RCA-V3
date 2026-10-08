import { computeUnitDowntime, DowntimeEventInput } from './unit-downtime';

const at = (time: string, day = '2026-10-07') =>
  new Date(`${day}T${time}:00.000Z`);
const event = (
  id: string,
  assetId: string | null,
  start: string,
  end: string | null,
): DowntimeEventInput => ({
  id,
  assetId,
  start: at(start),
  end: end ? at(end) : null,
});
const window = { start: at('06:00'), end: at('14:00') };
const later = at('23:00');

describe('computeUnitDowntime (DT05)', () => {
  it('T03: two assets down 10:00–11:00 and 10:30–11:30 → 5400 s for the unit, 3600 s each', () => {
    const result = computeUnitDowntime(
      [
        event('e1', 'a1', '10:00', '11:00'),
        event('e2', 'a2', '10:30', '11:30'),
      ],
      window,
      later,
    );
    expect(result.downtimeSeconds).toBe(5400);
    expect(result.assetSeconds).toEqual({ a1: 3600, a2: 3600 });
    expect(result.occurrenceCount).toBe(2);
  });

  it('T29: 05:50–06:20 counts 1200 s in the 06:00 shift, carried in, one occurrence', () => {
    const result = computeUnitDowntime(
      [event('e1', 'a1', '05:50', '06:20')],
      window,
      later,
    );
    expect(result.downtimeSeconds).toBe(1200);
    expect(result.occurrenceCount).toBe(1);
    expect(result.occurrences[0]).toMatchObject({
      carriedIn: true,
      carriedOut: false,
    });
  });

  it('bounds a running event at asOf and flags it as carried out', () => {
    const result = computeUnitDowntime(
      [event('e1', null, '12:00', null)],
      window,
      at('12:15'),
    );
    expect(result.downtimeSeconds).toBe(900);
    expect(result.assetSeconds).toEqual({ unassigned: 900 });
    expect(result.occurrences[0]).toMatchObject({
      carriedIn: false,
      carriedOut: true,
    });
  });

  it('ignores events outside the window and before asOf', () => {
    const result = computeUnitDowntime(
      [
        event('e1', 'a1', '14:00', '15:00'),
        event('e2', 'a1', '05:00', '06:00'),
        event('e3', 'a1', '13:00', null),
      ],
      window,
      at('12:00'),
    );
    expect(result.downtimeSeconds).toBe(0);
    expect(result.occurrenceCount).toBe(0);
  });

  it('KPI06: split fragments of one stop count as one occurrence (plan 1.4)', () => {
    const result = computeUnitDowntime(
      [
        { ...event('c1', 'a1', '10:00', '11:00'), occurrenceId: 'stop' },
        { ...event('c2', 'a1', '11:00', '12:00'), occurrenceId: 'stop' },
      ],
      window,
      later,
    );
    expect(result.downtimeSeconds).toBe(7200);
    expect(result.occurrenceCount).toBe(1);
    expect(result.occurrences.map(({ eventId }) => eventId)).toEqual([
      'c1',
      'c2',
    ]);
  });
});
