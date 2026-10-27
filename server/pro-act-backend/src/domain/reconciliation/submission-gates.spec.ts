import { Dec } from '../actuals/decimal';
import { submissionIssues } from './submission-gates';
import {
  DecisionLine,
  Reconciliation,
  SliceReconciliation,
  ToleranceRule,
} from './reconciliation.types';

const d = (value: number) => new Dec(value);
const rule: ToleranceRule = {
  mode: 'zero',
  value: d(0),
  epsilon: d(0.001),
  allowUnaccountedClassification: true,
};

function slice(over: Partial<SliceReconciliation>): SliceReconciliation {
  return {
    sliceId: 's1',
    uom: 't',
    target: d(100),
    actual: d(60),
    gap: d(40),
    attributed: d(40),
    toleranceAdjustment: d(0),
    unadjustedResidual: d(0),
    residual: d(0),
    overAccounted: d(0),
    overproduction: null,
    tolerance: d(0),
    flags: [],
    ...over,
  };
}

const reconciliationOf = (
  ...slices: SliceReconciliation[]
): Reconciliation => ({
  slices,
  candidates: [],
  lineFlags: [],
});

const toleranceLine: DecisionLine = {
  action: 'tolerance',
  autoKey: null,
  sliceId: 's1',
  kind: 'tolerance_adjustment',
  quantity: d(2),
  baseQuantity: null,
  missingCode: false,
};

const codes = (issues: Array<{ code: string }>) => issues.map((i) => i.code);

describe('submissionIssues in declared mode', () => {
  const declared = { declared: true };

  it('refuses a period without its production loss event with DECLARED_LOSS_MISSING only', () => {
    const found = submissionIssues(
      reconciliationOf(
        slice({
          actual: null,
          residual: null,
          flags: ['declared_loss_missing'],
        }),
      ),
      [],
      rule,
      declared,
    );
    expect(codes(found)).toEqual(['DECLARED_LOSS_MISSING']);
  });

  it('refuses an identity mismatch until the difference is booked as a tolerance line', () => {
    const mismatch = reconciliationOf(
      slice({ flags: ['declared_identity_mismatch'] }),
    );
    expect(codes(submissionIssues(mismatch, [], rule, declared))).toEqual([
      'DECLARED_IDENTITY_MISMATCH',
    ]);
    expect(submissionIssues(mismatch, [toleranceLine], rule, declared)).toEqual(
      [],
    );
  });

  it('refuses a period two production loss events declare with DECLARED_DUPLICATE', () => {
    const duplicate = reconciliationOf(
      slice({
        flags: ['duplicate_declared_loss', 'declared_loss_chosen:e1'],
      }),
    );
    expect(codes(submissionIssues(duplicate, [], rule, declared))).toEqual([
      'DECLARED_DUPLICATE',
    ]);
    expect(
      codes(submissionIssues(duplicate, [toleranceLine], rule, declared)),
    ).toEqual(['DECLARED_DUPLICATE']);
  });

  it('keeps RESIDUAL_UNEXPLAINED beside the declared gates', () => {
    const found = submissionIssues(
      reconciliationOf(
        slice({
          flags: ['declared_identity_mismatch'],
          residual: d(5),
          unadjustedResidual: d(5),
        }),
      ),
      [],
      rule,
      declared,
    );
    expect(codes(found)).toEqual([
      'DECLARED_IDENTITY_MISMATCH',
      'RESIDUAL_UNEXPLAINED',
    ]);
  });

  it('does not apply the declared gates in computed mode', () => {
    const found = submissionIssues(
      reconciliationOf(
        slice({
          flags: ['declared_loss_missing', 'declared_identity_mismatch'],
        }),
      ),
      [],
      rule,
    );
    expect(found).toEqual([]);
  });

  it('a coded declared line (unaccounted_classified with a reason) raises no MISSING_CODE', () => {
    const line: DecisionLine = {
      ...toleranceLine,
      action: 'manual',
      kind: 'unaccounted_classified',
    };
    expect(
      submissionIssues(reconciliationOf(slice({})), [line], rule, declared),
    ).toEqual([]);
  });

  it('a period without slices raises the period-level DECLARED_LOSS_MISSING', () => {
    const empty = reconciliationOf();
    expect(submissionIssues(empty, [], rule, declared)).toEqual([
      {
        code: 'DECLARED_LOSS_MISSING',
        message: 'No declared production loss figures for this period',
        sliceId: null,
      },
    ]);
  });

  it('a period with no active slice raises it even when the run has totals', () => {
    const found = submissionIssues(reconciliationOf(slice({})), [], rule, {
      declared: true,
      activeSlices: 0,
    });
    expect(codes(found)).toEqual(['DECLARED_LOSS_MISSING']);
  });

  it('an empty period passes the content gates in computed mode (unchanged)', () => {
    expect(submissionIssues(reconciliationOf(), [], rule)).toEqual([]);
    expect(
      submissionIssues(reconciliationOf(), [], rule, { activeSlices: 0 }),
    ).toEqual([]);
  });
});
