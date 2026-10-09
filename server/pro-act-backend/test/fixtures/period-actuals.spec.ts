import * as fs from 'fs';
import * as path from 'path';
import {
  EngineSample,
  EngineSignal,
} from '../../src/domain/actuals/actuals.types';
import { counterDelta } from '../../src/domain/actuals/counter-delta';
import { selectAuthority } from '../../src/domain/actuals/period/authority';
import { CoverageGatePolicy } from '../../src/domain/actuals/period/period-actuals.types';
import { signalCandidate } from '../../src/domain/actuals/period/signal-candidate';
import { computeSliceActuals } from '../../src/domain/actuals/period/slice-actuals';
import { integrateRate } from '../../src/domain/actuals/rate-integration';
import { SOURCE_AUTHORITY_DEFAULT } from '../../src/periods/policy-bodies';

/**
 * Spec §19.1 T25–T27 through the period engine of plan 2.4 (signal candidate → D05 authority → slice
 * result): the persisted shape carries the method, the quantity (60 t, 10, null + exception) and the
 * coverage; the persisted versions run in `periods-actuals.int-spec.ts`.
 */
interface Point {
  t: string;
  v: string;
}

const fixture = (id: string) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, `${id}.json`), 'utf8')) as {
    inputs: Record<string, unknown>;
    expected: Record<string, unknown>;
  };
const samples = (points: Point[]): EngineSample[] =>
  points.map((p) => ({ at: new Date(p.t), value: p.v, quality: 'good' }));
const gate: CoverageGatePolicy = {
  requiredCoverageRatio: 1,
  allowProportionalEstimate: true,
  countApprovedSubstitutionsAsAccepted: true,
};

function slice(
  source: ReturnType<typeof signalCandidate>,
  window: { from: Date; to: Date },
) {
  const selection = selectAuthority(
    {
      ...SOURCE_AUTHORITY_DEFAULT,
      primarySource: source.source,
      fallback: null,
    },
    { candidates: { [source.source]: source }, ambiguous: [] },
    window,
  );
  return computeSliceActuals({
    window,
    gate,
    selection,
    adjustments: [],
    uom: null,
  });
}

describe('T25–T27 through the period engine (plan 2.4)', () => {
  it('T25: rate integration 60 t, method rate_integration, coverage 1', () => {
    const { inputs, expected } = fixture('T25');
    const spec = inputs.signal as Record<string, string>;
    const window = inputs.window as { from: string; to: string };
    const signal: EngineSignal = {
      semanticType: 'rate',
      interpolation: 'step',
      rateTimebase: 'h',
      canonicalUom: spec.uom,
      maxGapSeconds: 3600,
    };
    const w = { from: new Date(window.from), to: new Date(window.to) };
    const result = slice(
      signalCandidate(
        'pi_rate',
        's',
        integrateRate(samples(inputs.samples as Point[]), signal, w),
      ),
      w,
    );
    expect(result).toMatchObject({
      gross: expected.quantity,
      method: 'rate_integration',
      coverageRatio: '1',
    });
  });

  it('T26: rollover 995 → 5 is 10', () => {
    const { inputs, expected } = fixture('T26');
    const readings = inputs.readings as Point[];
    const w = {
      from: new Date(readings[0].t),
      to: new Date(readings[readings.length - 1].t),
    };
    const signal: EngineSignal = {
      semanticType: 'counter',
      interpolation: 'step',
      maxGapSeconds: 3600,
      resetPolicy: 'detect_drop',
      rolloverModulus: '1000',
      expectedMax: '500',
      rateTimebase: 'h',
    };
    const result = slice(
      signalCandidate(
        'pi_counter',
        'c',
        counterDelta(samples(readings), signal, w),
      ),
      w,
    );
    expect(result).toMatchObject({
      gross: expected.delta,
      method: 'counter_delta',
      coverageRatio: '1',
    });
  });

  it('T27: an unresolved reset is null with reset_unresolved, quality partial', () => {
    const { inputs } = fixture('T27');
    const readings = inputs.readings as Point[];
    const w = { from: new Date(readings[0].t), to: new Date(readings[1].t) };
    const signal: EngineSignal = {
      semanticType: 'counter',
      interpolation: 'step',
      maxGapSeconds: 3600,
      resetPolicy: 'detect_drop',
    };
    const result = slice(
      signalCandidate(
        'pi_counter',
        'c',
        counterDelta(samples(readings), signal, w),
      ),
      w,
    );
    expect(result).toMatchObject({
      gross: null,
      good: null,
      qualityState: 'partial',
    });
    expect(result.findings.map((f) => f.code)).toContain('reset_unresolved');
  });
});
