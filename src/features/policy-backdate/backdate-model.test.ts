import { describe, expect, it } from 'vitest';
import { V2ApiError } from '@/api/v2/errors';
import { backdateBodyOf, backdateErrors, EMPTY_BACKDATE, overlapOf } from './backdate-model';

const NOW = new Date('2026-10-18T12:00:00.000Z');

describe('commissioning backdate form model', () => {
  it('sends nothing and finds nothing wrong when left empty', () => {
    expect(backdateErrors(EMPTY_BACKDATE, NOW)).toEqual({});
    expect(backdateBodyOf(EMPTY_BACKDATE)).toEqual({});
  });

  it('needs a past instant and a reason, and a reason only with an instant', () => {
    expect(backdateErrors({ effectiveFrom: '2026-10-01T00:00:00.000Z', reason: ' ' }, NOW)).toEqual({ reason: 'Give the reason for backdating' });
    expect(backdateErrors({ effectiveFrom: '2026-10-19T00:00:00.000Z', reason: 'x' }, NOW)).toEqual({ effectiveFrom: 'Must be in the past' });
    expect(backdateErrors({ effectiveFrom: null, reason: 'why' }, NOW)).toEqual({ effectiveFrom: 'Choose the effective-from, or clear the reason' });
  });

  it('sends the instant with the trimmed reason', () => {
    expect(backdateBodyOf({ effectiveFrom: '2026-10-01T00:00:00.000Z', reason: ' start-up ' })).toEqual({
      effectiveFrom: '2026-10-01T00:00:00.000Z',
      backdateReason: 'start-up',
    });
  });

  it('reads the periods of an overlap refusal and ignores other failures', () => {
    const period = { periodId: 'p1', unitId: 'u1', unitName: 'Extruder 1', localDate: '2026-10-02', shiftName: null, utcStart: '2026-10-02T00:00:00Z', utcEnd: '2026-10-02T08:00:00Z' };
    const refusal = new V2ApiError(409, {
      code: 'BACKDATE_OVERLAPS_CALCULATION',
      message: 'overlap',
      correlationId: null,
      retryable: false,
      details: { total: 3, periods: [period, { periodId: 1 }] },
    });
    const { periodId, unitName, localDate, shiftName, utcStart, utcEnd } = period;
    expect(overlapOf(refusal)).toEqual({ code: 'BACKDATE_OVERLAPS_CALCULATION', total: 3, periods: [{ periodId, unitName, localDate, shiftName, utcStart, utcEnd }] });
    const approved = new V2ApiError(409, { code: 'BACKDATE_OVERLAPS_APPROVED_VALUE', message: 'approved', correlationId: null, retryable: false, details: { total: 1, periods: [period] } });
    expect(overlapOf(approved)).toMatchObject({ code: 'BACKDATE_OVERLAPS_APPROVED_VALUE', total: 1 });
    expect(overlapOf(new V2ApiError(409, { code: 'STALE_DRAFT', message: 'x', correlationId: null, retryable: false }))).toBeNull();
    expect(overlapOf(new Error('x'))).toBeNull();
  });
});
