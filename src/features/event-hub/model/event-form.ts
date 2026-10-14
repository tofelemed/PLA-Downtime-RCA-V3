import { describeError } from '@/features/ux-kit/errors';
import type { CreateEventBody } from '@/api/v2/queries/event-commands';
import type { PatchEventInput } from '@/api/v2/queries/production-events';
import { StaleRevisionError, V2ApiError } from '@/api/v2/errors';
import type { ProductionEventView } from '@/api/v2/types/events';
import { EMPTY_FAILURE, failureCreateFields, failurePatchFields, failureValuesOf, type FailureValues } from './failure-form';
import { plantLocalToUtc, utcToPlantLocal } from './plant-local-time';

/**
 * Create / edit form of an event (plan 3.2 step 3, DTO = §15.3). Times are entered on the plant clock,
 * the duration in minutes (C1) and sent in seconds; the end **or** the duration closes the event. The
 * browser only checks what it must to build a request — interval rules (end after start, end and
 * duration agreeing within 1 s) are the server's and come back as 422 field errors.
 */
export interface EventFormValues extends FailureValues {
  unitId: string;
  startLocal: string;
  endLocal: string;
  durationMinutes: string;
  physicalType: string;
  scheduleClass: string;
  reasonCodeId: string;
  description: string;
  /** SME Q5, downtime only: '' = not stated (the server treats it as a full stop), full_stop, fractional, none */
  impactMode: string;
  /** share of output lost while `fractional`, in percent */
  impactPercent: string;
  /** SME D3: unit / asset whose failure caused the stop ('' = this unit) */
  originUnitId: string;
  originAssetId: string;
  /** SME D4: approved end of a planned stop's window (plant clock); time after it is overrun */
  plannedEndLocal: string;
}

export type EventFormField = keyof EventFormValues;
export type FieldErrors = Partial<Record<EventFormField, string>>;

export const EMPTY_FORM: EventFormValues = {
  unitId: '',
  startLocal: '',
  endLocal: '',
  durationMinutes: '',
  physicalType: 'downtime',
  scheduleClass: '',
  reasonCodeId: '',
  description: '',
  impactMode: '',
  impactPercent: '',
  originUnitId: '',
  originAssetId: '',
  plannedEndLocal: '',
  ...EMPTY_FAILURE,
};

export function formValuesOf(event: ProductionEventView, timezone: string): EventFormValues {
  return {
    unitId: event.unitId,
    startLocal: utcToPlantLocal(event.startTime, timezone),
    endLocal: utcToPlantLocal(event.endTime, timezone),
    durationMinutes: '',
    physicalType: event.classification.physicalType,
    scheduleClass: event.classification.scheduleClass,
    reasonCodeId: event.reasonCodeId ?? '',
    description: event.description ?? '',
    impactMode: event.classification.impactMode ?? '',
    impactPercent: event.classification.impactFraction ? String(Number(event.classification.impactFraction) * 100) : '',
    originUnitId: event.originUnitId ?? '',
    originAssetId: event.originAssetId ?? '',
    plannedEndLocal: utcToPlantLocal(event.plannedEndTime, timezone),
    ...failureValuesOf(event),
  };
}

/** Percent text → the API's 0..1 fraction (decimal string). */
function fractionOf(percent: string): string {
  return String(Number(percent) / 100);
}

/** Minutes text → seconds with at most 3 decimals (the API's precision); null when empty. */
export function minutesToSeconds(text: string): number | null {
  if (text.trim() === '') return null;
  const minutes = Number(text);
  if (!Number.isFinite(minutes)) return Number.NaN;
  return Math.round(minutes * 60_000) / 1000;
}

/** Request-shape checks only; everything about the interval itself is decided by the server. */
export function validateEventForm(values: EventFormValues, mode: 'create' | 'edit', timezone: string): FieldErrors {
  const errors: FieldErrors = {};
  if (mode === 'create' && !values.unitId) errors.unitId = 'Choose a unit';
  if (!values.startLocal) errors.startLocal = 'Enter the start time';
  else if (!plantLocalToUtc(values.startLocal, timezone)) errors.startLocal = 'Not a valid time';
  if (values.endLocal && !plantLocalToUtc(values.endLocal, timezone)) errors.endLocal = 'Not a valid time';
  if (values.plannedEndLocal && !plantLocalToUtc(values.plannedEndLocal, timezone)) errors.plannedEndLocal = 'Not a valid time';
  const seconds = minutesToSeconds(values.durationMinutes);
  if (seconds !== null && (Number.isNaN(seconds) || seconds < 0)) errors.durationMinutes = 'Enter minutes (0 or more)';
  if (values.physicalType === 'downtime' && values.impactMode === 'fractional') {
    const percent = Number(values.impactPercent);
    if (values.impactPercent.trim() === '' || !(percent > 0 && percent <= 100)) errors.impactPercent = 'Enter the share of output lost (above 0, up to 100 %)';
  }
  return errors;
}

const optional = (value: string) => (value === '' ? undefined : value);

export function toCreateBody(values: EventFormValues, timezone: string): CreateEventBody {
  const seconds = minutesToSeconds(values.durationMinutes);
  const body: CreateEventBody = {
    unitId: values.unitId,
    startTime: plantLocalToUtc(values.startLocal, timezone) ?? values.startLocal,
    physicalType: values.physicalType as CreateEventBody['physicalType'],
  };
  const endTime = values.endLocal ? plantLocalToUtc(values.endLocal, timezone) : null;
  if (endTime) body.endTime = endTime;
  if (seconds !== null) body.durationSeconds = seconds;
  if (values.scheduleClass) body.scheduleClass = values.scheduleClass as CreateEventBody['scheduleClass'];
  if (values.reasonCodeId) body.reasonCodeId = values.reasonCodeId;
  const downtime = values.physicalType === 'downtime';
  if (downtime && values.impactMode) body.impactMode = values.impactMode as CreateEventBody['impactMode'];
  if (downtime && values.impactMode === 'fractional') body.impactFraction = fractionOf(values.impactPercent);
  if (values.originUnitId) body.originUnitId = values.originUnitId;
  const plannedEndTime = values.plannedEndLocal ? plantLocalToUtc(values.plannedEndLocal, timezone) : null;
  if (plannedEndTime) body.plannedEndTime = plannedEndTime;
  if (values.originAssetId) body.originAssetId = values.originAssetId;
  Object.assign(body, failureCreateFields(values));
  const description = optional(values.description.trim());
  if (description) body.description = description;
  return body;
}

type PatchBody = PatchEventInput['changes'];

function intervalChanges(initial: EventFormValues, values: EventFormValues, timezone: string): PatchBody {
  const changes: PatchBody = {};
  if (values.startLocal !== initial.startLocal) changes.startTime = plantLocalToUtc(values.startLocal, timezone) ?? undefined;
  const endChanged = values.endLocal !== initial.endLocal;
  if (endChanged) changes.endTime = values.endLocal ? plantLocalToUtc(values.endLocal, timezone) : null;
  const seconds = minutesToSeconds(values.durationMinutes);
  if (seconds !== null) {
    changes.durationSeconds = seconds;
    // a duration alone sets the end from the start (the old end would otherwise conflict)
    if (!endChanged) changes.endTime = null;
  }
  return changes;
}

/** PATCH body with only the fields the user changed (`null` clears; untouched fields are left out). */
export function toPatchBody(initial: EventFormValues, values: EventFormValues, timezone: string): PatchBody {
  const changes = intervalChanges(initial, values, timezone);
  if (values.physicalType !== initial.physicalType) changes.physicalType = values.physicalType as PatchBody['physicalType'];
  if (values.scheduleClass !== initial.scheduleClass && values.scheduleClass) {
    changes.scheduleClass = values.scheduleClass as PatchBody['scheduleClass'];
  }
  if (values.reasonCodeId !== initial.reasonCodeId) changes.reasonCodeId = values.reasonCodeId || null;
  if (values.description !== initial.description) changes.description = values.description.trim() || null;
  if (values.originUnitId !== initial.originUnitId) changes.originUnitId = values.originUnitId || null;
  if (values.plannedEndLocal !== initial.plannedEndLocal) {
    changes.plannedEndTime = values.plannedEndLocal ? plantLocalToUtc(values.plannedEndLocal, timezone) : null;
  }
  if (values.originAssetId !== initial.originAssetId) changes.originAssetId = values.originAssetId || null;
  Object.assign(changes, failurePatchFields(initial, values));
  const impactChanged = values.impactMode !== initial.impactMode || (values.impactMode === 'fractional' && values.impactPercent !== initial.impactPercent);
  if (impactChanged && values.impactMode && values.physicalType === 'downtime') {
    changes.impactMode = values.impactMode as PatchBody['impactMode'];
    changes.impactFraction = values.impactMode === 'fractional' ? fractionOf(values.impactPercent) : null;
  }
  return changes;
}

/** API field → form field (§15.3 names to the inputs that produced them). */
const SERVER_FIELDS: Readonly<Record<string, EventFormField>> = {
  unitId: 'unitId',
  startTime: 'startLocal',
  endTime: 'endLocal',
  durationSeconds: 'durationMinutes',
  physicalType: 'physicalType',
  scheduleClass: 'scheduleClass',
  reasonCodeId: 'reasonCodeId',
  description: 'description',
  impactMode: 'impactMode',
  impactFraction: 'impactPercent',
  originUnitId: 'originUnitId',
  originAssetId: 'originAssetId',
  plannedEndTime: 'plannedEndLocal',
  failureMode: 'failureMode',
  failureSeverity: 'failureSeverity',
  maintainableItem: 'maintainableItem',
  failureMechanism: 'failureMechanism',
  failureCause: 'failureCause',
  detectionMethod: 'detectionMethod',
};

export interface ServerFormErrors {
  fields: FieldErrors;
  /** plain-language errors without a matching input (refusals such as a source-owned value, unknown failures) */
  form: string | null;
}

/** API03 envelope → inline field messages plus a form-level message (422 DURATION_CONFLICT etc.). */
export function serverFormErrors(error: unknown): ServerFormErrors {
  if (!(error instanceof V2ApiError)) return { fields: {}, form: 'The request failed. Try again.' };
  if (error instanceof StaleRevisionError) return { fields: {}, form: null };
  const fields: FieldErrors = {};
  const unmatched: string[] = [];
  for (const entry of error.fieldErrors) {
    const field = SERVER_FIELDS[entry.field.split('.')[0]];
    if (field && !fields[field]) fields[field] = entry.message;
    else if (!field) unmatched.push(entry.message);
  }
  const hasFields = Object.keys(fields).length > 0;
  const friendly = describeError(error);
  const form = hasFields && unmatched.length === 0 ? null : [`${friendly.title}. ${friendly.message}`, ...unmatched].join(' · ');
  return { fields, form };
}
