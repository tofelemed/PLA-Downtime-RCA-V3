import { CalculationRun } from '../accounting/entities/calculation-run.entity';
import { PeriodProductSlice } from '../periods/entities/period-product-slice.entity';
import { runIssues } from './submission-environment';

const runOf = (status: string) => ({ id: 'run1', status }) as CalculationRun;
const sliceOf = (id: string) => ({ id }) as PeriodProductSlice;
const codes = (issues: Array<{ code: string }>) => issues.map((i) => i.code);

describe('runIssues (calculation run gate of submission)', () => {
  it('refuses a validated run without a computable slice with NO_COMPUTABLE_SLICE', () => {
    const found = runIssues({ run: runOf('validated'), slices: [] });
    expect(found).toEqual([
      {
        code: 'NO_COMPUTABLE_SLICE',
        message:
          'The calculation produced no computable slice; fix the period setup (see its warnings) and recompute before submitting.',
        sliceId: null,
      },
    ]);
  });

  it('passes a validated run with a slice', () => {
    const found = runIssues({
      run: runOf('validated'),
      slices: [sliceOf('s1')],
    });
    expect(codes(found)).not.toContain('NO_COMPUTABLE_SLICE');
    expect(found).toEqual([]);
  });

  it('blames only the missing run when there is no run', () => {
    expect(codes(runIssues({ run: null, slices: [] }))).toEqual([
      'NO_CALCULATION_RUN',
    ]);
  });

  it('blames only the unvalidated run while the run is not validated', () => {
    expect(codes(runIssues({ run: runOf('running'), slices: [] }))).toEqual([
      'RUN_NOT_VALIDATED',
    ]);
  });
});
