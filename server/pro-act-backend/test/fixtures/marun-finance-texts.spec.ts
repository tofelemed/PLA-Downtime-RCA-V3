import {
  COURSE_WORDING,
  demandCorrections,
  fxCorrections,
  policyCorrections,
} from '../../scripts/marun-train/finance-text-plan';
import {
  DEMAND,
  FX_RATE,
  VALUATION_POLICY,
} from '../../scripts/marun-train/train-catalog-setup';
import { PLAN } from '../../scripts/marun-train/train-catalog';

/** QA re-test N3: no course wording in HDPE-TRAIN's finance texts; the live rewrite is idempotent. */
describe('marun-train finance texts', () => {
  it('the seeder catalogue texts carry no course wording', () => {
    const texts = [
      FX_RATE.source,
      DEMAND.evidence,
      VALUATION_POLICY.notes,
      VALUATION_POLICY.backdateReason,
      PLAN.changeReason,
    ];
    for (const text of texts) expect(text).not.toMatch(COURSE_WORDING);
  });

  it('plans one correction per stale record and none for plain ones (second run changes nothing)', () => {
    const fx = fxCorrections([
      {
        id: 'f1',
        source:
          'Illustrative training rate of the Marun student guide (lesson 21): 600,000 IRR per USD',
      },
      { id: 'f2', source: FX_RATE.source },
    ]);
    expect(fx).toEqual([
      {
        label: 'FX rate f1 source',
        path: '/v2/fx-rates/f1/source',
        body: { source: FX_RATE.source },
      },
    ]);
    expect(
      demandCorrections([
        {
          id: 'd1',
          evidence: 'Training assumption (guide lesson 21): unmet orders',
        },
      ])[0].body,
    ).toEqual({ evidence: DEMAND.evidence });
    expect(
      demandCorrections([{ id: 'd1', evidence: DEMAND.evidence }]),
    ).toEqual([]);
    const policies = policyCorrections([
      {
        id: 'p1',
        notes: 'Guide lesson 21 notes',
        backdateReason:
          'Commissioning: the training plant is valued from October 2026 (guide lesson 21)',
      },
      { id: 'p2', notes: null, backdateReason: null },
    ]);
    expect(policies).toEqual([
      {
        label: 'valuation policy p1 text',
        path: '/v2/valuation-policies/p1/text',
        body: {
          notes: VALUATION_POLICY.notes,
          backdateReason: VALUATION_POLICY.backdateReason,
        },
      },
    ]);
  });
});
