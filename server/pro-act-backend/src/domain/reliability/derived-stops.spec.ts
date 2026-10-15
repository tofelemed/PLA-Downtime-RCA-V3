import { deriveStops, STOP_DERIVATION_DEFAULTS } from './derived-stops';
import { StateSegment } from './unit-state';

const T0 = Date.UTC(2026, 9, 15, 10);
const t = (s: number) => new Date(T0 + s * 1000);

type Spec = [state: StateSegment['state'], seconds: number];

/** contiguous segments from T0 with the given states and lengths */
function timeline(...specs: Spec[]): StateSegment[] {
  let at = 0;
  return specs.map(([state, seconds]) => {
    const segment: StateSegment = {
      start: t(at),
      end: t(at + seconds),
      state,
      unknownReason: state === 'unknown' ? 'stale' : null,
    };
    at += seconds;
    return segment;
  });
}

const derive = (segments: StateSegment[], liveEdge: Date | null = null) =>
  deriveStops(segments, STOP_DERIVATION_DEFAULTS, liveEdge);

const spans = (segments: StateSegment[], liveEdge: Date | null = null) =>
  derive(segments, liveEdge).map((s) => [
    s.state,
    (s.start.getTime() - T0) / 1000,
    s.end ? (s.end.getTime() - T0) / 1000 : null,
  ]);

describe('derived stops from the unit state timeline (plan 1.10, SME D1 / D2)', () => {
  it('a 90 s internal stop is one unplanned downtime event from the first stop sample to the first recovery', () => {
    const stops = derive(
      timeline(['running', 600], ['internal_stop', 90], ['running', 600]),
    );
    expect(stops).toHaveLength(1);
    expect(stops[0]).toMatchObject({
      state: 'internal_stop',
      scheduleClass: 'unplanned',
      start: t(600),
      end: t(690),
      startAfterUnknown: false,
      endBeforeUnknown: false,
    });
  });

  it('a 3 s dip is chatter below the 5 s debounce: no stop', () => {
    expect(
      spans(timeline(['running', 60], ['internal_stop', 3], ['running', 60])),
    ).toEqual([]);
  });

  it('a 4 s restart between two stop samples is not confirmed: one continuous stop', () => {
    expect(
      spans(
        timeline(
          ['running', 60],
          ['internal_stop', 30],
          ['running', 4],
          ['internal_stop', 30],
          ['running', 60],
        ),
      ),
    ).toEqual([['internal_stop', 60, 124]]);
  });

  it('a restart of 10 s or more is confirmed: two stops (the confirmation delay is not added)', () => {
    expect(
      spans(
        timeline(
          ['running', 60],
          ['internal_stop', 30],
          ['running', 10],
          ['internal_stop', 30],
          ['running', 60],
        ),
      ),
    ).toEqual([
      ['internal_stop', 60, 90],
      ['internal_stop', 100, 130],
    ]);
  });

  it('maps each stop state to its schedule class; running and not scheduled produce nothing', () => {
    const stops = derive(
      timeline(
        ['planned_stop', 60],
        ['running', 60],
        ['starved', 60],
        ['running', 60],
        ['blocked', 60],
        ['running', 60],
        ['standby', 60],
        ['not_scheduled', 600],
      ),
    );
    expect(stops.map((s) => [s.state, s.scheduleClass])).toEqual([
      ['planned_stop', 'planned'],
      ['starved', 'external'],
      ['blocked', 'external'],
      ['standby', 'planned'],
    ]);
  });

  it('unknown time is never a stop: a stale signal after running derives nothing', () => {
    expect(spans(timeline(['running', 60], ['unknown', 300]))).toEqual([]);
  });

  it('a stop running into unknown time ends at the last known instant (lower bound), never filled', () => {
    const [stop] = derive(
      timeline(['running', 60], ['internal_stop', 120], ['unknown', 300]),
    );
    expect(stop).toMatchObject({ end: t(180), endBeforeUnknown: true });
  });

  it('the same stop resuming after unknown time is a second event of the same occurrence', () => {
    const stops = derive(
      timeline(
        ['internal_stop', 120],
        ['unknown', 300],
        ['internal_stop', 60],
        ['running', 60],
      ),
    );
    expect(stops).toHaveLength(2);
    expect(stops[1].occurrenceKey).toBe(stops[0].occurrenceKey);
    expect(stops[1].startAfterUnknown).toBe(true);
  });

  it('contiguous different stop states are separate events of one occurrence', () => {
    const stops = derive(
      timeline(
        ['running', 60],
        ['internal_stop', 120],
        ['starved', 300],
        ['running', 60],
      ),
    );
    expect(stops.map((s) => s.state)).toEqual(['internal_stop', 'starved']);
    expect(new Set(stops.map((s) => s.occurrenceKey)).size).toBe(1);
  });

  it('a 2 s state flicker inside a stop keeps the stop state (debounce)', () => {
    expect(
      spans(
        timeline(
          ['running', 60],
          ['internal_stop', 60],
          ['starved', 2],
          ['internal_stop', 60],
          ['running', 60],
        ),
      ),
    ).toEqual([['internal_stop', 60, 182]]);
  });

  it('a stop reaching the live edge is open; shorter than the debounce it is not yet confirmed', () => {
    expect(
      spans(timeline(['running', 60], ['internal_stop', 30]), t(90)),
    ).toEqual([['internal_stop', 60, null]]);
    expect(
      spans(timeline(['running', 60], ['internal_stop', 3]), t(63)),
    ).toEqual([]);
  });

  it('is deterministic: the same timeline gives the same keys (idempotent reprocessing)', () => {
    const segments = timeline(
      ['running', 60],
      ['internal_stop', 90],
      ['running', 60],
    );
    expect(derive(segments).map((s) => s.key)).toEqual(
      derive(segments).map((s) => s.key),
    );
  });

  it('property: derived stops never overlap and their time never exceeds the stop-state time', () => {
    const states: StateSegment['state'][] = [
      'running',
      'internal_stop',
      'starved',
      'unknown',
      'planned_stop',
    ];
    for (let seed = 1; seed <= 50; seed += 1) {
      let x = seed;
      const next = () => {
        x = (x * 1103515245 + 12345) % 2147483648;
        return x;
      };
      const specs: Spec[] = Array.from({ length: 30 }, () => [
        states[next() % states.length],
        1 + (next() % 120),
      ]);
      const segments = timeline(...specs);
      const stops = derive(segments);
      for (let i = 1; i < stops.length; i += 1) {
        expect(stops[i].start.getTime()).toBeGreaterThanOrEqual(
          (stops[i - 1].end as Date).getTime(),
        );
      }
      const stopTime = specs
        .filter(([state]) => !['running', 'unknown'].includes(state))
        .reduce((total, [, seconds]) => total + seconds, 0);
      const derived = stops.reduce(
        (total, s) =>
          total + ((s.end as Date).getTime() - s.start.getTime()) / 1000,
        0,
      );
      const restarts = specs
        .filter(([state, seconds]) => state === 'running' && seconds < 10)
        .reduce((total, [, seconds]) => total + seconds, 0);
      expect(derived).toBeLessThanOrEqual(stopTime + restarts);
    }
  });
});
