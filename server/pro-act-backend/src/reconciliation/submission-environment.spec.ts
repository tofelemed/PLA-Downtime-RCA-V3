import { CalculationRun } from '../accounting/entities/calculation-run.entity';
import { PeriodLedgerTotal } from '../accounting/entities/period-ledger-total.entity';
import { PeriodProductSlice } from '../periods/entities/period-product-slice.entity';
import { runIssues } from './submission-environment';

const runOf = (status: string) => ({ id: 'run1', status }) as CalculationRun;
const sliceOf = (id: string) => ({ id }) as PeriodProductSlice;
const totalOf = (ledger: string) =>
  ({ sliceId: 's1', ledger }) as PeriodLedgerTotal;
const codes = (issues: Array<{ code: string }>) => issues.map((i) => i.code);
const validated = runOf('validated');

describe('runIssues (calculation run gate of submission)', () => {
  it('refuses a validated run without a computable slice with NO_COMPUTABLE_SLICE', () => {
    const found = runIssues({ run: validated, slices: [], totals: [] });
    expect(found).toEqual([
      {
        code: 'NO_COMPUTABLE_SLICE',
        message:
          'The calculation produced no computable slice; fix the period setup (see its warnings) and recompute before submitting.',
        sliceId: null,
      },
    ]);
  });

  it('refuses a slice added after a run that has no plan-ledger total', () => {
    const found = runIssues({
      run: validated,
      slices: [sliceOf('s1')],
      totals: [],
    });
    expect(codes(found)).toEqual(['NO_COMPUTABLE_SLICE']);
  });

  it('refuses a run with only capacity-ledger totals', () => {
    const found = runIssues({
      run: validated,
      slices: [sliceOf('s1')],
      totals: [totalOf('capacity')],
    });
    expect(codes(found)).toEqual(['NO_COMPUTABLE_SLICE']);
  });

  it('passes a validated run with a slice and its plan-ledger total', () => {
    const found = runIssues({
      run: validated,
      slices: [sliceOf('s1')],
      totals: [totalOf('plan')],
    });
    expect(found).toEqual([]);
  });

  it('blames only the missing run when there is no run', () => {
    expect(codes(runIssues({ run: null, slices: [], totals: [] }))).toEqual([
      'NO_CALCULATION_RUN',
    ]);
  });

  it('blames only the unvalidated run while the run is not validated', () => {
    const found = runIssues({ run: runOf('running'), slices: [], totals: [] });
    expect(codes(found)).toEqual(['RUN_NOT_VALIDATED']);
  });
});
