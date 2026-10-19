import type { GridWorkflowState, ResidualState, RevisionSelector } from '@/api/v2/types/period-overview';
import { datesFromRange } from '@/features/ux-kit/date-inputs';
import { startOfPlantDayUtc } from '@/lib/dates';
import type { PlanWindow } from './period-neighbours';

export const GRID_STATES: readonly GridWorkflowState[] = ['none', 'draft', 'in_review', 'stale', 'approved'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Residual filters of the grid (UX D-5): `residual=unaccounted` or `residual=above` in the URL. */
export const RESIDUAL_FILTERS = {
  unaccounted: { label: 'Unaccounted only', states: ['unaccounted'] },
  above: { label: 'Above tolerance (unaccounted, over-accounted, conflict)', states: ['unaccounted', 'over_accounted', 'conflict'] },
} as const satisfies Record<string, { label: string; states: readonly ResidualState[] }>;

export type ResidualFilter = keyof typeof RESIDUAL_FILTERS;
export type GridParamKey = 'state' | 'date' | 'residual' | 'view';

const isResidualFilter = (value: string): value is ResidualFilter => Object.prototype.hasOwnProperty.call(RESIDUAL_FILTERS, value);

/** The server's `residualStates` of a residual filter (none = unfiltered). */
export function residualStatesOf(filter: ResidualFilter | ''): ResidualState[] {
  return filter ? [...RESIDUAL_FILTERS[filter].states] : [];
}

/**
 * The grid's URL filters: `state` (workflow state of the shown revision), `date` (go to a plant date) and
 * `residual` (plan-ledger residual state of the shown revision) and `view=approved` ("Figures of" the
 * approved revision only; absent = the current revision), so a reload or a shared link keeps them all.
 */
export interface GridParams {
  workflow: GridWorkflowState | '';
  date: string;
  residual: ResidualFilter | '';
  view: RevisionSelector;
}

export function parseGridParams(search: URLSearchParams): GridParams {
  const state = search.get('state') ?? '';
  const date = search.get('date') ?? '';
  const residual = search.get('residual') ?? '';
  return {
    workflow: (GRID_STATES as readonly string[]).includes(state) ? (state as GridWorkflowState) : '',
    date: DATE.test(date) ? date : '',
    residual: isResidualFilter(residual) ? residual : '',
    view: search.get('view') === 'approved' ? 'approved' : 'current',
  };
}

/** One filter changed, every other parameter (e.g. the page's tab) kept; an empty value removes it. */
export function withGridParam(search: URLSearchParams, key: GridParamKey, value: string): URLSearchParams {
  const next = new URLSearchParams(search);
  if (value) next.set(key, value);
  else next.delete(key);
  return next;
}

/** The plan window as inclusive plant dates, for the date field's bounds. */
export function planDateBounds(plan: PlanWindow, timeZone: string): { min: string; max: string } {
  const { start, end } = datesFromRange(plan, timeZone);
  return { min: start, max: end };
}

/**
 * "Go to date" outside the plan window (e.g. an old `?date=` link): the grid shows the plan from its start,
 * and says so. `toText` writes an ISO date in the plant calendar. Null when the date is empty or inside.
 */
export function outsidePlanMessage(date: string, bounds: { min: string; max: string }, toText: (isoDate: string) => string): string | null {
  if (!date || !bounds.min || !bounds.max) return null;
  if (date >= bounds.min && date <= bounds.max) return null;
  return `${toText(date)} is outside this plan (${toText(bounds.min)} – ${toText(bounds.max)}): showing it from the plan start.`;
}

/**
 * The server window of the grid: the plan window, or — with "Go to date" — from 00:00 plant time of that
 * date to the plan end, so the first page starts at the period containing it (server overlap semantics).
 * A date outside the plan keeps the plan window.
 */
export function gridWindow(plan: PlanWindow, date: string, timeZone: string): PlanWindow {
  const start = date ? startOfPlantDayUtc(date, timeZone) : null;
  if (!start) return plan;
  const at = Date.parse(start);
  if (at >= Date.parse(plan.to)) return plan;
  return at <= Date.parse(plan.from) ? plan : { from: start, to: plan.to };
}
