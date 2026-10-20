import { Dec } from '../../domain/actuals/decimal';
import { classify, median } from './chronic-sporadic';

const cell = (key: string, stops: number, seconds: number) => ({
  key,
  stops: new Dec(stops),
  seconds: new Dec(seconds),
});

describe('chronic vs sporadic (R7)', () => {
  it('cuts the quadrants at the medians of frequency and mean stop length', () => {
    const { rows, medianStops, medianMean } = classify([
      cell('feeder', 40, 4000), // frequent, 100 s each → chronic
      cell('gearbox', 2, 36000), // rare, 5 h each → sporadic
      cell('extruder', 30, 60000), // frequent and long → major
      cell('sensor', 1, 60), // rare and short → minor
    ]);
    expect(medianStops?.toString()).toBe('16');
    expect(medianMean?.toString()).toBe('1050');
    expect(rows.map((r) => r.quadrant)).toEqual([
      'chronic',
      'sporadic',
      'major',
      'minor',
    ]);
    expect(rows[1].meanSeconds).toBe('18000');
  });

  it('leaves a cause without stops out of the medians and unclassified', () => {
    const { rows, medianStops } = classify([
      cell('a', 0, 100),
      cell('b', 3, 300),
    ]);
    expect(medianStops?.toString()).toBe('3');
    expect(rows[0]).toMatchObject({ meanSeconds: null, quadrant: null });
  });

  it('median of nothing is null', () => {
    expect(median([])).toBeNull();
  });
});
