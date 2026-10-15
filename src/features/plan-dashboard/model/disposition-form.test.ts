import { describe, expect, it } from 'vitest';
import { dispositionBody, emptyDisposition, validateDisposition } from './disposition-form';

const period = { unitId: 'unit-1', utcStart: '2027-03-01T02:30:00.000Z', utcEnd: '2027-03-01T10:30:00.000Z' };

describe('lot disposition form (SME E3)', () => {
  it('starts on the period interval with the first product', () => {
    expect(emptyDisposition(period, 'p1')).toMatchObject({
      productId: 'p1',
      dispositionClass: 'downgrade',
      productionStart: period.utcStart,
      productionEnd: period.utcEnd,
      recovery: false,
    });
  });

  it('asks for the lot, a quantity above zero and an interval that ends after it starts', () => {
    const errors = validateDisposition({ ...emptyDisposition(period, 'p1'), quantity: '0', productionEnd: period.utcStart });
    expect(Object.keys(errors).sort()).toEqual(['lotCode', 'productionEnd', 'quantity']);
  });

  it('a recovery needs the disposition it recovers', () => {
    const errors = validateDisposition({ ...emptyDisposition(period, 'p1'), lotCode: 'L', quantity: '5', recovery: true });
    expect(errors.recoveryOfId).toBeDefined();
  });

  it('sends exactly the declared fields: a recovery is class recovered with its original and remeasured', () => {
    const body = dispositionBody(
      { ...emptyDisposition(period, 'p1'), lotCode: ' L-1/R ', quantity: '5', recovery: true, recoveryOfId: 'd-1', remeasured: true, evidenceRef: '' },
      { unitId: 'unit-1', uom: 't' },
    );
    expect(body).toEqual({
      unitId: 'unit-1',
      productId: 'p1',
      lotCode: 'L-1/R',
      dispositionClass: 'recovered',
      quantity: '5',
      uom: 't',
      productionStart: period.utcStart,
      productionEnd: period.utcEnd,
      recoveryOfId: 'd-1',
      remeasured: true,
    });
  });

  it('a plain disposition carries its class and optional lab release and evidence', () => {
    const body = dispositionBody(
      { ...emptyDisposition(period, 'p1'), lotCode: 'L-1', quantity: '5', dispositionClass: 'scrap', labReleasedAt: '2027-03-01T12:00:00.000Z', evidenceRef: 'LIMS-7' },
      { unitId: 'unit-1', uom: 't' },
    );
    expect(body).toMatchObject({ dispositionClass: 'scrap', labReleasedAt: '2027-03-01T12:00:00.000Z', evidenceRef: 'LIMS-7' });
    expect(body).not.toHaveProperty('recoveryOfId');
    expect(body).not.toHaveProperty('remeasured');
  });
});
