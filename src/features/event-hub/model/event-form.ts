import { describeError } from '@/features/ux-kit/errors';
import type { CreateEventBody } from '@/api/v2/queries/event-commands';
import type { PatchEventInput } from '@/api/v2/queries/production-events';
import { StaleRevisionError, V2ApiError } from '@/api/v2/errors';
import type { ProductionEventView } from '@/api/v2/types/events';
import { declaredCreateFields, declaredErrors, declaredPatchFields, declaredValuesOf, EMPTY_DECLARED, type DeclaredValues } from './declared-form';
import { parseDurationInput } from './duration-input';
import { EMPTY_FAILURE, failureCreateFields, failurePatchFields, failureValuesOf, type FailureValues } from './failure-form';
import { plantLocalToUtc, utcToPlantLocal } from './plant-local-time';
import { EMPTY_QUALITY, qualityCreateFields, qualityPatchFields, qualityValuesOf, type QualityValues } from './quality-form';

/** E-4: how the event's end is given — an end time, or a duration from the start (an explicit choice). */
export type IntervalMode = 'end' | 'duration';

/**
 * Create / edit form of an event (plan 3.2 step 3, DTO = §15.3). Times are entered on the plant clock;
 * the end is given **either** as an end time **or** as a duration ("2h 30m", "2:30", minutes), chosen
 * explicitly (E-4), and sent in seconds. The browser checks what it must to build a request and that an
 * end time is after the start (QA audit F3, shown at the End field); the server stays the authority for
 * every interval rule (end after start, end and duration agreeing within 1 s) and answers 422 field errors.
 */
export interface EventFormValues extends FailureValues, QualityValues, DeclaredValues {
  unitId: string;
  /** A-1: the asset that stopped (one of the unit's assets); '' = not recorded */
  assetId: string;
  startLocal: string;
  endLocal: string;
  /** E-4: which of end time / duration the user gives */
  intervalMode: IntervalMode;
  /** the duration as typed ("2h 30m", "2:30", "150" minutes); the field keeps its historical name */
  durationMinutes: string;
  physicalType: string;
  scheduleClass: string;
  /** '' = the reason code's default (as the schedule class); otherwise the person's choice (PATCH / create DTO) */
  oeeComponent: string;
  reasonCodeId: string;
  /** SME D12 (E-3): no specific reason yet — the stop is under investigation */
  investigationPending: boolean;
  description: string;
  /** SME Q5, downtime only: '' = not stated (the server treats it as a full stop), full_stop, fractional, none */
  impactMode: string;
  /** share of output lost while `fractional`, in percent */
  impactPercent: string;
  /** plan 1.10, read only: where the stored impact comes from (a unit impact rule, a standby takeover) */
  impactBasis: string;
  /** SME D3: unit / asset whose failure caused the stop ('' = this unit) */
  originUnitId: string;
  originAssetId: string;
  /** SME D4: approved end of a planned stop's window (plant clock); time after it is overrun */
  plannedEndLocal: string;
  /** edit only: why the event is changed, stored on its user revision (PATCH `changeReason`, ≤ 1000) */
  changeReason: string;
}

export type EventFormField = keyof EventFormValues;
export type FieldErrors = Partial<Record<EventFormField, string>>;

export const EMPTY_FORM: EventFormValues = {
  unitId: '',
  assetId: '',
  startLocal: '',
  endLocal: '',
  intervalMode: 'end',
  durationMinutes: '',
  physicalType: 'downtime',
  scheduleClass: '',
  oeeComponent: '',
  reasonCodeId: '',
  investigationPending: false,
  description: '',
  impactMode: '',
  impactPercent: '',
  impactBasis: '',
  originUnitId: '',
  originAssetId: '',
  plannedEndLocal: '',
  changeReason: '',
  ...EMPTY_FAILURE,
  ...EMPTY_QUALITY,
  ...EMPTY_DECLARED,
};

export function formValuesOf(event: ProductionEventView, timezone: string): EventFormValues {
  return {
    unitId: event.unitId,
    assetId: event.assetId ?? '',
    startLocal: utcToPlantLocal(event.startTime, timezone),
    endLocal: utcToPlantLocal(event.endTime, timezone),
    intervalMode: 'end',
    durationMinutes: '',
    physicalType: event.classification.physicalType,
    scheduleClass: event.classification.scheduleClass,
    oeeComponent: event.classification.oeeComponent ?? '',
    reasonCodeId: event.reasonCodeId ?? '',
    investigationPending: event.investigationPending === true,
    description: event.description ?? '',
    impactMode: event.classification.impactMode ?? '',
    impactPercent: event.classification.impactFraction ? String(Number(event.classification.impactFraction) * 100) : '',
    impactBasis: event.classification.impactBasis ?? '',
    originUnitId: event.originUnitId ?? '',
    originAssetId: event.originAssetId ?? '',
    plannedEndLocal: utcToPlantLocal(event.plannedEndTime, timezone),
    changeReason: '',
    ...failureValuesOf(event),
    ...qualityValuesOf(event),
    ...declaredValuesOf(event),
  };
}

/** Percent text → the API's 0..1 fraction (decimal string). */
function fractionOf(percent: string): string {
  return String(Number(percent) / 100);
}

/** The duration the form sends, in seconds: only in "duration" mode; null when none is given. */
export function durationSecondsOf(values: Pick<EventFormValues, 'intervalMode' | 'durationMinutes'>): number | null {
  return values.intervalMode === 'duration' ? parseDurationInput(values.durationMinutes) : null;
}

export const END_BEFORE_START_MESSAGE = 'The end must be after the start';

/**
 * QA audit F3: an end time at or before the start, said next to the End field before anything is sent (the
 * server stays the authority and answers 422 END_BEFORE_START on the same field). Null while either time is
 * missing or not a valid time, or when the end is given as a duration.
 */
export function endBeforeStartError(values: Pick<EventFormValues, 'intervalMode' | 'startLocal' | 'endLocal'>, timezone: string): string | null {
  if (values.intervalMode === 'duration' || !values.startLocal || !values.endLocal) return null;
  const start = plantLocalToUtc(values.startLocal, timezone);
  const end = plantLocalToUtc(values.endLocal, timezone);
  if (!start || !end) return null;
  return Date.parse(end) <= Date.parse(start) ? END_BEFORE_START_MESSAGE : null;
}

/**
 * The interval the impacted-periods preview reads (`to` null = open, runs to now): the end time, or the start
 * plus the typed duration in duration mode. Null while the start is missing or the end is not after the
 * start — the End field says why, so the preview never shows the server's refusal of a reversed range (F3, L8).
 */
export function impactedInterval(values: Pick<EventFormValues, 'intervalMode' | 'startLocal' | 'endLocal' | 'durationMinutes'>, timezone: string): { from: string; to: string | null } | null {
  const from = plantLocalToUtc(values.startLocal, timezone);
  if (!from) return null;
  if (values.intervalMode === 'duration') {
    const seconds = durationSecondsOf(values);
    if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return { from, to: null };
    return { from, to: new Date(Date.parse(from) + seconds * 1000).toISOString() };
  }
  const to = values.endLocal ? plantLocalToUtc(values.endLocal, timezone) : null;
  if (to && Date.parse(to) <= Date.parse(from)) return null;
  return { from, to };
}

/** Request-shape checks and the end-after-start check; the remaining interval rules are the server's. */
export function validateEventForm(values: EventFormValues, mode: 'create' | 'edit', timezone: string): FieldErrors {
  const errors: FieldErrors = {};
  if (mode === 'create' && !values.unitId) errors.unitId = 'Choose a unit';
  if (!values.startLocal) errors.startLocal = 'Enter the start time';
  else if (!plantLocalToUtc(values.startLocal, timezone)) errors.startLocal = 'Not a valid time';
  if (values.intervalMode !== 'duration' && values.endLocal && !plantLocalToUtc(values.endLocal, timezone)) errors.endLocal = 'Not a valid time';
  const order = endBeforeStartError(values, timezone);
  if (order) errors.endLocal = order;
  if (values.plannedEndLocal && !plantLocalToUtc(values.plannedEndLocal, timezone)) errors.plannedEndLocal = 'Not a valid time';
  const seconds = durationSecondsOf(values);
  if (values.intervalMode === 'duration' && (seconds === null || Number.isNaN(seconds))) errors.durationMinutes = 'Enter a duration such as 2h 30m, 2:30 or 150 (minutes)';
  if ((values.physicalType === 'downtime' && values.impactMode === 'fractional') || (values.physicalType === 'slowdown' && values.impactPercent.trim() !== '')) {
    const percent = Number(values.impactPercent);
    if (values.impactPercent.trim() === '' || !(percent > 0 && percent <= 100)) errors.impactPercent = 'Enter the share of output lost (above 0, up to 100 %)';
  }
  if (values.physicalType === 'production_output' && (!values.quantity.trim() || !Number.isFinite(Number(values.quantity)) || Number(values.quantity) < 0)) errors.quantity = 'Enter a non-negative output quantity';
  if (['production_output', 'quality_loss'].includes(values.physicalType) && !values.quantityUom.trim()) errors.quantityUom = 'Enter the quantity unit';
  if (values.physicalType === 'slowdown' && values.quantity.trim() && values.impactPercent.trim()) errors.impactPercent = 'Choose either measured lost quantity or output lost %, not both';
  if (values.physicalType === 'slowdown' && values.quantity.trim()) {
    if (!Number.isFinite(Number(values.quantity)) || Number(values.quantity) < 0) errors.quantity = 'Enter a non-negative lost quantity';
    if (!values.quantityUom.trim()) errors.quantityUom = 'Enter the quantity unit';
  }
  if (values.physicalType === 'slowdown' && !values.quantity.trim() && !values.impactPercent.trim()) errors.impactPercent = 'Enter a lost quantity or the share of output lost';
  return { ...errors, ...declaredErrors(values) };
}

const optional = (value: string) => (value === '' ? undefined : value);

export function toCreateBody(values: EventFormValues, timezone: string): CreateEventBody {
  const seconds = durationSecondsOf(values);
  const body: CreateEventBody = {
    unitId: values.unitId,
    startTime: plantLocalToUtc(values.startLocal, timezone) ?? values.startLocal,
    physicalType: values.physicalType as CreateEventBody['physicalType'],
  };
  const endTime = values.intervalMode === 'end' && values.endLocal ? plantLocalToUtc(values.endLocal, timezone) : null;
  if (endTime) body.endTime = endTime;
  if (values.assetId) body.assetId = values.assetId;
  if (seconds !== null) body.durationSeconds = seconds;
  if (values.scheduleClass) body.scheduleClass = values.scheduleClass as CreateEventBody['scheduleClass'];
  if (values.oeeComponent) body.oeeComponent = values.oeeComponent as CreateEventBody['oeeComponent'];
  if (values.reasonCodeId) body.reasonCodeId = values.reasonCodeId;
  if (values.investigationPending) body.investigationPending = true;
  const downtime = values.physicalType === 'downtime';
  if (values.physicalType === 'slowdown' && values.quantity.trim() && !values.impactPercent.trim()) body.impactMode = 'measured';
  if (values.physicalType === 'slowdown' && values.impactPercent.trim()) { body.impactMode = 'fractional'; body.impactFraction = fractionOf(values.impactPercent); }
  if (downtime && values.impactMode) body.impactMode = values.impactMode as CreateEventBody['impactMode'];
  if (downtime && values.impactMode === 'fractional') body.impactFraction = fractionOf(values.impactPercent);
  if (values.originUnitId) body.originUnitId = values.originUnitId;
  const plannedEndTime = values.plannedEndLocal ? plantLocalToUtc(values.plannedEndLocal, timezone) : null;
  if (plannedEndTime) body.plannedEndTime = plannedEndTime;
  if (values.originAssetId) body.originAssetId = values.originAssetId;
  Object.assign(body, failureCreateFields(values), qualityCreateFields(values), declaredCreateFields(values));
  const description = optional(values.description.trim());
  if (description) body.description = description;
  return body;
}

type PatchBody = PatchEventInput['changes'];

/**
 * Start, and the end as the user chose to give it (E-4): in "end" mode a changed end time; in "duration"
 * mode the duration, with the stored end released so the server derives it from the start (the user
 * picked "Duration", which says so — nothing is cleared silently).
 */
function intervalChanges(initial: EventFormValues, values: EventFormValues, timezone: string): PatchBody {
  const changes: PatchBody = {};
  if (values.startLocal !== initial.startLocal) changes.startTime = plantLocalToUtc(values.startLocal, timezone) ?? undefined;
  if (values.intervalMode === 'duration') {
    const seconds = durationSecondsOf(values);
    if (seconds !== null) {
      changes.durationSeconds = seconds;
      changes.endTime = null;
    }
    return changes;
  }
  if (values.endLocal !== initial.endLocal) changes.endTime = values.endLocal ? plantLocalToUtc(values.endLocal, timezone) : null;
  return changes;
}

/** PATCH body with only the fields the user changed (`null` clears; untouched fields are left out). */
export function toPatchBody(initial: EventFormValues, values: EventFormValues, timezone: string, event: ProductionEventView | null = null): PatchBody {
  const changes = intervalChanges(initial, values, timezone);
  if (values.physicalType !== initial.physicalType) changes.physicalType = values.physicalType as PatchBody['physicalType'];
  if (values.scheduleClass !== initial.scheduleClass && values.scheduleClass) {
    changes.scheduleClass = values.scheduleClass as PatchBody['scheduleClass'];
  }
  if (values.oeeComponent !== initial.oeeComponent && values.oeeComponent) {
    changes.oeeComponent = values.oeeComponent as PatchBody['oeeComponent'];
  }
  if (values.reasonCodeId !== initial.reasonCodeId) changes.reasonCodeId = values.reasonCodeId || null;
  if (values.investigationPending !== initial.investigationPending) changes.investigationPending = values.investigationPending;
  if (values.assetId !== initial.assetId) changes.assetId = values.assetId || null;
  if (values.description !== initial.description) changes.description = values.description.trim() || null;
  if (values.originUnitId !== initial.originUnitId) changes.originUnitId = values.originUnitId || null;
  if (values.plannedEndLocal !== initial.plannedEndLocal) {
    changes.plannedEndTime = values.plannedEndLocal ? plantLocalToUtc(values.plannedEndLocal, timezone) : null;
  }
  if (values.originAssetId !== initial.originAssetId) changes.originAssetId = values.originAssetId || null;
  if (values.physicalType === 'slowdown' && (values.physicalType !== initial.physicalType || values.impactPercent !== initial.impactPercent || values.quantity !== initial.quantity)) {
    changes.impactMode = values.impactPercent ? 'fractional' : values.quantity ? 'measured' : null;
    changes.impactFraction = values.impactPercent ? fractionOf(values.impactPercent) : null;
  }
  Object.assign(changes, failurePatchFields(initial, values), qualityPatchFields(initial, values), declaredPatchFields(initial, values, event));
  const impactChanged = values.impactMode !== initial.impactMode || (values.impactMode === 'fractional' && values.impactPercent !== initial.impactPercent);
  if (impactChanged && values.impactMode && values.physicalType === 'downtime') {
    changes.impactMode = values.impactMode as PatchBody['impactMode'];
    changes.impactFraction = values.impactMode === 'fractional' ? fractionOf(values.impactPercent) : null;
  }
  return withChangeReason(changes, values.changeReason);
}

/** The change reason travels with a real change only (a reason alone changes nothing). */
function withChangeReason(changes: PatchBody, reason: string): PatchBody {
  const text = reason.trim();
  return text && Object.keys(changes).length > 0 ? { ...changes, changeReason: text } : changes;
}

/** API field → form field (§15.3 names to the inputs that produced them). */
const SERVER_FIELDS: Readonly<Record<string, EventFormField>> = {
  unitId: 'unitId',
  assetId: 'assetId',
  investigationPending: 'investigationPending',
  startTime: 'startLocal',
  endTime: 'endLocal',
  durationSeconds: 'durationMinutes',
  physicalType: 'physicalType',
  scheduleClass: 'scheduleClass',
  oeeComponent: 'oeeComponent',
  reasonCodeId: 'reasonCodeId',
  description: 'description',
  impactMode: 'impactMode',
  impactFraction: 'impactPercent',
  originUnitId: 'originUnitId',
  originAssetId: 'originAssetId',
  plannedEndTime: 'plannedEndLocal',
  changeReason: 'changeReason',
  failureMode: 'failureMode',
  failureSeverity: 'failureSeverity',
  maintainableItem: 'maintainableItem',
  failureMechanism: 'failureMechanism',
  failureCause: 'failureCause',
  detectionMethod: 'detectionMethod',
  quantity: 'quantity',
  quantityUom: 'quantityUom',
  dispositionClass: 'dispositionClass',
};

export interface ServerFormErrors {
  fields: FieldErrors;
  /** plain-language errors without a matching input (refusals such as a source-owned value, unknown failures) */
  form: string | null;
}

/**
 * API03 envelope → inline field messages plus a form-level message (422 DURATION_CONFLICT etc.). The
 * form-level message also names every refused field ("Duration: …"), so the alert says what to fix even
 * when the input is off screen; a property the server does not accept ("Unexpected field: xyz") is only
 * listed there, never put on an input.
 */
export function serverFormErrors(error: unknown): ServerFormErrors {
  if (!(error instanceof V2ApiError)) return { fields: {}, form: 'The request failed. Try again.' };
  if (error instanceof StaleRevisionError) return { fields: {}, form: null };
  const friendly = describeError(error);
  const fields: FieldErrors = {};
  error.fieldErrors.forEach((entry, index) => {
    const field = SERVER_FIELDS[entry.field.split('.')[0]];
    if (field && !fields[field] && !friendly.fieldMessages[index]?.unexpected) fields[field] = entry.message;
  });
  const listed = friendly.fieldMessages.map((entry) => `${entry.label}: ${entry.message}`);
  return { fields, form: [`${friendly.title}. ${friendly.message}`, ...listed].join(' · ') };
}
