import { StateSegment } from '../reliability/unit-state';
import { intersect, stateExposureOf, subtract } from './state-exposure';

const T0 = Date.parse('2026-10-17T00:00:00.000Z');
const at = (hours: number) => new Date(T0 + hours * 3_600_000);
const span = (from: number, to: number) => ({ start: at(from), end: at(to) });
const seg = (
  from: number,
  to: number,
  state: StateSegment['state'],
): StateSegment => ({
  ...span(from, to),
  state,
  unknownReason: state === 'unknown' ? 'no_data' : null,
});

describe('stateExposureOf (CA2 / SME D2, rca-exposure-v3)', () => {
  it('counts known running only: no data before commissioning and after the feed stops is not run time', () => {
    // 48 h window, data 06:00-31:00, a 1 h stop recorded at 08:00
    const timeline = [
      seg(0, 6, 'unknown'),
      seg(6, 8, 'running'),
      seg(8, 9, 'internal_stop'),
      seg(9, 14, 'reduced_rate'),
      seg(14, 31, 'running'),
      seg(31, 48, 'unknown'),
    ];
    const result = stateExposureOf([timeline], [span(8, 9)], span(0, 48));
    expect(result.runningSeconds).toBe(24 * 3600);
    expect(result.knownSeconds).toBe(25 * 3600);
    expect(result.unknownSeconds).toBe(23 * 3600);
    expect(result.coverage).toBeCloseTo(25 / 48, 10);
  });

  it('recorded downtime inside a running span is removed; a unit without a mapping has no known time', () => {
    const running = stateExposureOf(
      [[seg(0, 10, 'running')]],
      [span(2, 3)],
      span(0, 10),
    );
    expect(running.runningSeconds).toBe(9 * 3600);
    expect(running.coverage).toBe(1);
    const none = stateExposureOf([[]], [], span(0, 10));
    expect(none).toMatchObject({
      runningSeconds: 0,
      knownSeconds: 0,
      coverage: 0,
    });
    expect(stateExposureOf([], [], span(0, 10)).runningSeconds).toBe(0);
  });

  it('several units: exposed while all run, known only where every unit is known', () => {
    const a = [seg(0, 10, 'running')];
    const b = [
      seg(0, 4, 'running'),
      seg(4, 6, 'unknown'),
      seg(6, 10, 'blocked'),
    ];
    const result = stateExposureOf([a, b], [], span(0, 10));
    expect(result.runningSeconds).toBe(4 * 3600);
    expect(result.knownSeconds).toBe(8 * 3600);
  });

  it('interval helpers', () => {
    expect(intersect([span(0, 5), span(6, 9)], [span(4, 7)])).toEqual([
      span(4, 5),
      span(6, 7),
    ]);
    expect(subtract([span(0, 10)], [span(1, 2), span(5, 12)])).toEqual([
      span(0, 1),
      span(2, 5),
    ]);
  });
});
