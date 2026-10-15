import { describe, expect, it } from 'vitest';
import { budgetBody, emptyBudget, previewBody, validateBudget, type BudgetFormValues } from './budget-form';

const NOW = '2027-03-01T00:00:00.000Z';

const filled = (): BudgetFormValues => ({
  ...emptyBudget(NOW),
  boundary: 'reactor_outlet',
  components: [
    { kind: 'meter', label: 'FT-101', standardUncertainty: '3', sensitivity: null },
    { kind: 'scale', label: 'Packing scale', standardUncertainty: '3', sensitivity: '-1' },
  ],
  calibrationRef: 'CAL-FT101-2027-01',
  reviewDueAt: '2028-03-01T00:00:00.000Z',
  evidenceRef: '  ',
});

describe('uncertainty budget form (SME E4)', () => {
  it('a new budget starts with two readings, k = 2 and no correlation', () => {
    const empty = emptyBudget(NOW);
    expect(empty.components.map((c) => [c.kind, c.sensitivity])).toEqual([
      ['meter', null],
      ['scale', '-1'],
    ]);
    expect(empty.coverageFactor).toBe('2');
    expect(validateBudget(empty)).toMatchObject({ boundary: expect.any(String), components: expect.any(String), calibrationRef: expect.any(String), reviewDueAt: expect.any(String) });
  });

  it('the body has exactly the declared fields; default sensitivity is left to the server', () => {
    const body = budgetBody(filled(), 'unit-1');
    expect(validateBudget(filled())).toEqual({});
    expect(body).toEqual({
      components: [
        { kind: 'meter', label: 'FT-101', standardUncertainty: '3' },
        { kind: 'scale', label: 'Packing scale', standardUncertainty: '3', sensitivity: '-1' },
      ],
      coverageFactor: '2',
      unitId: 'unit-1',
      boundary: 'reactor_outlet',
      uom: 't',
      calibrationRef: 'CAL-FT101-2027-01',
      effectiveFrom: NOW,
      reviewDueAt: '2028-03-01T00:00:00.000Z',
    });
  });

  it('correlations are sent only when stated and must link two components', () => {
    const values = { ...filled(), correlations: [{ a: 0, b: 1, coefficient: '0.5' }] };
    expect(previewBody(values).correlations).toEqual([{ a: 0, b: 1, coefficient: '0.5' }]);
    expect(validateBudget({ ...values, correlations: [{ a: 1, b: 1, coefficient: '0.5' }] }).correlations).toBeDefined();
  });
});
