import { describe, expect, it } from 'vitest';
import {
  emptyStreamForm,
  emptyStreamRunForm,
  percentOfShare,
  shareOfPercent,
  streamCreateBody,
  streamRunCreateBody,
  validateStreamForm,
  validateStreamRunForm,
} from './model/stream-form';

const TZ = 'Asia/Tehran';

describe('stream forms (SME E6)', () => {
  it('converts the typed percent to the API fraction and back for display', () => {
    expect(shareOfPercent('60')).toBe('0.6');
    expect(shareOfPercent('33.333333')).toBe('0.33333333');
    expect(percentOfShare('0.4')).toBe('40');
  });

  it('asks for a code, a name, a share in (0, 100] and a start', () => {
    const errors = validateStreamForm({ ...emptyStreamForm('u1'), code: 'T 1', sharePercent: '120' }, TZ);
    expect(Object.keys(errors).sort()).toEqual(['capacityShare', 'code', 'effectiveFrom', 'name']);
  });

  it('builds the exact create bodies (no undeclared fields)', () => {
    const stream = streamCreateBody({ ...emptyStreamForm('u1'), code: ' T1 ', name: 'Train 1', sharePercent: '60', effectiveFrom: '2026-10-01T06:00' }, TZ);
    expect(Object.keys(stream).sort()).toEqual(['capacityShare', 'code', 'effectiveFrom', 'effectiveTo', 'name', 'unitId']);
    expect(stream).toMatchObject({ code: 'T1', capacityShare: '0.6', effectiveTo: null });
    const run = streamRunCreateBody({ ...emptyStreamRunForm('u1'), streamCode: 'T1', productId: 'p1', startTime: '2026-10-01T06:00' }, TZ);
    expect(Object.keys(run).sort()).toEqual(['endTime', 'lotCode', 'productId', 'startTime', 'streamCode', 'unitId']);
    expect(run).toMatchObject({ lotCode: null, endTime: null, startTime: '2026-10-01T02:30:00.000Z' });
  });

  it('asks a run for its stream, product and start, and an end after the start', () => {
    const errors = validateStreamRunForm({ ...emptyStreamRunForm('u1'), startTime: '2026-10-01T06:00', endTime: '2026-10-01T05:00' }, TZ);
    expect(Object.keys(errors).sort()).toEqual(['endTime', 'productId', 'streamCode']);
  });
});
