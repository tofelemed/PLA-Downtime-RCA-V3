import { describe, expect, it } from 'vitest';
import { V2ApiError } from '@/api/v2/errors';
import type { ProductionEventView } from '@/api/v2/types/events';
import { changedFields } from './event-draft';
import { EMPTY_FORM, formValuesOf, serverFormErrors, toCreateBody, toPatchBody, validateEventForm, type EventFormValues } from './event-form';
import { reasonPatchFields, reasonValuesOf, SPLIT_INCOMPLETE_MESSAGE, SPLIT_RECOVERY_ONLY_MESSAGE } from './reason-form';

const UTC = 'UTC';
const SPLIT_STOP = {
  id: 'e1', unitId: 'u1', assetId: null, startTime: '2026-10-15T06:00:00.000Z', endTime: '2026-10-15T07:00:00.000Z', plannedEndTime: null, durationSeconds: 3600,
  classification: { physicalType: 'downtime', scheduleClass: 'unplanned', oeeComponent: null, impactMode: null, impactFraction: null, impactBasis: null },
  reasonCodeId: 'r1', reasonWeights: [{ reasonCodeId: 'r1', weight: '0.60000000' }, { reasonCodeId: 'r2', weight: '0.40000000' }],
  codingNote: 'Belt slipped after the motor trip', description: null, investigationPending: false, originUnitId: null, originAssetId: null, rowVersion: 3,
} as unknown as ProductionEventView;
const SINGLE_STOP = { ...SPLIT_STOP, reasonWeights: null, codingNote: null } as unknown as ProductionEventView;

const rows = (...entries: Array<[string, string]>) => entries.map(([reasonCodeId, value], key) => ({ key, reasonCodeId, value }));

describe('reason section of the event form (D-T5 split, coding note)', () => {
  it('starts from the stored split as percents, or from the current reason and one empty row', () => {
    expect(reasonValuesOf(SPLIT_STOP)).toEqual({ codingNote: 'Belt slipped after the motor trip', splitEnabled: true, splitMode: 'percent', splitRows: rows(['r1', '60'], ['r2', '40']) });
    expect(reasonValuesOf(SINGLE_STOP)).toEqual({ codingNote: '', splitEnabled: false, splitMode: 'percent', splitRows: rows(['r1', ''], ['', '']) });
    expect(formValuesOf(SPLIT_STOP, UTC)).toMatchObject({ splitEnabled: true, codingNote: 'Belt slipped after the motor trip' });
  });

  it('sends the weights when a split is entered, and never the reason code beside them', () => {
    const initial = formValuesOf(SINGLE_STOP, UTC);
    const split = { ...initial, reasonCodeId: 'r9', splitEnabled: true, splitRows: rows(['r1', '70'], ['r2', '30']) };
    expect(toPatchBody(initial, split, UTC)).toEqual({ reasonWeights: [{ reasonCodeId: 'r1', percent: '70' }, { reasonCodeId: 'r2', percent: '30' }] });
    const minutes = { ...split, splitMode: 'minutes' as const, splitRows: rows(['r1', '45'], ['r2', '15']) };
    expect(toPatchBody(initial, minutes, UTC)).toEqual({ reasonWeights: [{ reasonCodeId: 'r1', seconds: 2700 }, { reasonCodeId: 'r2', seconds: 900 }] });
  });

  it('leaves an unchanged stored split alone and sends it again when a share or the basis changes', () => {
    const initial = formValuesOf(SPLIT_STOP, UTC);
    expect(toPatchBody(initial, { ...initial }, UTC)).toEqual({});
    expect(toPatchBody(initial, { ...initial, splitRows: rows(['r1', '50'], ['r2', '50']) }, UTC)).toEqual({ reasonWeights: [{ reasonCodeId: 'r1', percent: '50' }, { reasonCodeId: 'r2', percent: '50' }] });
    expect(reasonPatchFields(initial, { ...initial, splitMode: 'minutes' })).toEqual({ reasonWeights: [{ reasonCodeId: 'r1', seconds: 3600 }, { reasonCodeId: 'r2', seconds: 2400 }] });
  });

  it('removes a stored split when it is unticked, with a changed reason code beside it', () => {
    const initial = formValuesOf(SPLIT_STOP, UTC);
    expect(toPatchBody(initial, { ...initial, splitEnabled: false }, UTC)).toEqual({ reasonWeights: null });
    expect(toPatchBody(initial, { ...initial, splitEnabled: false, reasonCodeId: 'r2' }, UTC)).toEqual({ reasonWeights: null, reasonCodeId: 'r2' });
    expect(toPatchBody(initial, { ...initial, splitEnabled: false, reasonCodeId: '' }, UTC)).toEqual({ reasonWeights: null, reasonCodeId: null });
  });

  it('sends the note trimmed, null when a stored note is emptied, and nothing while unchanged', () => {
    const initial = formValuesOf(SPLIT_STOP, UTC);
    expect(toPatchBody(initial, { ...initial, codingNote: '  Motor tripped twice  ' }, UTC)).toEqual({ codingNote: 'Motor tripped twice' });
    expect(toPatchBody(initial, { ...initial, codingNote: '' }, UTC)).toEqual({ codingNote: null });
    expect(toCreateBody({ ...EMPTY_FORM, unitId: 'u1', startLocal: '2026-10-15T06:00', codingNote: ' Seen on the DCS ' }, UTC)).toMatchObject({ codingNote: 'Seen on the DCS' });
    expect(toCreateBody({ ...EMPTY_FORM, unitId: 'u1', startLocal: '2026-10-15T06:00' }, UTC)).not.toHaveProperty('codingNote');
  });

  it('refuses an incomplete split or one of recoveries only before anything is sent; the sum is the server’s', () => {
    const base: EventFormValues = { ...formValuesOf(SINGLE_STOP, UTC), splitEnabled: true };
    expect(validateEventForm({ ...base, splitRows: rows(['r1', '60'], ['', '']) }, 'edit', UTC).splitRows).toBe(SPLIT_INCOMPLETE_MESSAGE);
    expect(validateEventForm({ ...base, splitRows: rows(['r1', '60'], ['r2', '40']).map((row) => ({ ...row, recovery: true })) }, 'edit', UTC).splitRows).toBe(SPLIT_RECOVERY_ONLY_MESSAGE);
    expect(validateEventForm({ ...base, splitRows: rows(['r1', '60'], ['r2', '60']) }, 'edit', UTC).splitRows).toBeUndefined();
    expect(validateEventForm({ ...base, splitRows: rows(['r1', '60'], ['', '']) }, 'create', UTC).splitRows).toBeUndefined();
    const refused = new V2ApiError(422, {
      code: 'REASON_WEIGHTS_SUM',
      message: 'The percents add up to 120, not 100',
      fieldErrors: [{ field: 'reasonWeights', message: 'The percents add up to 120, not 100' }],
      correlationId: 'c1',
      retryable: false,
    });
    expect(serverFormErrors(refused).fields).toEqual({ splitRows: 'The percents add up to 120, not 100' });
  });

  it('counts the split rows as unchanged after a draft round trip through storage, and as changed when a share moves', () => {
    const initial = formValuesOf(SPLIT_STOP, UTC);
    const restored = JSON.parse(JSON.stringify(initial)) as EventFormValues;
    expect(changedFields(initial, restored)).toEqual([]);
    expect(changedFields(initial, { ...initial, splitRows: rows(['r1', '61'], ['r2', '39']) })).toEqual(['splitRows']);
  });
});
