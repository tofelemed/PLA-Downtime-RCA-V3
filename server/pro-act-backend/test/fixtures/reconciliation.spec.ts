import * as fs from 'fs';
import * as path from 'path';
import { Dec, formatDec } from '../../src/domain/actuals/decimal';
import { allocationIssues } from '../../src/domain/reconciliation/allocation-budget';
import { reconcile } from '../../src/domain/reconciliation/reconcile';
import {
  Candidate,
  DecisionLine,
  SliceBasis,
  ToleranceRule,
} from '../../src/domain/reconciliation/reconciliation.types';
import { submissionIssues } from '../../src/domain/reconciliation/submission-gates';
import {
  toleranceAdjustments,
  toleranceFor,
} from '../../src/domain/reconciliation/tolerance';

/**
 * Spec §19.1 T32 (tolerance adjustment) and the submission gates of T15 / T16 through the plan 2.8
 * reconciliation functions: a residual within tolerance becomes an explicit `tolerance_adjustment` line,
 * a residual beyond it blocks submission (`RESIDUAL_UNEXPLAINED`), over-accounting blocks it
 * (`OVER_ACCOUNTED`); decisions on candidates and the allocation budget of a draft save. The persisted
 * versions run in `reconciliation-workflow.int-spec.ts`.
 */
type Json = Record<string, unknown>;
const fixture = (id: string) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, `${id}.json`), 'utf8')) as {
    inputs: Json;
    expected: Json;
  };

const ZERO_RULE: ToleranceRule = {
  mode: 'zero',
  value: new Dec(0),
  epsilon: new Dec('0.000001'),
  allowUnaccountedClassification: false,
};

const slice = (target: string, actual: string): SliceBasis => ({
  sliceId: 's1',
  uom: 't',
  target: new Dec(target),
  actual: new Dec(actual),
  flags: [],
});

const manual = (quantity: string, kind = 'availability'): DecisionLine => ({
  action: 'manual',
  autoKey: null,
  sliceId: 's1',
  kind: kind as DecisionLine['kind'],
  quantity: new Dec(quantity),
  baseQuantity: null,
  missingCode: false,
});

const candidate = (autoKey: string, quantity: string): Candidate => ({
  autoKey,
  sliceId: 's1',
  kind: 'availability',
  quantity: new Dec(quantity),
});

const dec = (value: Dec | null) => (value === null ? null : formatDec(value));

describe('reconciliation fixtures (plan 2.8)', () => {
  it('T32: residual 0.5 within 0.1 % of 1000 becomes an explicit tolerance adjustment', () => {
    const t32 = fixture('T32');
    const inputs = t32.inputs as {
      targetQty: string;
      residual: string;
      tolerancePolicy: { mode: 'percent'; value: string };
    };
    const rule: ToleranceRule = {
      ...ZERO_RULE,
      mode: inputs.tolerancePolicy.mode,
      value: new Dec(inputs.tolerancePolicy.value),
    };
    const target = new Dec(inputs.targetQty);
    const actual = target.minus(100).minus(inputs.residual);
    const basis = slice(formatDec(target), formatDec(actual));
    const before = reconcile({
      candidates: [],
      lines: [manual('100')],
      slices: [basis],
      rule,
    });
    expect(dec(toleranceFor(rule, target))).toBe(t32.expected.toleranceQty);
    expect(dec(before.slices[0].residual)).toBe(t32.expected.residualDisplayed);
    const adjustments = toleranceAdjustments(before, rule);
    expect(adjustments.map((a) => dec(a.quantity))).toEqual([
      (t32.expected.acceptedAdjustmentLine as Json).quantity,
    ]);
    const lines: DecisionLine[] = [
      manual('100'),
      { ...manual('0.5', 'tolerance_adjustment'), action: 'tolerance' },
    ];
    const after = reconcile({ candidates: [], lines, slices: [basis], rule });
    expect(dec(after.slices[0].residual)).toBe('0');
    expect(dec(after.slices[0].unadjustedResidual)).toBe('0.5');
    expect(dec(after.slices[0].toleranceAdjustment)).toBe('0.5');
    expect(after.slices[0].flags).toContain('tolerance_adjusted');
    expect(submissionIssues(after, lines, rule)).toEqual([]);
  });

  it('T15: residual 10 at zero tolerance blocks submission (RESIDUAL_UNEXPLAINED)', () => {
    const t15 = fixture('T15');
    const inputs = t15.inputs as {
      targetQty: string;
      actualQty: string;
      acceptedLines: string[];
    };
    const lines = inputs.acceptedLines.map((q) => manual(q));
    const result = reconcile({
      candidates: [],
      lines,
      slices: [slice(inputs.targetQty, inputs.actualQty)],
      rule: ZERO_RULE,
    });
    expect(dec(result.slices[0].gap)).toBe(t15.expected.gap);
    expect(dec(result.slices[0].attributed)).toBe(t15.expected.attributed);
    expect(dec(result.slices[0].residual)).toBe(t15.expected.residual);
    expect(toleranceAdjustments(result, ZERO_RULE)).toEqual([]);
    expect(
      submissionIssues(result, lines, ZERO_RULE).map((i) => i.code),
    ).toEqual(['RESIDUAL_UNEXPLAINED']);
  });

  it('T16: over-accounted 10 blocks submission (OVER_ACCOUNTED)', () => {
    const t16 = fixture('T16');
    const inputs = t16.inputs as {
      targetQty: string;
      actualQty: string;
      acceptedLines: string[];
    };
    const lines = inputs.acceptedLines.map((q) => manual(q));
    const result = reconcile({
      candidates: [],
      lines,
      slices: [slice(inputs.targetQty, inputs.actualQty)],
      rule: ZERO_RULE,
    });
    expect(dec(result.slices[0].residual)).toBe(t16.expected.residual);
    expect(dec(result.slices[0].overAccounted)).toBe(
      t16.expected.overAccounted,
    );
    expect(
      submissionIssues(result, lines, ZERO_RULE).map((i) => i.code),
    ).toEqual(['OVER_ACCOUNTED']);
  });

  it('decisions: accept keeps, adjust replaces the quantity, reject and replace take the candidate out', () => {
    const candidates = [
      candidate('a', '90'),
      candidate('b', '40'),
      candidate('c', '30'),
      candidate('d', '5'),
    ];
    const decision = (
      action: DecisionLine['action'],
      autoKey: string,
      quantity: string | null,
      base: string,
    ): DecisionLine => ({
      action,
      autoKey,
      sliceId: 's1',
      kind: 'availability',
      quantity: quantity === null ? null : new Dec(quantity),
      baseQuantity: new Dec(base),
      missingCode: false,
    });
    const lines = [
      decision('accept', 'a', null, '90'),
      decision('adjust', 'b', '35', '40'),
      decision('reject', 'c', null, '30'),
      decision('replace', 'd', '15', '5'),
    ];
    const result = reconcile({
      candidates,
      lines,
      slices: [slice('1000', '850')],
      rule: ZERO_RULE,
    });
    expect(result.candidates.map((c) => c.state)).toEqual([
      'accepted',
      'adjusted',
      'rejected',
      'replaced',
    ]);
    // 90 + 35 + 0 + 15 (replacement line) = 140
    expect(dec(result.slices[0].attributed)).toBe('140');
    expect(result.lineFlags).toEqual([[], [], [], []]);
    const changed = reconcile({
      candidates: [candidate('a', '95'), candidate('b', '40')],
      lines,
      slices: [slice('1000', '850')],
      rule: ZERO_RULE,
    });
    expect(changed.lineFlags[0]).toEqual(['baseline_changed']);
    expect(changed.lineFlags[2]).toEqual(['candidate_missing']);
    expect(
      submissionIssues(changed, lines, ZERO_RULE).map((i) => i.code),
    ).toContain('BASELINE_CHANGED');
  });

  it('allocation budget: the first line beyond gap + tolerance is reported with the remaining allocation', () => {
    const lines = [manual('100'), manual('70'), manual('-30', 'bridge')];
    const basis = slice('1000', '850');
    const result = reconcile({
      candidates: [],
      lines,
      slices: [basis],
      rule: ZERO_RULE,
    });
    expect(
      allocationIssues(result, lines, { candidates: [], rule: ZERO_RULE }),
    ).toEqual([]);
    const over = [manual('100'), manual('70')];
    const issues = allocationIssues(
      reconcile({
        candidates: [],
        lines: over,
        slices: [basis],
        rule: ZERO_RULE,
      }),
      over,
      { candidates: [], rule: ZERO_RULE },
    );
    expect(issues).toEqual([
      expect.objectContaining({
        code: 'ALLOCATION_EXCEEDED',
        line: 1,
        expectedRemainingAllocation: '50',
      }),
    ]);
  });

  it('zero target allows an absolute tolerance only', () => {
    const percent = {
      ...ZERO_RULE,
      mode: 'percent' as const,
      value: new Dec(5),
    };
    const absolute = {
      ...ZERO_RULE,
      mode: 'absolute' as const,
      value: new Dec(2),
    };
    expect(dec(toleranceFor(percent, new Dec(0)))).toBe('0');
    expect(dec(toleranceFor(absolute, new Dec(0)))).toBe('2');
  });
});
