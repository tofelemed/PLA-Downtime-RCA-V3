import * as fs from 'fs';
import * as path from 'path';
import { Dec } from '../../src/domain/actuals/decimal';
import { VersionRef } from '../../src/domain/profiles/profile.types';
import {
  formatRate,
  idealProductionSeconds,
  quantityOver,
} from '../../src/domain/profiles/rate-math';
import {
  segmentsByVersion,
  versionAt,
} from '../../src/domain/profiles/version-window';

/**
 * Rate-version inputs of spec §19.1 (plan 2.2): T30 (rate version change during a stop) and the T20
 * ideal-time input, computed with the profile domain. The loss lines themselves are 2.5's; here the
 * versions must resolve and split exactly so 2.5 gets the right inputs.
 */
interface Fixture {
  inputs: Record<string, unknown>;
  expected: Record<string, unknown>;
  tolerance: string;
}

function fixture(id: string): Fixture {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, `${id}.json`), 'utf8'),
  ) as Fixture;
}

const within = (actual: Dec, expected: string, tolerance: string) =>
  actual.minus(expected).abs().lte(new Dec(tolerance));

interface StopSegment {
  minutes: string;
  sustainedRatePerHour: string;
  rateVersion: string;
}

type RateVersion = VersionRef & { rate: string };

describe('T30 rate versions (input to 2.5)', () => {
  const { inputs, expected, tolerance } = fixture('T30');
  const segments = inputs.stopSegments as StopSegment[];
  // the stop starts at 10:00; the rate changes when the first segment ends (10:30)
  const stopStart = new Date('2026-10-09T10:00:00Z');
  const versions: RateVersion[] = [];
  let cursor = stopStart.getTime() - 3_600_000;
  segments.forEach((segment, i) => {
    const boundary = stopStart.getTime() + Number(segments[0].minutes) * 60_000;
    const last = i === segments.length - 1;
    versions.push({
      id: segment.rateVersion,
      version: i + 1,
      rate: segment.sustainedRatePerHour,
      from: new Date(cursor),
      to: last ? null : new Date(boundary),
    });
    cursor = boundary;
  });
  const stopEnd = new Date(
    stopStart.getTime() +
      segments.reduce((sum, s) => sum + Number(s.minutes), 0) * 60_000,
  );

  it('resolves 100 t/h at 10:15 and 120 t/h at 10:45', () => {
    expect(versionAt(versions, new Date('2026-10-09T10:15:00Z'))?.rate).toBe(
      '100',
    );
    expect(versionAt(versions, new Date('2026-10-09T10:45:00Z'))?.rate).toBe(
      '120',
    );
  });

  it('splits the stop into one segment per rate version and values each at its own rate', () => {
    const split = segmentsByVersion(versions, { from: stopStart, to: stopEnd });
    expect(split).toHaveLength(Number(expected.lines));
    expect(split.map((s) => s.version?.id)).toEqual(expected.rateVersionsUsed);
    const capacityLoss = split.reduce(
      (sum, s) =>
        sum.plus(
          quantityOver(
            { rate: s.version?.rate ?? '0', timebase: 'h' },
            (s.to.getTime() - s.from.getTime()) / 1000,
          ),
        ),
      new Dec(0),
    );
    expect(
      within(capacityLoss, String(expected.capacityLossQty), tolerance),
    ).toBe(true);
  });
});

describe('T20 ideal production time input', () => {
  const { inputs, expected } = fixture('T20');

  it('gives gross 756 at 2/min an ideal time of 22 680 s (P = 0.9 over 25 200 s run time)', () => {
    const seconds = idealProductionSeconds(String(inputs.grossQty), {
      rate: String(inputs.idealRatePerMinute),
      timebase: 'min',
    });
    expect(seconds.toFixed()).toBe('22680');
    expect(formatRate(seconds.div(String(expected.runTimeSeconds)))).toBe(
      String(expected.performance),
    );
  });
});
