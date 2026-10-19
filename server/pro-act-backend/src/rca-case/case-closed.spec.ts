import { ConflictException } from '@nestjs/common';
import { assertV1Update } from '../rca/v1-workflow-guard';
import { RCA } from '../rca/rca.entity';
import { approvedImpactBasis } from './approved-impact';
import { assertCaseNotClosed, isCaseClosed } from './case-closed';

const refusal = (run: () => void): { status: number; code: unknown } => {
  try {
    run();
  } catch (error) {
    if (error instanceof ConflictException) {
      const body = error.getResponse() as { code?: unknown };
      return { status: error.getStatus(), code: body.code };
    }
    throw error;
  }
  return { status: 200, code: null };
};

describe('closed investigations are frozen (QA H1)', () => {
  it('refuses a write on a Closed case with 409 CASE_CLOSED', () => {
    expect(refusal(() => assertCaseNotClosed({ status: 'Closed' }))).toEqual({
      status: 409,
      code: 'CASE_CLOSED',
    });
  });

  it.each(['Draft', 'In Progress', 'Analysis', 'Monitoring', 'Closure Review'])(
    'lets a %s case be written',
    (status) => {
      expect(isCaseClosed({ status })).toBe(false);
      expect(refusal(() => assertCaseNotClosed({ status })).status).toBe(200);
    },
  );

  it('an unknown or empty stored status reads as Draft (writable)', () => {
    expect(isCaseClosed({ status: null })).toBe(false);
    expect(isCaseClosed({ status: 'Published' })).toBe(false);
  });

  it('the v1 update route refuses a closed case too', () => {
    const stored = { status: 'Closed', teamMemberIds: [] } as unknown as RCA;
    expect(
      refusal(() => assertV1Update(stored, { title: 'x' } as never)),
    ).toEqual({ status: 409, code: 'CASE_CLOSED' });
  });
});

describe('approved impact basis words (QA M3)', () => {
  it('names the view without an internal reference or a "policy default" claim', () => {
    const basis = approvedImpactBasis('economic_impact');
    expect(basis).toMatch(/^Approved plan lines /);
    expect(basis).toContain('economic impact view');
    expect(basis).not.toMatch(/SME|policy default/);
  });

  it('names where a fixed view comes from', () => {
    expect(
      approvedImpactBasis(
        'contribution_margin',
        'the basis frozen in the linked evidence package',
      ),
    ).toContain(
      'contribution margin view (the basis frozen in the linked evidence package)',
    );
  });
});
