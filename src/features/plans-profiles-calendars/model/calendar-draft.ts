import { plantLocalToUtc, utcToPlantLocal } from '@/features/event-hub/model/plant-local-time';
import type { CalendarCreateBody, CalendarPatchBody } from '@/api/v2/queries/calendars';
import type { CalendarDefinition, CalendarVersionView, ExclusionKind, Holiday, ShiftTemplate } from '@/api/v2/types/calendars';
import type { FieldErrors } from './profile-form';

/**
 * Calendar editor model (plan 3.4 step 2, CAL01): what the user types — local times `HH:mm`, operational
 * dates, exclusions on the calendar's own clock — and the API body. Generation, DST handling and every
 * schedule rule stay on the server (preview); the browser checks only the request shape, with the API's
 * field paths (`shiftTemplates.0.startLocal`) so 422 field errors land on the same inputs.
 */
export interface TemplateRow {
  name: string;
  startLocal: string;
  endLocal: string;
  /** ISO weekdays as text, e.g. "1,2,3,4,5"; empty = every day */
  days: string;
}

export interface ExclusionRow {
  /** `YYYY-MM-DDTHH:mm` on the calendar's clock */
  from: string;
  to: string;
  reason: string;
  kind: ExclusionKind;
}

export interface CalendarDraft {
  timezone: string;
  operationalDayStart: string;
  effectiveFrom: string;
  effectiveTo: string;
  templates: TemplateRow[];
  holidays: Holiday[];
  exclusions: ExclusionRow[];
}

const LOCAL_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAYS = /^\s*[1-7](\s*,\s*[1-7])*\s*$/;

/** D03 defaults offered for a new site calendar: the plant zone, 06:00 day start, three 8-hour shifts. */
export function newCalendarDraft(timezone: string): CalendarDraft {
  return {
    timezone,
    operationalDayStart: '06:00',
    effectiveFrom: '',
    effectiveTo: '',
    templates: [
      { name: 'A', startLocal: '06:00', endLocal: '14:00', days: '' },
      { name: 'B', startLocal: '14:00', endLocal: '22:00', days: '' },
      { name: 'C', startLocal: '22:00', endLocal: '06:00', days: '' },
    ],
    holidays: [],
    exclusions: [],
  };
}

export function draftOf(version: CalendarVersionView): CalendarDraft {
  return {
    timezone: version.timezone,
    operationalDayStart: version.operationalDayStart,
    effectiveFrom: version.effectiveFrom,
    effectiveTo: version.effectiveTo ?? '',
    templates: version.shiftTemplates.map((t) => ({ name: t.name, startLocal: t.startLocal, endLocal: t.endLocal, days: (t.daysOfWeek ?? []).join(',') })),
    holidays: version.holidays.map((h) => ({ ...h })),
    exclusions: version.exclusions.map((e) => ({ from: utcToPlantLocal(e.from, version.timezone), to: utcToPlantLocal(e.to, version.timezone), reason: e.reason, kind: e.kind })),
  };
}

function templateErrors(templates: readonly TemplateRow[]): FieldErrors {
  const errors: FieldErrors = {};
  if (templates.length === 0) errors.shiftTemplates = 'shiftTemplates must contain at least 1 element';
  templates.forEach((t, i) => {
    if (!t.name.trim()) errors[`shiftTemplates.${i}.name`] = 'name is required';
    if (!LOCAL_TIME.test(t.startLocal)) errors[`shiftTemplates.${i}.startLocal`] = 'startLocal must be a local time HH:mm';
    if (!LOCAL_TIME.test(t.endLocal)) errors[`shiftTemplates.${i}.endLocal`] = 'endLocal must be a local time HH:mm';
    if (t.days && !DAYS.test(t.days)) errors[`shiftTemplates.${i}.daysOfWeek`] = 'days are ISO weekdays 1–7, comma separated';
  });
  return errors;
}

function listErrors(draft: CalendarDraft): FieldErrors {
  const errors: FieldErrors = {};
  draft.holidays.forEach((h, i) => {
    if (!LOCAL_DATE.test(h.date)) errors[`holidays.${i}.date`] = 'date must be a local date YYYY-MM-DD';
    if (!h.name.trim()) errors[`holidays.${i}.name`] = 'name is required';
  });
  draft.exclusions.forEach((e, i) => {
    if (!plantLocalToUtc(e.from, draft.timezone)) errors[`exclusions.${i}.from`] = 'from is required';
    if (!plantLocalToUtc(e.to, draft.timezone)) errors[`exclusions.${i}.to`] = 'to is required';
    if (!e.reason.trim()) errors[`exclusions.${i}.reason`] = 'reason is required';
  });
  return errors;
}

export function validateCalendarDraft(draft: CalendarDraft): FieldErrors {
  const errors: FieldErrors = { ...templateErrors(draft.templates), ...listErrors(draft) };
  if (!draft.timezone.trim()) errors.timezone = 'timezone is required';
  if (!LOCAL_TIME.test(draft.operationalDayStart)) errors.operationalDayStart = 'operationalDayStart must be a local time HH:mm';
  if (!LOCAL_DATE.test(draft.effectiveFrom)) errors.effectiveFrom = 'effectiveFrom must be a local date YYYY-MM-DD';
  if (draft.effectiveTo && !LOCAL_DATE.test(draft.effectiveTo)) errors.effectiveTo = 'effectiveTo must be a local date YYYY-MM-DD';
  return errors;
}

const template = (t: TemplateRow): ShiftTemplate => ({
  name: t.name.trim(),
  startLocal: t.startLocal,
  endLocal: t.endLocal,
  ...(t.days.trim() ? { daysOfWeek: t.days.split(',').map((d) => Number(d.trim())) } : {}),
});

/** The definition part (also the inline preview candidate). */
export function definitionOf(draft: CalendarDraft): CalendarDefinition {
  return {
    timezone: draft.timezone.trim(),
    operationalDayStart: draft.operationalDayStart,
    shiftTemplates: draft.templates.map(template),
    holidays: draft.holidays.map((h) => ({ ...h, name: h.name.trim() })),
    exclusions: draft.exclusions.map((e) => ({
      from: plantLocalToUtc(e.from, draft.timezone) as string,
      to: plantLocalToUtc(e.to, draft.timezone) as string,
      reason: e.reason.trim(),
      kind: e.kind,
    })),
  };
}

export function calendarPatchBody(draft: CalendarDraft): CalendarPatchBody {
  return { ...definitionOf(draft), effectiveFrom: draft.effectiveFrom, effectiveTo: draft.effectiveTo || null };
}

export function calendarCreateBody(draft: CalendarDraft, scope: { siteId?: string; unitId?: string }): CalendarCreateBody {
  return { ...calendarPatchBody(draft), ...scope } as CalendarCreateBody;
}
