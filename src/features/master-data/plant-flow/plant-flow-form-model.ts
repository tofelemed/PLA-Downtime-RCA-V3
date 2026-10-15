import { plantLocalToUtc } from '@/lib/dates';
import type { BufferLevelCreateBody, FlowRouteCreateBody } from '@/api/v2/queries/plant-model';
import { type FieldErrors, validityErrors } from '@/features/plans-profiles-calendars/model/profile-form';

/**
 * Flow-route and buffer-level forms (SME E2). The browser checks only the request shape the API validates
 * (both units, different, a buffer's unit and draw rate); cycles, overlaps and the propagation itself are
 * the server's. Times are typed on the plant clock.
 */
export interface FlowRouteFormValues {
  fromUnitId: string;
  toUnitId: string;
  routeRole: 'feed' | 'alternate';
  bufferName: string;
  usableInventory: string | null;
  minOperatingLevel: string | null;
  maxOperatingLevel: string | null;
  inventoryUom: string;
  drawRatePerHour: string | null;
  effectiveFrom: string;
  effectiveTo: string;
}

export interface BufferLevelFormValues {
  routeKey: string;
  observedAt: string;
  level: string | null;
  uom: string;
}

export const emptyFlowRouteForm = (): FlowRouteFormValues => ({
  fromUnitId: '',
  toUnitId: '',
  routeRole: 'feed',
  bufferName: '',
  usableInventory: null,
  minOperatingLevel: null,
  maxOperatingLevel: null,
  inventoryUom: 't',
  drawRatePerHour: null,
  effectiveFrom: '',
  effectiveTo: '',
});

export const emptyBufferLevelForm = (): BufferLevelFormValues => ({ routeKey: '', observedAt: '', level: null, uom: 't' });

/** `from|to` of a route, the value of the route picker. */
export const routeKeyOf = (route: { fromUnitId: string; toUnitId: string }) => `${route.fromUnitId}|${route.toUnitId}`;

export function validateFlowRouteForm(values: FlowRouteFormValues, timezone: string): FieldErrors {
  const errors = validityErrors(values.effectiveFrom, values.effectiveTo, timezone);
  if (!values.fromUnitId) errors.fromUnitId = 'Choose the supplying unit';
  if (!values.toUnitId) errors.toUnitId = 'Choose the supplied unit';
  if (values.fromUnitId && values.fromUnitId === values.toUnitId) errors.toUnitId = 'Choose a different unit';
  const buffered = values.usableInventory !== null || values.maxOperatingLevel !== null;
  if (buffered && !values.inventoryUom.trim()) errors.inventoryUom = 'Enter the inventory unit';
  if (buffered && !(Number(values.drawRatePerHour) > 0)) errors.drawRatePerHour = 'Enter the downstream draw per hour (> 0)';
  return errors;
}

export function flowRouteCreateBody(values: FlowRouteFormValues, timezone: string): FlowRouteCreateBody {
  const buffered = values.usableInventory !== null || values.maxOperatingLevel !== null;
  return {
    fromUnitId: values.fromUnitId,
    toUnitId: values.toUnitId,
    routeRole: values.routeRole,
    bufferName: values.bufferName.trim() || null,
    usableInventory: values.usableInventory,
    minOperatingLevel: values.minOperatingLevel,
    maxOperatingLevel: values.maxOperatingLevel,
    inventoryUom: buffered ? values.inventoryUom.trim() : null,
    drawRatePerHour: buffered ? values.drawRatePerHour : null,
    effectiveFrom: plantLocalToUtc(values.effectiveFrom, timezone) as string,
    effectiveTo: values.effectiveTo ? plantLocalToUtc(values.effectiveTo, timezone) : null,
  };
}

export function validateBufferLevelForm(values: BufferLevelFormValues, timezone: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.routeKey) errors.fromUnitId = 'Choose the buffer';
  if (!plantLocalToUtc(values.observedAt, timezone)) errors.observedAt = 'Enter when the level was read';
  if (values.level === null) errors.level = 'Enter the level';
  if (!values.uom.trim()) errors.uom = 'Enter the unit';
  return errors;
}

export function bufferLevelCreateBody(values: BufferLevelFormValues, timezone: string): BufferLevelCreateBody {
  const [fromUnitId, toUnitId] = values.routeKey.split('|');
  return {
    fromUnitId,
    toUnitId,
    observedAt: plantLocalToUtc(values.observedAt, timezone) as string,
    level: values.level as string,
    uom: values.uom.trim(),
    source: 'manual',
  };
}
