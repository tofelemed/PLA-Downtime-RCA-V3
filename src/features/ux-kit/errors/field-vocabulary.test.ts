import { describe, expect, it } from 'vitest';
import { V2ApiError } from '@/api/v2/errors';
import { serverFieldErrors } from '@/features/finance/model/field-errors';
import { POLICY_FIELD_VOCABULARY } from '@/features/finance/model/policy-field-vocabulary';
import { describeError } from './describe-error';
import { friendlyToastContent } from './friendly-toast';

const refusal = () =>
  new V2ApiError(422, {
    code: 'VALIDATION_FAILED',
    message: 'Validation failed',
    fieldErrors: [
      {
        field: 'defaultBasis',
        message: 'defaultBasis must be one of the following values: economic_impact, contribution_margin, standard_cost',
        constraint: 'isIn',
      },
      { field: 'reportingCurrencies', message: 'each value in reportingCurrencies must be an ISO 4217 code', constraint: 'matches' },
      { field: 'ownerTestProbe', message: 'property ownerTestProbe should not exist', constraint: 'whitelistValidation' },
    ],
    correlationId: 'corr-1',
    retryable: false,
  });

describe('refused fields read with the form’s own labels and choice names (owner manual test)', () => {
  it('the valuation policy form names "Default management view" and its choices, never raw keys', () => {
    const [basis, currencies, unexpected] = describeError(refusal(), undefined, POLICY_FIELD_VOCABULARY).fieldMessages;
    expect(basis).toMatchObject({
      label: 'Default management view',
      message: 'Must be one of: Economic impact (lost sales + incremental costs), Contribution margin, Standard cost',
    });
    expect(currencies).toMatchObject({ label: 'Reporting currencies', message: 'Each value in Reporting currencies must be an ISO 4217 code' });
    expect(unexpected).toMatchObject({ label: 'Unexpected field', message: 'ownerTestProbe', unexpected: true });
    expect([basis, currencies].map((entry) => `${entry.label}: ${entry.message}`).join(' ')).not.toMatch(
      /economic_impact|contribution_margin|defaultBasis|reportingCurrencies/,
    );
  });

  it('the inline messages of the form use the same words', () => {
    expect(serverFieldErrors(refusal(), POLICY_FIELD_VOCABULARY).defaultBasis).toBe(
      'Must be one of: Economic impact (lost sales + incremental costs), Contribution margin, Standard cost',
    );
  });

  it('without a form vocabulary the path and the choices are humanized', () => {
    const [basis] = describeError(refusal()).fieldMessages;
    expect(basis).toMatchObject({ label: 'Default basis', message: 'Must be one of: Economic impact, Contribution margin, Standard cost' });
    expect(friendlyToastContent(refusal(), { defaultBasis: { label: 'Management view' } }).description).toContain(
      'Management view: Must be one of: Economic impact, Contribution margin, Standard cost.',
    );
  });
});
