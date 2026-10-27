import type { CreateEventBody } from '@/api/v2/queries/event-commands';
import type { PatchEventInput } from '@/api/v2/queries/production-events';
import type { DeclaredFigures, ProductionEventView } from '@/api/v2/types/events';
import { PRODUCTION_LOSS } from './production-loss';

/** The declared-figure inputs of the event form (type "Production loss"): tonnes as typed, status optional. */
export const DECLARED_FIELDS = ['declaredPlanned', 'declaredActual', 'declaredShortfall', 'declaredStatus'] as const;
export type DeclaredField = (typeof DECLARED_FIELDS)[number];
export type DeclaredValues = Record<DeclaredField, string>;

export const EMPTY_DECLARED: DeclaredValues = { declaredPlanned: '', declaredActual: '', declaredShortfall: '', declaredStatus: '' };

/** OT status values the form offers; blank = not stated. */
export const DECLARED_STATUSES = ['DETECTED', 'CONFIRMED'] as const;

const text = (value: number | null | undefined) => (value === null || value === undefined ? '' : String(value));

export function declaredValuesOf(event: Pick<ProductionEventView, 'declaredFigures'>): DeclaredValues {
  const figures = event.declaredFigures;
  if (!figures) return EMPTY_DECLARED;
  return {
    declaredPlanned: text(figures.planned),
    declaredActual: text(figures.actual),
    declaredShortfall: text(figures.shortfall),
    declaredStatus: figures.sourceStatus ?? '',
  };
}

const isNumber = (value: string) => value.trim() !== '' && Number.isFinite(Number(value));

/** Request-shape checks of a production loss: a shortfall, numeric figures; the server decides whether they agree. */
export function declaredErrors(values: DeclaredValues & { physicalType: string; intervalMode: string; endLocal: string }): Partial<Record<DeclaredField | 'endLocal', string>> {
  const errors: Partial<Record<DeclaredField | 'endLocal', string>> = {};
  if (values.physicalType !== PRODUCTION_LOSS) return errors;
  if (!isNumber(values.declaredShortfall)) errors.declaredShortfall = 'Enter the shortfall in tonnes';
  if (values.declaredPlanned.trim() && !isNumber(values.declaredPlanned)) errors.declaredPlanned = 'Enter a number of tonnes';
  if (values.declaredActual.trim() && !isNumber(values.declaredActual)) errors.declaredActual = 'Enter a number of tonnes';
  if (values.intervalMode === 'duration' || !values.endLocal) errors.endLocal = 'Enter the end time';
  return errors;
}

/** Not a block: planned - actual differs from the shortfall (beyond rounding), the server flags it for review. */
export function declaredIdentityHint(values: DeclaredValues): string | null {
  if (![values.declaredPlanned, values.declaredActual, values.declaredShortfall].every(isNumber)) return null;
  const gap = Number(values.declaredPlanned) - Number(values.declaredActual) - Number(values.declaredShortfall);
  return Math.abs(gap) > 1e-9 ? 'Planned − actual does not equal the shortfall. The server will flag this for review.' : null;
}

/** The form-owned part of `declaredFigures`; an emptied planned / actual / status is sent as null. */
function figuresOf(values: DeclaredValues): Pick<DeclaredFigures, 'planned' | 'actual' | 'shortfall' | 'sourceStatus'> {
  return {
    planned: values.declaredPlanned.trim() ? Number(values.declaredPlanned) : null,
    actual: values.declaredActual.trim() ? Number(values.declaredActual) : null,
    shortfall: Number(values.declaredShortfall),
    sourceStatus: values.declaredStatus || null,
  };
}

/** Body fields of a new production loss: `declaredFigures` and `quantity` = the shortfall (the server derives it). */
export function declaredCreateFields(values: DeclaredValues & { physicalType: string }): Pick<CreateEventBody, 'declaredFigures' | 'quantity'> {
  if (values.physicalType !== PRODUCTION_LOSS) return {};
  const figures = figuresOf(values);
  return { declaredFigures: figures as unknown as CreateEventBody['declaredFigures'], quantity: String(figures.shortfall) };
}

type PatchBody = PatchEventInput['changes'];

/** A PATCH replaces `declaredFigures`, so the unchanged parts (uom, quality, plan, PI source) are carried over. */
export function declaredPatchFields(initial: DeclaredValues, values: DeclaredValues & { physicalType: string }, event: Pick<ProductionEventView, 'declaredFigures'> | null): Pick<PatchBody, 'declaredFigures'> {
  if (values.physicalType !== PRODUCTION_LOSS || DECLARED_FIELDS.every((field) => values[field] === initial[field])) return {};
  const merged: DeclaredFigures = { uom: 't', measurementQuality: null, plan: null, piSource: null, ...event?.declaredFigures, ...figuresOf(values) };
  return { declaredFigures: merged as unknown as PatchBody['declaredFigures'] };
}
