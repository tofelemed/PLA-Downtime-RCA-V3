import { AccountingPolicy } from '../../periods/entities/accounting-policy.entity';
import { EquipmentReadinessQueryDto } from './readiness-v2.dto';
import { coverageCheck, spanCoverage } from './readiness-checks';
import { assertReadinessWindow } from './equipment-readiness.service';
import { policySpans } from './readiness-policies.service';

const at = (minute: number) => new Date(Date.UTC(2027, 0, 1, 0, minute));
const query: EquipmentReadinessQueryDto = {
  unitId: 'unit',
  from: at(0).toISOString(),
  to: at(60).toISOString(),
};
const span = (from: number, to: number | null) => ({
  effectiveFrom: at(from),
  effectiveTo: to === null ? null : at(to),
});
describe('equipment readiness effective coverage', () => {
  it('joins adjacent approved versions and clips outside the window', () => {
    expect(
      spanCoverage([span(-10, 20), span(20, 40), span(40, null)], query),
    ).toBe(1);
    expect(
      coverageCheck('profile', [span(-10, 20), span(20, null)], query).status,
    ).toBe('ready');
  });
  it('does not double-count overlap or hide a middle coverage gap', () => {
    expect(
      spanCoverage([span(0, 20), span(10, 30), span(40, 60)], query),
    ).toBeCloseTo(50 / 60);
    expect(
      coverageCheck('planning_rate', [span(0, 20), span(40, 60)], query).status,
    ).toBe('needs_attention');
  });
  it('distinguishes absence from unapproved records', () => {
    expect(coverageCheck('profile', [], query).status).toBe('missing');
    expect(coverageCheck('profile', [], query, true).status).toBe(
      'needs_attention',
    );
  });
  it.each([0, -1, 32 * 24 * 60])(
    'refuses empty, reverse or excessive windows (%s minutes)',
    (minutes) => {
      expect(() =>
        assertReadinessWindow({ ...query, to: at(minutes).toISOString() }),
      ).toThrow('Readiness requires');
    },
  );
  it('allows exactly 31 days', () => {
    expect(() =>
      assertReadinessWindow({ ...query, to: at(31 * 24 * 60).toISOString() }),
    ).not.toThrow();
  });
});
describe('read-only policy version selection', () => {
  const policy = (
    id: string,
    from: number,
    to: number | null,
    approved = true,
  ) =>
    ({
      id,
      ...span(from, to),
      policyKind: 'source_authority',
      approvedAt: approved ? at(0) : null,
      rejectedAt: null,
    }) as AccountingPolicy;
  it('keeps approved plant coverage while a newer unit draft awaits approval', () => {
    const rows = [
      policy('unit-draft', 0, null, false),
      policy('plant-approved', 0, null),
    ];
    const result = policySpans(rows, 'source_authority', query);
    expect(result.map((row) => row.policy.id)).toEqual(['plant-approved']);
    expect(spanCoverage(result, query)).toBe(1);
  });
  it('uses the unit override only while it is effective, then falls back to plant', () => {
    const result = policySpans(
      [policy('unit', 20, 40), policy('plant', 0, null)],
      'source_authority',
      query,
    );
    expect(result.map((row) => row.policy.id)).toEqual([
      'plant',
      'unit',
      'plant',
    ]);
    expect(spanCoverage(result, query)).toBe(1);
  });
  it('never promotes pending/rejected versions into approved policy coverage', () => {
    const rejected = { ...policy('rejected', 0, null), rejectedAt: at(0) };
    expect(
      policySpans(
        [policy('pending', 0, null, false), rejected],
        'source_authority',
        query,
      ),
    ).toEqual([]);
  });
});
