import type { GridWorkflowState, ResidualState } from '@/api/v2/types/period-overview';
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
export type GridParamKey = 'state' | 'date' | 'residual';

const isResidualFilter = (value: string): value is ResidualFilter => Object.prototype.hasOwnProperty.call(RESIDUAL_FILTERS, value);

/** The server's `residualStates` of a residual filter (none = unfiltered). */
export function residualStatesOf(filter: ResidualFilter | ''): ResidualState[] {
  return filter ? [...RESIDUAL_FILTERS[filter].states] : [];
}

/**
 * The grid's URL filters: `state` (workflow state of the shown revision), `date` (go to a plant date) and
 * `residual` (plan-ledger residual state of the shown revision).
 */
export interface GridParams {
  workflow: GridWorkflowState | '';
  date: string;
  residual: ResidualFilter | '';
}

export function parseGridParams(search: URLSearchParams): GridParams {
  const state = search.get('state') ?? '';
  const date = search.get('date') ?? '';
  const residual = search.get('residual') ?? '';
  return {
    workflow: (GRID_STATES as readonly string[]).includes(state) ? (state as GridWorkflowState) : '',
    date: DATE.test(date) ? date : '',
    residual: isResidualFilter(residual) ? residual : '',
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
