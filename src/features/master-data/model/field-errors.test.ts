import { describe, expect, it } from 'vitest';
import { V2ApiError } from '@/api/v2/errors';
import { changedFields } from './changed-fields';
import { compactErrors, fieldErrorsOf, optionalDecimal, requiredText } from './field-errors';
import { unitBodyOf, unitDraftOf, validateUnit } from '../units/unit-form-model';

const refusal = (code: string, fields: string[]) =>
  new V2ApiError(code === 'MASTER_DATA_CODE_EXISTS' ? 409 : 422, {
    code,
    message: 'refused',
    fieldErrors: fields.map((field) => ({ field, message: 'x' })),
    correlationId: null,
    retryable: false,
  });

describe('master-data form model', () => {
  it('puts a duplicate code on the code field in plain words, nested paths on their form field', () => {
    expect(fieldErrorsOf(refusal('MASTER_DATA_CODE_EXISTS', ['code'])).code).toMatch(/already used/);
    expect(Object.keys(fieldErrorsOf(refusal('VALIDATION_FAILED', ['logicTree.0.code'])))).toEqual(['logicTree']);
    expect(fieldErrorsOf(new Error('boom'))).toEqual({});
  });

  it('shows the server reason on the field and never puts an unexpected property on an input', () => {
    const refused = new V2ApiError(422, {
      code: 'VALIDATION_FAILED',
      message: 'refused',
      fieldErrors: [
        { field: 'name', message: 'name must be shorter than or equal to 120 characters', constraint: 'maxLength' },
        { field: 'rowVersion', message: 'property rowVersion should not exist', constraint: 'whitelistValidation' },
      ],
      correlationId: null,
      retryable: false,
    });
    expect(fieldErrorsOf(refused)).toEqual({ name: 'Must be shorter than or equal to 120 characters' });
  });

  it('validates required text and legacy decimals', () => {
    expect(requiredText('  ', 'Name')).toBe('Name is required.');
    expect(optionalDecimal('12.5', 'Capacity')).toBeUndefined();
    expect(optionalDecimal('-1', 'Capacity')).toMatch(/number/);
    expect(compactErrors(validateUnit(unitDraftOf(null)))).toEqual({ name: 'Name is required.', code: 'Code is required.' });
  });

  it('sends only the changed fields of a unit, blanks as null', () => {
    const stored = { code: 'L1', name: 'Line 1', description: 'old', unitOfMeasure: 't', capacity: null, idealCycleTimeSeconds: null };
    const draft = { ...unitDraftOf(null), code: 'L1', name: 'Line 1', description: '', unitOfMeasure: 't' };
    expect(changedFields(unitBodyOf(draft), stored)).toEqual({ description: null });
  });
});
