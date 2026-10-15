import { describe, expect, it } from 'vitest';
import {
  emptyTransitionStandardForm,
  hoursOfSeconds,
  secondsOfHours,
  transitionStandardCreateBody,
  validateTransitionStandardForm,
} from './model/transition-standard-form';

const TZ = 'Asia/Tehran';

describe('transition standard form (LA-08)', () => {
  it('converts the typed hours to the API seconds and back for display', () => {
    expect(secondsOfHours('2.1')).toBe('7560');
    expect(secondsOfHours('0.25')).toBe('900');
    expect(hoursOfSeconds('7560')).toBe('2.10');
  });

  it('asks for both products, a different target, a positive duration and a start', () => {
    const errors = validateTransitionStandardForm({ ...emptyTransitionStandardForm('u1'), fromProductId: 'p1', toProductId: 'p1' }, TZ);
    expect(errors.toProductId).toBe('Choose a different product');
    expect(errors.referenceSeconds).toBeDefined();
    expect(errors.effectiveFrom).toBeDefined();
  });

  it('builds the exact create body (no undeclared fields)', () => {
    const body = transitionStandardCreateBody(
      {
        ...emptyTransitionStandardForm('u1'),
        fromProductId: 'p1',
        toProductId: 'p2',
        referenceHours: '2.1',
        sampleCount: '5',
        evidence: ' median of 5 ',
        effectiveFrom: '2026-10-01T06:00',
      },
      TZ,
    );
    expect(Object.keys(body).sort()).toEqual(
      ['catalystFamily', 'effectiveFrom', 'effectiveTo', 'evidence', 'fromProductId', 'offgradeUom', 'operatingMode', 'referenceOffgradeQty', 'referenceSeconds', 'sampleCount', 'toProductId', 'unitId'].sort(),
    );
    expect(body).toMatchObject({ referenceSeconds: '7560', sampleCount: 5, evidence: 'median of 5', referenceOffgradeQty: null, offgradeUom: null, effectiveTo: null });
    expect(body.effectiveFrom).toBe('2026-10-01T02:30:00.000Z');
    expect(body).toMatchObject({ catalystFamily: null, operatingMode: null });
  });

  it('sends catalyst family and operating mode when given and refuses an invalid code (SME E1)', () => {
    const values = { ...emptyTransitionStandardForm('u1'), fromProductId: 'p1', toProductId: 'p2', referenceHours: '2', effectiveFrom: '2026-10-01T06:00' };
    const body = transitionStandardCreateBody({ ...values, catalystFamily: ' ziegler_natta ', operatingMode: 'swing' }, TZ);
    expect(body).toMatchObject({ catalystFamily: 'ziegler_natta', operatingMode: 'swing' });
    const errors = validateTransitionStandardForm({ ...values, catalystFamily: 'Z N' }, TZ);
    expect(errors.catalystFamily).toBeDefined();
    expect(errors.operatingMode).toBeUndefined();
  });
});
