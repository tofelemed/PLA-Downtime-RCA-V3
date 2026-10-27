import { describe, expect, it } from 'vitest';
import type { LossAccountingPolicyView } from '@/api/v2/types/loss-accounting';
import { initialLossAccountingForm, lossAccountingBody, lossAccountingErrors, lossAccountingSummary, withLossBasis } from './loss-accounting-model';

const COMPUTED: LossAccountingPolicyView = { grain: 'shift', dayStart: '06:00', lossBasis: 'computed', targetSource: 'plan', accountingUnitId: null, accountingProductId: null, stopsCrossCheck: true, identityTolerance: 0 };
const DECLARED: LossAccountingPolicyView = { ...COMPUTED, grain: 'day', dayStart: '00:00', lossBasis: 'declared', targetSource: 'declared', accountingUnitId: 'u-1' };

describe('loss accounting form model', () => {
  it('opens on the version in force; a shift policy offers the 00:00 day start', () => {
    expect(initialLossAccountingForm(COMPUTED)).toMatchObject({ grain: 'shift', dayStart: '00:00', accountingUnitId: '', accountingProductId: '', identityTolerance: '0' });
    expect(initialLossAccountingForm({ ...DECLARED, accountingProductId: 'prod-1' }).accountingProductId).toBe('prod-1');
    expect(initialLossAccountingForm({ ...DECLARED, dayStart: '05:30' }).dayStart).toBe('05:30');
  });

  it('choosing Declared starts from the OT planned figure, Computed from the plan', () => {
    const declared = withLossBasis(initialLossAccountingForm(COMPUTED), 'declared');
    expect(declared.targetSource).toBe('declared');
    expect(withLossBasis(declared, 'computed').targetSource).toBe('plan');
  });

  it('declared needs a unit and a tolerance of 0 or more; day needs a valid day start', () => {
    const form = withLossBasis(initialLossAccountingForm(COMPUTED), 'declared');
    expect(lossAccountingErrors(form)).toEqual({ accountingUnitId: 'Choose the unit the accounting is kept on' });
    expect(lossAccountingErrors({ ...form, accountingUnitId: 'u-1', identityTolerance: '-1' }).identityTolerance).toBeDefined();
    expect(lossAccountingErrors({ ...form, accountingUnitId: 'u-1', identityTolerance: '' }).identityTolerance).toBeDefined();
    expect(lossAccountingErrors({ ...form, accountingUnitId: 'u-1', identityTolerance: '0.5' })).toEqual({});
    expect(lossAccountingErrors({ ...form, accountingUnitId: 'u-1', grain: 'day', dayStart: '' }).dayStart).toBeDefined();
  });

  it('computed accounting needs nothing declared', () => {
    expect(lossAccountingErrors({ ...initialLossAccountingForm(COMPUTED), identityTolerance: 'x' })).toEqual({});
  });

  it('the declared body carries exactly the DTO keys', () => {
    const body = lossAccountingBody({ ...initialLossAccountingForm(DECLARED), identityTolerance: '2.5', stopsCrossCheck: false }, COMPUTED);
    expect(body).toEqual({ grain: 'day', dayStart: '00:00', lossBasis: 'declared', targetSource: 'declared', accountingUnitId: 'u-1', accountingProductId: null, stopsCrossCheck: false, identityTolerance: 2.5 });
  });

  it('the declared body carries the chosen accounting product; none is sent as null', () => {
    const form = { ...initialLossAccountingForm(DECLARED), accountingProductId: 'prod-1' };
    expect(lossAccountingBody(form, COMPUTED).accountingProductId).toBe('prod-1');
    expect(lossAccountingBody({ ...form, accountingProductId: '' }, COMPUTED).accountingProductId).toBeNull();
    expect(lossAccountingErrors({ ...form, accountingProductId: '' })).toEqual({});
  });

  it('the computed body drops the declared choices and keeps the version in force for the rest', () => {
    const form = { ...initialLossAccountingForm({ ...DECLARED, stopsCrossCheck: false, accountingProductId: 'prod-1' }), lossBasis: 'computed' as const, grain: 'shift' as const };
    expect(lossAccountingBody(form, { ...COMPUTED, stopsCrossCheck: false, identityTolerance: 1 })).toEqual({
      grain: 'shift', dayStart: '06:00', lossBasis: 'computed', targetSource: 'plan', accountingUnitId: null, accountingProductId: null, stopsCrossCheck: false, identityTolerance: 1,
    });
  });

  it('summarises a version in plain words', () => {
    expect(lossAccountingSummary(COMPUTED)).toBe('Shift accounting · computed from measurements and stops');
    expect(lossAccountingSummary(DECLARED, 'Extruder1')).toBe('Daily accounting from 00:00 · declared by the OT production loss event · target: OT planned figure · unit: Extruder1');
    expect(lossAccountingSummary({ ...DECLARED, targetSource: 'plan' })).toContain('target: Traverse Forge plan');
  });
});
