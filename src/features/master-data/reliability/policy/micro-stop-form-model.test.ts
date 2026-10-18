import { describe, expect, it } from 'vitest';
import type { MicroStopPolicyView } from '@/api/v2/types/reliability';
import { microStopBodyOf, microStopDraftOf, microStopErrors, tripCodesOf } from './micro-stop-form-model';
import { policyVersionLine } from './policy-version-line';

const CURRENT: MicroStopPolicyView = {
  id: 'p1', unitId: null, version: 2, microStopSeconds: 60, microStopSecondsByAssetClass: { Bagger: 120 },
  tripReasonCodes: ['ELEC-MTR'], effectiveFrom: '2026-10-14T00:00:00.000Z', notes: null,
  requestedEffectiveFrom: null, backdateReason: null,
};

describe('micro-stop form (SME D6)', () => {
  it('starts from the settings in force and sends the unit, the class map and trip codes', () => {
    const draft = microStopDraftOf(CURRENT);
    expect(draft).toEqual({ microStopSeconds: '60', classes: [{ assetClass: 'Bagger', seconds: '120' }], tripCodes: 'ELEC-MTR', notes: '' });
    const body = microStopBodyOf('u1', { ...draft, classes: [...draft.classes, { assetClass: ' Conveyor ', seconds: '0' }], tripCodes: 'ELEC-MTR, PROC-MELT\nELEC-MTR' });
    expect(body).toEqual({ unitId: 'u1', microStopSeconds: 60, microStopSecondsByAssetClass: { Bagger: 120, Conveyor: 0 }, tripReasonCodes: ['ELEC-MTR', 'PROC-MELT'] });
    expect(microStopBodyOf('', { ...draft, notes: ' pilot ' })).not.toHaveProperty('unitId');
    expect(tripCodesOf(' , ')).toEqual([]);
  });

  it('flags a threshold that is not whole seconds and a class given twice', () => {
    const draft = microStopDraftOf(CURRENT);
    expect(microStopErrors(draft)).toEqual({});
    expect(microStopErrors({ ...draft, microStopSeconds: '-5' }).microStopSeconds).toBe('Whole seconds from 0 to 86400');
    expect(microStopErrors({ ...draft, classes: [{ assetClass: 'Bagger', seconds: '1.5' }] }).classes).toMatch(/whole seconds/);
    expect(microStopErrors({ ...draft, classes: [...draft.classes, { assetClass: 'Bagger', seconds: '30' }] }).classes).toBe('Each asset class appears once');
  });

  it('says whose version applies: the unit, or the plant when the unit has no override', () => {
    const format = { number: String, dateTime: (iso: string) => iso.slice(0, 10) };
    expect(policyVersionLine(CURRENT, 'u1', format)).toBe('Version 2 · plant-wide (the unit has no override) · in force since 2026-10-14');
    expect(policyVersionLine(CURRENT, '', format)).toBe('Version 2 · plant-wide · in force since 2026-10-14');
    expect(policyVersionLine({ ...CURRENT, unitId: 'u1' }, 'u1', format)).toMatch(/^Version 2 · this unit/);
  });
});
