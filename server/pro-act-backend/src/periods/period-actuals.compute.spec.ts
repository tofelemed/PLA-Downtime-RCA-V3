import { EngineSample } from '../domain/actuals/actuals.types';
import {
  HierarchyEntry,
  SourceAuthorityPolicy,
} from '../domain/actuals/period/period-actuals.types';
import { Signal } from '../signals/entities/signal.entity';
import { ResolvedPolicies } from './accounting-policies.service';
import { PeriodInputs, SignalInput } from './actuals-inputs.loader';
import { PeriodProductSlice } from './entities/period-product-slice.entity';
import { computePeriodActuals } from './period-actuals.compute';
import { COVERAGE_GATE_DEFAULT } from './policy-bodies';

const T0 = Date.parse('2027-03-01T06:00:00Z');
const at = (hours: number) => new Date(T0 + hours * 3_600_000);

const slice = {
  id: 'slice-1',
  productId: 'product-hdpe',
  windowFrom: at(0),
  windowTo: at(8),
  quantityUom: 't',
} as unknown as PeriodProductSlice;

function signal(sourceKey: string, isAuthority = false): Signal {
  return {
    id: `signal-${sourceKey}`,
    sourceKey,
    productId: null,
    isAuthority,
    version: 1,
    semanticType: 'counter',
    interpolation: 'step',
    maxGapSeconds: 3600,
    rateTimebase: null,
    resetPolicy: 'none',
    rolloverModulus: null,
    expectedMin: null,
    expectedMax: null,
    qualityPolicy: {},
    canonicalUom: 't',
  } as unknown as Signal;
}

/** Hourly totalizer readings from `fromHour` to `toHour`, +25 t an hour. */
function hourly(fromHour: number, toHour: number): EngineSample[] {
  return Array.from({ length: toHour - fromHour + 1 }, (_, i) => ({
    at: at(fromHour + i),
    value: String(1000 + 25 * i),
    quality: 'good' as const,
  }));
}

const input = (
  source: SignalInput['source'],
  of: Signal,
  samples: EngineSample[],
): SignalInput => ({
  signal: of,
  source,
  samples,
  versions: 1,
  truncated: false,
});

const entry = (overrides: Partial<HierarchyEntry>): HierarchyEntry => ({
  rank: 1,
  sourceClass: 'calibrated_primary',
  source: 'pi_counter',
  signalSourceKey: null,
  boundary: 'reactor_outlet',
  boundaryAdjustment: null,
  ...overrides,
});

function policies(packingAccounted: boolean): ResolvedPolicies {
  const sourceAuthority: SourceAuthorityPolicy = {
    measurement: 'output',
    productId: null,
    primarySource: 'pi_counter',
    fallback: null,
    cadenceSeconds: 60,
    conflictTolerance: 0,
    overrideRole: 'integration_admin',
    measurementHierarchy: {
      boundary: 'reactor_outlet',
      conditions: ['primary_missing', 'primary_stale', 'primary_bad_quality'],
      entries: [
        entry({ rank: 1, signalSourceKey: 'FT-101.TOT' }),
        entry({
          rank: 2,
          sourceClass: 'redundant_measurement',
          signalSourceKey: 'FT-102.TOT',
        }),
        entry({
          rank: 3,
          sourceClass: 'reconciled_record',
          source: 'mqtt',
          signalSourceKey: 'PK-1.BAGGED',
          boundary: 'packing',
          boundaryAdjustment: {
            inventoryChangeAccounted: packingAccounted,
            lagSeconds: 7200,
            evidenceRef: 'silo S-1 level-to-mass reconciliation PA-2027-03',
          },
        }),
      ],
    },
  };
  return {
    coverageGate: COVERAGE_GATE_DEFAULT,
    sourceAuthority,
    refs: [],
    sourceAuthorityId: 'policy-1',
  };
}

function inputs(signals: SignalInput[]): PeriodInputs {
  return { events: [], stops: [], signals, adjustments: [], reportLines: [] };
}

const primary = signal('FT-101.TOT', true);
const redundant = signal('FT-102.TOT');
const packing = signal('PK-1.BAGGED');

describe('computePeriodActuals with an SME E7 measurement hierarchy', () => {
  it('a redundant meter named by its signal stands in for the unavailable totalizer, flagged', () => {
    const result = computePeriodActuals(
      [slice],
      inputs([
        input('pi_counter', primary, []),
        input('pi_counter', redundant, hourly(0, 8)),
      ]),
      policies(true),
    ).get('slice-1');
    expect(result?.gross).toBe('200');
    expect(result?.qualityState).toBe('complete');
    expect(result?.substitution).toMatchObject({
      used: { rank: 2, sourceClass: 'redundant_measurement' },
      replaced: { rank: 1, sourceClass: 'calibrated_primary' },
      reason: 'primary_missing',
      crossBoundary: null,
    });
    expect(result?.findings.map((f) => f.code)).not.toContain(
      'ambiguous_signal',
    );
  });

  it('a packing counter 2 h downstream counts over the lagged window once the stock change is accounted for', () => {
    const result = computePeriodActuals(
      [slice],
      inputs([
        input('pi_counter', primary, []),
        input('pi_counter', redundant, []),
        input('mqtt', packing, hourly(2, 10)),
      ]),
      policies(true),
    ).get('slice-1');
    expect(result?.gross).toBe('200');
    expect(result?.coverageRatio).toBe('1');
    expect(result?.substitution?.crossBoundary).toEqual({
      fromBoundary: 'packing',
      lagSeconds: 7200,
      evidenceRef: 'silo S-1 level-to-mass reconciliation PA-2027-03',
    });
    expect(result?.findings.map((f) => f.code)).toContain(
      'cross_boundary_substitution',
    );
  });

  it('without the stock change the packing total is never a silent substitute', () => {
    const result = computePeriodActuals(
      [slice],
      inputs([
        input('pi_counter', primary, []),
        input('pi_counter', redundant, []),
        input('mqtt', packing, hourly(2, 10)),
      ]),
      policies(false),
    ).get('slice-1');
    expect(result?.gross).toBeNull();
    expect(result?.substitution).toBeNull();
    expect(result?.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'boundary_mismatch',
          severity: 'problem',
        }),
      ]),
    );
  });
});
