import type { CapacityGapQuery, CapacityGapReason, CapacityKindView } from '@/api/v2/types/capacity-gap';
import type { RateKind } from '@/api/v2/types/profiles';
import { formatOperationalDate, startOfPlantDayUtc, type CalendarDisplayOptions } from '@/lib/dates';
import { RATE_KIND_LABELS, RATE_TIMEBASE_LABELS } from '@/features/ux-kit/labels';

/** The capability chain whose steps the server reports gaps for, then the imported references. */
export const CHAIN_KINDS = ['nameplate', 'demonstrated', 'sustained', 'planning'] as const satisfies readonly RateKind[];
export const REFERENCE_KINDS = ['budget', 'forecast'] as const satisfies readonly RateKind[];

/** D-T1 (guide, SME Q16): what each stored kind means; shown as the page's definitions note. */
export const KIND_DEFINITIONS: Readonly<Record<RateKind, string>> = {
  nameplate: 'design reference of the unit',
  demonstrated: 'proven achievable rate',
  sustained: 'approved sustainable capability (capacity ledger)',
  planning: 'time-specific planned rate (plan ledger)',
  budget: 'imported budget reference',
  forecast: 'imported forecast reference',
};

export const NOT_SET = 'not set';

const REASON_TEXT: Readonly<Record<CapacityGapReason, string>> = {
  not_set: NOT_SET,
  uom_mismatch: 'different units (not converted)',
  timebase_mismatch: 'different timebases (not converted)',
  zero_base: 'zero base',
};

export const kindLabel = (kind: RateKind) => RATE_KIND_LABELS[kind];

/** A gap or ratio cell: the server value as is, else why there is none. */
export function reasonText(reason: CapacityGapReason | null): string {
  return reason ? REASON_TEXT[reason] : NOT_SET;
}

/** `150 t per hour`, or "not set" when no approved version is in force. */
export function rateText(view: CapacityKindView): string {
  if (view.value === null) return NOT_SET;
  const uom = view.uom ?? '';
  const per = view.timebase ? RATE_TIMEBASE_LABELS[view.timebase] : '';
  return [view.value, uom, per].filter(Boolean).join(' ');
}

/** The page's own filters, from the URL (`products=a,b`, `asOf=YYYY-MM-DD`). */
export interface CapacityGapFilters {
  productIds: string[];
  /** plant date; '' = now */
  asOf: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseCapacityFilters(params: URLSearchParams): CapacityGapFilters {
  const asOf = params.get('asOf') ?? '';
  return {
    productIds: (params.get('products') ?? '').split(',').filter(Boolean).sort(),
    asOf: ISO_DATE.test(asOf) ? asOf : '',
  };
}

/** The request: rates in force at the start of the chosen plant date (else now), units and products. */
export function capacityGapQueryOf(unitIds: readonly string[], filters: CapacityGapFilters, timeZone: string): CapacityGapQuery {
  const query: CapacityGapQuery = {};
  const at = filters.asOf ? startOfPlantDayUtc(filters.asOf, timeZone) : null;
  if (at) query.at = at;
  if (unitIds.length > 0) query.unitIds = [...unitIds].sort();
  if (filters.productIds.length > 0) query.productIds = filters.productIds;
  return query;
}

/** The page header's instant: `As of 2026-10-19` (plant date in the user's calendar) or `As of now`. */
export function asOfHeaderText(asOf: string, pref: CalendarDisplayOptions): string {
  return `As of ${asOf ? formatOperationalDate(asOf, pref) : 'now'}`;
}
