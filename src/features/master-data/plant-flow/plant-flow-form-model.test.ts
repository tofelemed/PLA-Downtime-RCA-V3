import { describe, expect, it } from 'vitest';
import {
  bufferLevelCreateBody,
  emptyBufferLevelForm,
  emptyFlowRouteForm,
  flowRouteCreateBody,
  routeKeyOf,
  validateBufferLevelForm,
  validateFlowRouteForm,
} from './plant-flow-form-model';

const TZ = 'Asia/Tehran';

describe('plant flow forms (SME E2)', () => {
  it('asks for two different units and, with a buffer, its unit and a positive draw', () => {
    const errors = validateFlowRouteForm({ ...emptyFlowRouteForm(), fromUnitId: 'u1', toUnitId: 'u1', usableInventory: '100', inventoryUom: ' ', drawRatePerHour: null }, TZ);
    expect(Object.keys(errors).sort()).toEqual(['drawRatePerHour', 'effectiveFrom', 'inventoryUom', 'toUnitId']);
  });

  it('builds the exact route body; a direct route sends no buffer unit or draw', () => {
    const direct = flowRouteCreateBody({ ...emptyFlowRouteForm(), fromUnitId: 'u1', toUnitId: 'u2', effectiveFrom: '2026-10-01T06:00' }, TZ);
    expect(Object.keys(direct).sort()).toEqual(
      ['bufferName', 'drawRatePerHour', 'effectiveFrom', 'effectiveTo', 'fromUnitId', 'inventoryUom', 'maxOperatingLevel', 'minOperatingLevel', 'routeRole', 'toUnitId', 'usableInventory'].sort(),
    );
    expect(direct).toMatchObject({ inventoryUom: null, drawRatePerHour: null, routeRole: 'feed', effectiveFrom: '2026-10-01T02:30:00.000Z' });
    const buffered = flowRouteCreateBody({ ...emptyFlowRouteForm(), fromUnitId: 'u1', toUnitId: 'u2', usableInventory: '100', drawRatePerHour: '20', effectiveFrom: '2026-10-01T06:00' }, TZ);
    expect(buffered).toMatchObject({ usableInventory: '100', inventoryUom: 't', drawRatePerHour: '20' });
  });

  it('records a level against the chosen buffer', () => {
    const values = { ...emptyBufferLevelForm(), routeKey: routeKeyOf({ fromUnitId: 'u1', toUnitId: 'u2' }), observedAt: '2026-10-01T06:00', level: '60' };
    expect(validateBufferLevelForm(values, TZ)).toEqual({});
    expect(bufferLevelCreateBody(values, TZ)).toEqual({ fromUnitId: 'u1', toUnitId: 'u2', observedAt: '2026-10-01T02:30:00.000Z', level: '60', uom: 't', source: 'manual' });
  });
});
