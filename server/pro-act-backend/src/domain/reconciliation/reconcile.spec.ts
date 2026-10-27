import * as fc from 'fast-check';
import { Dec } from '../actuals/decimal';
import { reconcile } from './reconcile';
import {
  Candidate,
  DecisionLine,
  LineAction,
  ToleranceRule,
} from './reconciliation.types';
import { toleranceAdjustments } from './tolerance';

const RULE: ToleranceRule = {
  mode: 'absolute',
  value: new Dec(2),
  epsilon: new Dec('0.000001'),
  allowUnaccountedClassification: false,
};

const quantity = fc
  .integer({ min: 0, max: 50_000_000 })
  .map((n) => new Dec(n).div(100_000));

const decision = (
  action: LineAction,
  autoKey: string,
  q: Dec | null,
): DecisionLine => ({
  action,
  autoKey,
  sliceId: 's',
  kind: 'availability',
  quantity: q,
  baseQuantity: null,
  missingCode: false,
});

describe('reconcile (plan 2.8)', () => {
  it('keeps the plan identity: gap = attributed + tolerance adjustment + residual, never clamped', () => {
    fc.assert(
      fc.property(
        fc.array(quantity, { maxLength: 6 }),
        fc.array(
          fc.constantFrom<LineAction>('accept', 'adjust', 'reject', 'replace'),
          {
            maxLength: 6,
          },
        ),
        fc.array(quantity, { maxLength: 4 }),
        quantity,
        quantity,
        (cands, actions, manuals, target, actual) => {
          const candidates: Candidate[] = cands.map((q, i) => ({
            autoKey: `k${i}`,
            sliceId: 's',
            kind: 'availability',
            quantity: q,
          }));
          const lines = [
            ...actions
              .slice(0, candidates.length)
              .map((a, i) =>
                decision(
                  a,
                  `k${i}`,
                  a === 'adjust' || a === 'replace' ? cands[i].div(2) : null,
                ),
              ),
            ...manuals.map((q) => ({
              ...decision('manual', '', q),
              autoKey: null,
            })),
          ];
          const input = {
            candidates,
            lines,
            slices: [{ sliceId: 's', uom: 't', target, actual, flags: [] }],
            rule: RULE,
          };
          const first = reconcile(input);
          const tolerance = toleranceAdjustments(first, RULE).map((a) => ({
            ...decision('tolerance', '', a.quantity),
            autoKey: null,
          }));
          const [slice] = reconcile({
            ...input,
            lines: [...lines, ...tolerance],
          }).slices;
          const sum = slice.attributed
            .plus(slice.toleranceAdjustment)
            .plus(slice.residual as Dec);
          expect(sum.eq(target.minus(actual))).toBe(true);
          expect(
            slice.unadjustedResidual?.eq(first.slices[0].residual as Dec),
          ).toBe(true);
          if (slice.gap?.gte(0) && slice.unadjustedResidual?.abs().lte(2)) {
            expect(slice.residual?.abs().lte(RULE.epsilon)).toBe(true);
          }
        },
      ),
    );
  });

  it('a decision on an unknown candidate is flagged and never counted', () => {
    const result = reconcile({
      candidates: [],
      lines: [decision('replace', 'gone', new Dec(10))],
      slices: [
        {
          sliceId: 's',
          uom: 't',
          target: new Dec(100),
          actual: new Dec(50),
          flags: [],
        },
      ],
      rule: RULE,
    });
    expect(result.lineFlags).toEqual([['candidate_missing']]);
    expect(result.slices[0].attributed.toString()).toBe('0');
  });

  describe('declared recovery (Task 13 fix 1)', () => {
    const shares: Candidate[] = [
      {
        autoKey: 'a',
        sliceId: 's',
        kind: 'availability',
        quantity: new Dec(23),
      },
      {
        autoKey: 'p',
        sliceId: 's',
        kind: 'performance',
        quantity: new Dec(11),
      },
      { autoKey: 'q', sliceId: 's', kind: 'quality', quantity: new Dec(6) },
    ];
    const slice = (declaredGain?: Dec) => ({
      sliceId: 's',
      uom: 't',
      target: new Dec(240),
      actual: new Dec(208),
      flags: [],
      ...(declaredGain ? { declaredGain } : {}),
    });

    it('23 + 11 + 6 − 8 on a 32 t shortfall: attributed 32, residual 0, not over-accounted', () => {
      const [result] = reconcile({
        candidates: shares,
        lines: [],
        slices: [slice(new Dec(8))],
        rule: RULE,
      }).slices;
      expect(result.attributed.toString()).toBe('32');
      expect(result.declaredGain.toString()).toBe('8');
      expect(result.residual?.toString()).toBe('0');
      expect(result.overAccounted?.toString()).toBe('0');
      expect(result.flags).not.toContain('over_accounted');
    });

    it('without a declared gain (computed runs) the shares alone are attributed', () => {
      const [result] = reconcile({
        candidates: shares,
        lines: [],
        slices: [slice()],
        rule: RULE,
      }).slices;
      expect(result.attributed.toString()).toBe('40');
      expect(result.declaredGain.toString()).toBe('0');
      expect(result.overAccounted?.toString()).toBe('8');
    });
  });
});
