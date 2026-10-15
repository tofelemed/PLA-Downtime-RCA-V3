import * as fs from 'fs';
import * as path from 'path';
import { Dec, ZERO } from '../../src/domain/actuals/decimal';
import { selectAuthority } from '../../src/domain/actuals/period/authority';
import {
  ApprovedAdjustment,
  HierarchyEntry,
  SliceActuals,
  SourceAuthorityPolicy,
  SourceCandidate,
} from '../../src/domain/actuals/period/period-actuals.types';
import { computeSliceActuals } from '../../src/domain/actuals/period/slice-actuals';

/**
 * MS01 (SME E7): the measurement-source hierarchy through the period actuals engine (2.4.3) — ranked
 * sources at the reactor-outlet boundary, a substitution flag when a lower rank is used, a packing record
 * only with the silo stock change and lag accounted for (else `boundary_mismatch`, never silent), an
 * estimate only when approved and ranked, and a forecast never an input. The signal-level lag shift is
 * covered by `src/periods/period-actuals.compute.spec.ts`.
 */
type Expected = Record<string, string | null>;
const ms01 = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'MS01.json'), 'utf8'),
) as { expected: Record<string, Expected> };
const want = (key: string) => ms01.expected[key];

const T0 = Date.parse('2027-03-01T06:00:00Z');
const at = (hours: number) => new Date(T0 + hours * 3_600_000);
const window = { from: at(0), to: at(8) };
const gate = {
  requiredCoverageRatio: 1,
  allowProportionalEstimate: true,
  countApprovedSubstitutionsAsAccepted: true,
};

const entry = (overrides: Partial<HierarchyEntry>): HierarchyEntry => ({
  rank: 1,
  sourceClass: 'calibrated_primary',
  source: 'pi_counter',
  signalSourceKey: 'FT-101.TOT',
  boundary: 'reactor_outlet',
  boundaryAdjustment: null,
  ...overrides,
});

function policy(
  packingAccounted: boolean,
  withEstimate = true,
): SourceAuthorityPolicy {
  const entries = [
    entry({}),
    entry({
      rank: 2,
      sourceClass: 'redundant_measurement',
      signalSourceKey: 'FT-102.TOT',
    }),
    entry({
      rank: 3,
      sourceClass: 'reconciled_record',
      source: 'external_report',
      signalSourceKey: null,
      boundary: 'packing',
      boundaryAdjustment: {
        inventoryChangeAccounted: packingAccounted,
        lagSeconds: 7200,
        evidenceRef: 'silo S-1 stock change, packing lag 2 h',
      },
    }),
  ];
  if (withEstimate) {
    entries.push(
      entry({
        rank: 4,
        sourceClass: 'approved_estimate',
        source: 'manual',
        signalSourceKey: null,
      }),
    );
  }
  return {
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
      entries,
    },
  };
}

const measured = (
  source: SourceCandidate['source'],
  label: string,
  quantity: string | null,
): SourceCandidate => ({
  source,
  method: source === 'external_report' ? 'external_report' : 'counter_delta',
  label,
  basis: 'gross',
  quantity: quantity === null ? null : new Dec(quantity),
  reject: null,
  measured: quantity === null ? ZERO : new Dec(quantity),
  estimated: ZERO,
  uom: 't',
  available: quantity !== null,
  observed: quantity === null ? [] : [{ start: window.from, end: window.to }],
  segments: [],
  findings: [],
});

const totalizerDown = measured('pi_counter', 'signal:FT-101', null);
const redundantDown = measured('pi_counter', 'signal:FT-102', null);
const ESTIMATE: ApprovedAdjustment = {
  id: 'adj-195',
  kind: 'gross',
  quantity: new Dec(195),
  basis: 'estimated',
  window,
};

function actuals(
  of: SourceAuthorityPolicy,
  byRank: Record<number, SourceCandidate>,
  adjustments: ApprovedAdjustment[] = [],
): SliceActuals {
  const report = byRank[3];
  const selection = selectAuthority(
    of,
    {
      candidates: report ? { external_report: report } : {},
      byRank,
      ambiguous: [],
    },
    window,
  );
  return computeSliceActuals({
    window,
    gate,
    selection,
    adjustments,
    uom: 't',
  });
}

const codes = (result: SliceActuals) => result.findings.map((f) => f.code);

describe('MS01 measurement-source hierarchy (SME E7)', () => {
  it('a redundant meter at the same boundary stands in for the unavailable totalizer, flagged', () => {
    const expected = want('redundantMeter');
    const result = actuals(policy(true), {
      1: totalizerDown,
      2: measured('pi_counter', 'signal:FT-102', '200'),
    });
    expect(result.gross).toBe(expected.gross);
    expect(result.qualityState).toBe(expected.qualityState);
    expect(String(result.substitution?.used.rank)).toBe(expected.usedRank);
    expect(result.substitution?.used.sourceClass).toBe(expected.usedClass);
    expect(String(result.substitution?.replaced.rank)).toBe(
      expected.replacedRank,
    );
    expect(result.substitution?.replaced.sourceClass).toBe(
      expected.replacedClass,
    );
    expect(result.substitution?.reason).toBe(expected.reason);
  });

  it('a packing total without the silo stock change and lag is a boundary_mismatch, never a silent substitute', () => {
    const expected = want('packingUnaccounted');
    const result = actuals(policy(false), {
      1: totalizerDown,
      2: redundantDown,
      3: measured('external_report', 'external_report:PK-0301@1', '190'),
    });
    expect(result.gross).toBe(expected.gross);
    expect(result.qualityState).toBe(expected.qualityState);
    expect(codes(result)).toContain(expected.finding);
    expect(result.substitution).toBeNull();
  });

  it('the reconciled packing record (190 t bagged + 10 t silo stock rise) stands in once accounted for', () => {
    const expected = want('packingAccounted');
    const result = actuals(policy(true), {
      1: totalizerDown,
      2: redundantDown,
      3: measured('external_report', 'external_report:PK-0301@1', '200'),
    });
    expect(result.gross).toBe(expected.gross);
    expect(String(result.substitution?.used.rank)).toBe(expected.usedRank);
    expect(result.substitution?.used.sourceClass).toBe(expected.usedClass);
    expect(result.substitution?.crossBoundary?.fromBoundary).toBe(
      expected.fromBoundary,
    );
    expect(String(result.substitution?.crossBoundary?.lagSeconds)).toBe(
      expected.lagSeconds,
    );
    expect(codes(result)).toContain(expected.finding);
  });

  it('a 200 t forecast is not actual production: no measurement and no approved estimate is missing', () => {
    const expected = want('forecastOnly');
    const result = actuals(policy(true), {
      1: totalizerDown,
      2: redundantDown,
    });
    expect(result.gross).toBe(expected.gross);
    expect(result.qualityState).toBe(expected.qualityState);
  });

  it('an explicitly approved estimate stands in as the last rank, estimated and flagged', () => {
    const expected = want('approvedEstimate');
    const result = actuals(
      policy(true),
      { 1: totalizerDown, 2: redundantDown },
      [ESTIMATE],
    );
    expect(result.gross).toBe(expected.gross);
    expect(result.measuredQty).toBe(expected.measuredQty);
    expect(result.estimatedQty).toBe(expected.estimatedQty);
    expect(result.substitution?.used.sourceClass).toBe(expected.usedClass);
    expect(result.substitution?.reason).toBe(expected.reason);
  });

  it('an estimate the hierarchy does not rank is a problem', () => {
    const expected = want('estimateWithoutRank');
    const result = actuals(
      policy(true, false),
      { 1: totalizerDown, 2: redundantDown },
      [ESTIMATE],
    );
    expect(codes(result)).toContain(expected.finding);
    expect(result.qualityState).toBe(expected.qualityState);
    expect(result.substitution).toBeNull();
  });
});
