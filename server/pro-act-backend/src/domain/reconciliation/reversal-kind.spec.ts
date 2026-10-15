import { Dec } from '../actuals/decimal';
import { MEMO_KINDS } from '../accounting/accounting.types';
import { MATERIAL_KINDS } from '../close/materiality';
import { LOSS_VALUE_KINDS } from '../valuation/reconciled-valuation';
import { LOSS_TREE_KINDS } from '../../v2/pla-reports/pla-reports.dto';
import { allocationIssues } from './allocation-budget';
import { reconcile } from './reconcile';
import { DecisionLine, ToleranceRule } from './reconciliation.types';
import { PLAN_STEP_KEYS, planKindTotals } from './waterfall';

const RULE: ToleranceRule = {
  mode: 'zero',
  value: new Dec(0),
  epsilon: new Dec('0.000001'),
  allowUnaccountedClassification: false,
};

const line = (kind: DecisionLine['kind'], quantity: string): DecisionLine => ({
  action: 'manual',
  autoKey: null,
  sliceId: 's',
  kind,
  quantity: new Dec(quantity),
  baseQuantity: null,
  missingCode: false,
});

/**
 * SME R9 "evidence-backed reversals of erroneous entries as their own types", never a balancing line: a
 * reversal corrects an approved line of an earlier period, so every set that lists kinds treats it apart.
 */
describe('reversal kind (SME R9)', () => {
  const slices = [
    {
      sliceId: 's',
      uom: 't',
      target: new Dec(1000),
      actual: new Dec(900),
      flags: [],
    },
  ];

  it('adds nothing to this period: the residual stays what the real losses leave', () => {
    const withReversal = reconcile({
      candidates: [],
      lines: [line('availability', '60'), line('reversal', '-40')],
      slices,
      rule: RULE,
    });
    expect(withReversal.slices[0].attributed.toString()).toBe('60');
    expect(withReversal.slices[0].residual?.toString()).toBe('40');
  });

  it('neither consumes nor frees the allocation budget', () => {
    const lines = [line('availability', '100'), line('reversal', '-500')];
    const reconciliation = reconcile({
      candidates: [],
      lines,
      slices,
      rule: RULE,
    });
    expect(
      allocationIssues(reconciliation, lines, { candidates: [], rule: RULE }),
    ).toEqual([]);
    const over = [line('reversal', '-500'), line('availability', '101')];
    const overReconciliation = reconcile({
      candidates: [],
      lines: over,
      slices,
      rule: RULE,
    });
    expect(
      allocationIssues(overReconciliation, over, {
        candidates: [],
        rule: RULE,
      }).map((i) => i.code),
    ).toEqual(['ALLOCATION_EXCEEDED']);
  });

  it('is no waterfall step, no loss-tree kind and no loss value; it counts as a material adjustment', () => {
    const kinds = planKindTotals('s', [], [], [line('reversal', '-40')]);
    expect(kinds.get('reversal')?.isZero() ?? true).toBe(true);
    expect((PLAN_STEP_KEYS as readonly string[]).includes('reversal')).toBe(
      false,
    );
    expect((LOSS_TREE_KINDS as readonly string[]).includes('reversal')).toBe(
      false,
    );
    expect(LOSS_VALUE_KINDS.has('reversal')).toBe(false);
    expect((MATERIAL_KINDS as readonly string[]).includes('reversal')).toBe(
      true,
    );
    expect(MEMO_KINDS.has('reversal')).toBe(true);
  });
});
