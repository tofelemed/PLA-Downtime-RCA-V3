import { Dec, ZERO } from '../decimal';
import {
  ApprovedAdjustment,
  CoverageGatePolicy,
  SourceCandidate,
} from './period-actuals.types';
import { LotDispositionInput } from './quality-classes';
import { computeSliceActuals } from './slice-actuals';

const t = (hhmm: string) => new Date(`2027-03-01T${hhmm}:00Z`);
const window = { from: t('06:00'), to: t('14:00') };
const gate: CoverageGatePolicy = {
  requiredCoverageRatio: 1,
  allowProportionalEstimate: true,
  countApprovedSubstitutionsAsAccepted: true,
};

const meter = (
  gross: string,
  reject: string | null = null,
): SourceCandidate => ({
  source: 'pi_counter',
  method: 'counter_delta',
  label: 'signal:c',
  basis: 'gross',
  quantity: new Dec(gross),
  reject: reject === null ? null : new Dec(reject),
  measured: new Dec(gross),
  estimated: ZERO,
  uom: 't',
  available: true,
  observed: [{ start: window.from, end: window.to }],
  segments: [],
  findings: [],
});

const lot = (overrides: Partial<LotDispositionInput>): LotDispositionInput => ({
  id: 'lot-1',
  start: t('06:00'),
  end: t('14:00'),
  dispositionClass: 'downgrade',
  quantity: new Dec(5),
  uom: 't',
  remeasured: false,
  ...overrides,
});

function run(
  source: SourceCandidate,
  dispositions: LotDispositionInput[],
  adjustments: ApprovedAdjustment[] = [],
) {
  return computeSliceActuals({
    window,
    gate,
    selection: { selected: source, role: 'primary', findings: [] },
    adjustments,
    uom: 't',
    dispositions,
  });
}

const codes = (result: ReturnType<typeof run>) =>
  result.findings.map((f) => f.code);

describe('quality classes of a slice (SME E3)', () => {
  it('E3: a 100 t lot with 5 t downgraded → good 95 (first-pass quality 95 %), classes kept apart', () => {
    const result = run(meter('100'), [lot({})]);
    expect(result).toMatchObject({ gross: '100', reject: '5', good: '95' });
    expect(result.qualityClasses).toMatchObject({
      firstPassGood: '95',
      downgrade: '5',
      scrap: '0',
      rework: '0',
      unclassified: '0',
      recovered: '0',
    });
    expect(codes(result)).toContain('rejects_from_dispositions');
    expect(codes(result)).not.toContain('rejects_not_measured');
  });

  it('intentional wide-spec stays good but is reported apart from prime first-pass good', () => {
    const result = run(meter('100'), [
      lot({ id: 'w', dispositionClass: 'wide_spec', quantity: new Dec(20) }),
      lot({ id: 's', dispositionClass: 'scrap', quantity: new Dec(2) }),
    ]);
    expect(result.good).toBe('98');
    expect(result.qualityClasses).toMatchObject({
      firstPassGood: '78',
      wideSpec: '20',
      scrap: '2',
    });
  });

  it('measured rejects stay authoritative: the classes break them down, the rest is unclassified', () => {
    const result = run(meter('100', '8'), [lot({})]);
    expect(result).toMatchObject({ reject: '8', good: '92' });
    expect(result.qualityClasses?.unclassified).toBe('3');
  });

  it('classes beyond the measured rejects are a problem, never a silent correction', () => {
    const result = run(meter('100', '3'), [lot({})]);
    expect(result.reject).toBe('3');
    expect(codes(result)).toContain('dispositions_exceed_rejects');
    expect(result.qualityState).toBe('partial');
  });

  it('rework round trip: reprocessed 5 t measured again is no new output and leaves good first-pass', () => {
    const result = run(meter('105'), [
      lot({
        id: 'r',
        dispositionClass: 'recovered',
        quantity: new Dec(5),
        remeasured: true,
      }),
    ]);
    expect(result).toMatchObject({ gross: '100', good: '100' });
    expect(result.qualityClasses).toMatchObject({
      recovered: '5',
      reprocessedInput: '5',
      firstPassGood: '100',
    });
    expect(codes(result)).toContain('reprocessed_input_excluded');
  });

  it('a recovery not measured again is reported only (gross untouched)', () => {
    const result = run(meter('100'), [
      lot({ id: 'r', dispositionClass: 'recovered', remeasured: false }),
    ]);
    expect(result).toMatchObject({ gross: '100', good: '100' });
    expect(result.qualityClasses?.recovered).toBe('5');
  });

  it('a lot interval is aligned by its production time: half of a lot inside the window counts half', () => {
    const result = run(meter('100'), [
      lot({ start: t('10:00'), end: t('18:00'), quantity: new Dec(10) }),
    ]);
    expect(result.qualityClasses?.downgrade).toBe('5');
    expect(result.good).toBe('95');
  });

  it('a lot in another unit of measure is skipped with a finding (never converted)', () => {
    const result = run(meter('100'), [lot({ uom: 'kg' })]);
    expect(result.good).toBe('100');
    expect(codes(result)).toContain('disposition_uom_mismatch');
  });

  it('approved rework acceptance is recovered output, never added back to first-pass good', () => {
    const result = run(
      meter('60', '5'),
      [],
      [
        {
          id: 'adj',
          kind: 'rework',
          quantity: new Dec(2),
          basis: 'measured',
          window: null,
        },
      ],
    );
    expect(result).toMatchObject({ good: '55', reworkAccepted: '2' });
    expect(result.qualityClasses?.recovered).toBe('2');
  });

  it('no dispositions and no rework: no class breakdown (old behaviour, old shape)', () => {
    const result = run(meter('100', '5'), []);
    expect(result.qualityClasses).toBeNull();
    expect(result.good).toBe('95');
  });
});
