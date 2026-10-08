import * as fs from 'fs';
import * as path from 'path';
import {
  EngineSample,
  EngineSignal,
} from '../../src/domain/actuals/actuals.types';
import {
  counterDelta,
  impliedRate,
} from '../../src/domain/actuals/counter-delta';
import { Dec } from '../../src/domain/actuals/decimal';
import { integrateRate } from '../../src/domain/actuals/rate-integration';

/**
 * Spec §19.1 T25–T27 run against the quantity engine (plan 1.7). The fixtures leave `maxGapSeconds`
 * open; one hour covers their sample spacing.
 */
interface Point {
  t: string;
  v: string;
  q?: string;
}

function fixture(id: string): {
  inputs: Record<string, unknown>;
  expected: Record<string, unknown>;
  tolerance: string;
} {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, `${id}.json`), 'utf8'),
  ) as never;
}

const samplesOf = (points: Point[]): EngineSample[] =>
  points.map((point) => ({
    at: new Date(point.t),
    value: point.v,
    quality: (point.q ?? 'good') as EngineSample['quality'],
  }));

const within = (actual: string | null, expected: string, tolerance: string) =>
  actual !== null &&
  new Dec(actual).minus(expected).abs().lte(new Dec(tolerance));

describe('T25 rate integration', () => {
  const { inputs, expected, tolerance } = fixture('T25');
  const spec = inputs.signal as Record<string, string>;
  const window = inputs.window as { from: string; to: string };

  it.each(['step', 'linear'] as const)('%s', (interpolation) => {
    const signal: EngineSignal = {
      semanticType: spec.semanticType,
      interpolation,
      rateTimebase: spec.timebase as EngineSignal['rateTimebase'],
      canonicalUom: spec.uom,
      maxGapSeconds: 3600,
    };
    const result = integrateRate(samplesOf(inputs.samples as Point[]), signal, {
      from: new Date(window.from),
      to: new Date(window.to),
    });

    expect(
      within(result.quantity, expected.quantity as string, tolerance),
    ).toBe(true);
    expect(result.method.uom).toBe(expected.uom);
    expect(result.method.timebaseSeconds).toBe(3600);
    expect(result.coverage.ratio).toBe(expected.coverageRatio);
    if (interpolation === 'step')
      expect(result.method.name).toBe(expected.method);
  });
});

describe('T26 counter rollover', () => {
  const { inputs, expected, tolerance } = fixture('T26');
  const spec = inputs.signal as Record<string, string>;
  const readings = inputs.readings as Point[];
  const window = {
    from: new Date(readings[0].t),
    to: new Date(readings[readings.length - 1].t),
  };
  const signal = (expectedMax: string): EngineSignal => ({
    semanticType: spec.semanticType,
    interpolation: 'step',
    maxGapSeconds: 3600,
    resetPolicy: 'detect_drop',
    rolloverModulus: spec.rolloverModulus,
    rateTimebase: 'h',
    expectedMax,
  });

  it('accepts M − a + b when the implied rate is within the limit', () => {
    const result = counterDelta(
      samplesOf(readings),
      signal(spec.expectedMaxRatePerHour),
      window,
    );

    expect(within(result.quantity, expected.delta as string, tolerance)).toBe(
      true,
    );
    const rate = impliedRate(
      new Dec(expected.delta as string),
      window.to.getTime() - window.from.getTime(),
      signal(spec.expectedMaxRatePerHour),
    );
    expect(rate.toFixed()).toBe(expected.impliedRatePerHour);
  });

  it('rejects when the implied rate exceeds the limit', () => {
    const limit = new Dec(expected.impliedRatePerHour as string)
      .minus(1)
      .toFixed();
    const result = counterDelta(samplesOf(readings), signal(limit), window);

    expect(result.quantity).toBeNull();
    expect(result.exceptions[0].code).toBe('rate_implausible');
  });
});

describe('T27 counter reset with unknown reset time', () => {
  const { inputs, expected } = fixture('T27');
  const spec = inputs.signal as Record<string, string | null>;
  const readings = inputs.readings as Point[];

  it('is null with reset_unresolved and never a forbidden value', () => {
    const result = counterDelta(
      samplesOf(readings),
      {
        semanticType: spec.semanticType as string,
        interpolation: 'step',
        maxGapSeconds: 3600,
        resetPolicy: spec.resetPolicy as EngineSignal['resetPolicy'],
        rolloverModulus: spec.rolloverModulus,
      },
      { from: new Date(readings[0].t), to: new Date(readings[1].t) },
    );

    expect(result.quantity).toBe(expected.quantity);
    expect(result.qualityState).toBe(expected.qualityState);
    expect(result.exceptions.map((e) => e.code)).toContain(expected.exception);
    expect(expected.forbiddenValues).not.toContain(result.quantity);
  });
});
