import { Dec, ZERO } from '../decimal';
import { AuthoritySelection } from './authority';
import {
  ApprovedAdjustment,
  CoverageGatePolicy,
  SourceCandidate,
} from './period-actuals.types';
import { computeSliceActuals } from './slice-actuals';

const t = (hhmm: string) => new Date(`2027-03-01T${hhmm}:00Z`);
const window = { from: t('06:00'), to: t('14:00') };
const gate: CoverageGatePolicy = {
  requiredCoverageRatio: 1,
  allowProportionalEstimate: true,
  countApprovedSubstitutionsAsAccepted: true,
};

const source = (overrides: Partial<SourceCandidate> = {}): SourceCandidate => ({
  source: 'pi_counter',
  method: 'counter_delta',
  label: 'signal:c',
  basis: 'gross',
  quantity: new Dec(60),
  reject: new Dec(5),
  measured: new Dec(60),
  estimated: ZERO,
  uom: 't',
  available: true,
  observed: [{ start: window.from, end: window.to }],
  segments: [],
  findings: [],
  ...overrides,
});

const selected = (candidate: SourceCandidate | null): AuthoritySelection => ({
  selected: candidate,
  role: candidate ? 'primary' : null,
  findings: [],
});

const adjustment = (
  overrides: Partial<ApprovedAdjustment>,
): ApprovedAdjustment => ({
  id: 'adj-1',
  kind: 'gross',
  quantity: new Dec(10),
  basis: 'measured',
  window: null,
  ...overrides,
});

const run = (
  candidate: SourceCandidate | null,
  adjustments: ApprovedAdjustment[] = [],
) =>
  computeSliceActuals({
    window,
    gate,
    selection: selected(candidate),
    adjustments,
    uom: 't',
  });

describe('computeSliceActuals (ACT01, ACT05–ACT07)', () => {
  it('good = gross − reject on a gross basis; complete with full coverage', () => {
    const result = run(source());
    expect(result).toMatchObject({
      gross: '60',
      good: '55',
      reject: '5',
      method: 'counter_delta',
      coverageRatio: '1',
      measuredQty: '60',
      estimatedQty: '0',
      qualityState: 'complete',
    });
  });

  it('rejects unknown: good = gross, reject null, flagged (no invented quality factor)', () => {
    const result = run(source({ reject: null }));
    expect(result.reject).toBeNull();
    expect(result.good).toBe('60');
    expect(result.findings.map((f) => f.code)).toContain(
      'rejects_not_measured',
    );
  });

  it('only good known: gross null, basis good', () => {
    const result = run(
      source({ basis: 'good', quantity: new Dec(40), reject: null }),
    );
    expect(result).toMatchObject({ gross: null, good: '40', basis: 'good' });
  });

  it('missing 10 % of the window → coverage 0.9, measured quantity only, partial', () => {
    const result = run(
      source({
        observed: [
          { start: window.from, end: new Date(window.to.getTime() - 2880_000) },
        ],
      }),
    );
    expect(result.coverageRatio).toBe('0.9');
    expect(result.measuredQty).toBe('60');
    expect(result.qualityState).toBe('partial');
  });

  it('no data at all → missing (null, never zero)', () => {
    const result = run(null);
    expect(result).toMatchObject({
      gross: null,
      good: null,
      qualityState: 'missing',
      method: null,
      coverageRatio: '0',
    });
  });

  it('approved adjustments are a separate component; method mixed; estimated share exposed', () => {
    const result = run(source(), [
      adjustment({ quantity: new Dec(10), basis: 'estimated' }),
      adjustment({ id: 'adj-2', kind: 'rework', quantity: new Dec(2) }),
    ]);
    expect(result).toMatchObject({
      gross: '70',
      reject: '5',
      reworkAccepted: '2',
      good: '67',
      method: 'mixed',
      measuredQty: '60',
      estimatedQty: '10',
      adjustmentIds: ['adj-1', 'adj-2'],
    });
  });

  it('an approved substitution with a window counts toward coverage', () => {
    const result = run(
      source({ observed: [{ start: window.from, end: t('13:00') }] }),
      [adjustment({ window: { from: t('13:00'), to: t('14:00') } })],
    );
    expect(result.coverageRatio).toBe('1');
    expect(result.coverage.substitutedSeconds).toBe(3600);
  });

  it('a unit mismatch is never converted', () => {
    const result = run(source({ uom: 'kg' }));
    expect(result.gross).toBeNull();
    expect(result.findings.map((f) => f.code)).toContain('uom_mismatch');
  });

  it('a source conflict makes the slice quality conflict', () => {
    const result = computeSliceActuals({
      window,
      gate,
      selection: {
        ...selected(source()),
        findings: [{ code: 'source_conflict', severity: 'problem' }],
      },
      adjustments: [],
      uom: 't',
    });
    expect(result.qualityState).toBe('conflict');
    expect(result.gross).toBe('60');
  });
});
