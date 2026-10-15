import { describe, expect, it } from 'vitest';
import { EMPTY_QUALITY, qualityCreateFields, qualityPatchFields } from './quality-form';

describe('event quality-loss fields (SME E3)', () => {
  it('a quality loss sends its quantity, unit and disposition', () => {
    expect(qualityCreateFields({ physicalType: 'quality_loss', quantity: '5', quantityUom: ' t ', dispositionClass: 'downgrade' })).toEqual({
      quantity: '5',
      quantityUom: 't',
      dispositionClass: 'downgrade',
    });
  });

  it('another event type sends none of them (the server refuses a class there)', () => {
    expect(qualityCreateFields({ physicalType: 'downtime', quantity: '5', quantityUom: 't', dispositionClass: 'scrap' })).toEqual({});
  });

  it('a PATCH carries only the changed fields; an emptied one is cleared', () => {
    const initial = { quantity: '5', quantityUom: 't', dispositionClass: 'rework' };
    expect(qualityPatchFields(initial, { ...initial, physicalType: 'quality_loss', dispositionClass: '' })).toEqual({ dispositionClass: null });
  });

  it('changing the type away from quality loss clears a stored class', () => {
    const initial = { ...EMPTY_QUALITY, dispositionClass: 'scrap' };
    expect(qualityPatchFields(initial, { ...initial, physicalType: 'downtime' })).toEqual({ dispositionClass: null });
  });
});
