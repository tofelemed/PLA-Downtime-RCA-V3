import { EntityManager } from 'typeorm';
import { Dec, formatDec } from '../../domain/actuals/decimal';
import {
  CalendarBasisTerms,
  calendarBasisTerms,
  sumTerms,
} from '../../domain/kpi/calendar-basis';
import {
  calendarBasisKpis,
  CalendarKpi,
  CalendarMetric,
} from '../../domain/kpi/calendar-basis-kpis';
import { CalendarDay, calendarDays } from '../../domain/kpi/calendar-days';
import { KpiUnit } from '../../domain/kpi/kpi.types';
import { BoundedInterval } from '../../domain/time/interval-algebra';
import {
  calculatedPeriods,
  CalendarStopInputs,
  loadCalendarPolicies,
  loadCalendarStops,
  loadPlantDay,
  UnitCalendarPolicy,
  unitNames,
} from './calendar-basis-sql';
import { ReportScope } from './report-scope';

export const CALENDAR_BASIS_LABEL =
  'Calendar basis — no plan or calendar for these units/days';

/** Why the calendar basis was not computed: a filter only calculated periods can answer. */
export type CalendarOmission =
  | 'approved_only'
  | 'period_selection'
  | 'schedule_class';

export interface CalendarKpiView {
  metric: CalendarMetric;
  basis: 'calendar';
  numerator: string | null;
  denominator: string | null;
  value: string | null;
  unit: KpiUnit;
  quality: 'ok' | 'unavailable';
  reason: string | null;
  cohort: Record<string, string>;
  /** production days behind the value */
  rows: number;
  missing: number;
}

export interface CalendarBasisDayView {
  /** operational date of the production day */
  localDate: string;
  /** the day's calendar time inside the window (UTC, half-open) */
  from: string;
  to: string;
}

export interface CalendarBasisUnitView {
  unitId: string;
  unitName: string | null;
  /** `default`: no `oee_policy` stored for the unit, the D04 defaults applied (micro-stop 60 s, first-out) */
  policy: 'stored' | 'default';
  days: CalendarBasisDayView[];
  kpis: CalendarKpiView[];
}

/**
 * Plan 2.3: downtime KPIs of the units/days of the window without a calculation run, from the stops over
 * calendar time. A separate section: never added into the run-based summary.
 */
export interface CalendarBasisView {
  basis: 'calendar';
  label: string;
  timezone: string;
  operationalDayStart: string;
  /** null = computed; otherwise the filter that only calculated periods can answer (no units listed) */
  omitted: CalendarOmission | null;
  units: CalendarBasisUnitView[];
  /** Σ terms of every listed unit, ratios taken after summing */
  total: CalendarKpiView[];
}

const text = (value: Dec | null) => (value === null ? null : formatDec(value));

function kpiView(kpi: CalendarKpi, rows: number): CalendarKpiView {
  return {
    metric: kpi.metric,
    basis: 'calendar',
    numerator: text(kpi.numerator),
    denominator: text(kpi.denominator),
    value: text(kpi.value),
    unit: kpi.unit,
    quality: kpi.value === null ? 'unavailable' : 'ok',
    reason: kpi.reason,
    cohort: kpi.cohort,
    rows,
    missing: 0,
  };
}

function omissionOf(
  scope: ReportScope,
  scheduleClass: string | null,
): CalendarOmission | null {
  if (scope.approvedOnly) return 'approved_only';
  if (scope.selection) return 'period_selection';
  return scheduleClass ? 'schedule_class' : null;
}

const overlaps = (a: BoundedInterval, b: BoundedInterval) =>
  a.start < b.end && b.start < a.end;

/** The unit's production days that no shown calculated period overlaps (a partly calculated day stays run-based). */
async function uncoveredDays(
  manager: EntityManager,
  scope: ReportScope,
  days: readonly CalendarDay[],
): Promise<Map<string, CalendarDay[]>> {
  const calculated = await calculatedPeriods(manager, {
    tenantId: scope.tenantId,
    unitIds: scope.unitIds,
    window: { start: scope.from, end: scope.to },
  });
  const byUnit = new Map<string, CalendarDay[]>();
  for (const unitId of scope.unitIds) {
    const covered = calculated.get(unitId) ?? [];
    const open = days.filter((day) => !covered.some((p) => overlaps(p, day)));
    if (open.length > 0) byUnit.set(unitId, open);
  }
  return byUnit;
}

function unitTerms(
  stops: CalendarStopInputs,
  unit: UnitCalendarPolicy & { days: CalendarDay[]; asOf: Date },
): CalendarBasisTerms {
  const events = stops.events.get(unit.unitId) ?? [];
  const own = new Set(events.map((e) => e.occurrenceId));
  return calendarBasisTerms({
    days: unit.days,
    asOf: unit.asOf,
    events,
    occurrences: stops.occurrences.filter((o) => own.has(o.occurrenceId)),
    failures: stops.failures.get(unit.unitId) ?? [],
    policy: unit.policy,
  });
}

const dayView = (day: CalendarDay): CalendarBasisDayView => ({
  localDate: day.localDate,
  from: day.start.toISOString(),
  to: day.end.toISOString(),
});

function kpis(terms: CalendarBasisTerms, rows: number): CalendarKpiView[] {
  return calendarBasisKpis(terms).map((kpi) => kpiView(kpi, rows));
}

interface UnitResult {
  unitId: string;
  days: CalendarDay[];
  terms: CalendarBasisTerms;
  stored: boolean;
}

/** Stops, policies and terms of the units with open days (a fixed number of queries, whatever the unit count). */
async function unitResults(
  manager: EntityManager,
  scope: ReportScope,
  open: ReadonlyMap<string, CalendarDay[]>,
  window: BoundedInterval & { asOf: Date },
): Promise<UnitResult[]> {
  const unitIds = [...open.keys()];
  const key = { tenantId: scope.tenantId, unitIds, window };
  const stops = await loadCalendarStops(manager, key);
  const policies = await loadCalendarPolicies(manager, {
    ...key,
    at: window.start,
  });
  return policies.map((unit) => {
    const days = open.get(unit.unitId) ?? [];
    return {
      unitId: unit.unitId,
      days,
      terms: unitTerms(stops, { ...unit, days, asOf: window.asOf }),
      stored: unit.stored,
    };
  });
}

/**
 * Plan 2.3 calendar basis of a downtime report scope: production days (plant timezone, operational day
 * start, clipped to the window and to now) of each unit that no shown calculated period overlaps, with
 * calendar availability, downtime, unplanned downtime, stop count and MTBF from the stops (pure domain
 * functions). Filters only calculated periods carry (approved only, products / shifts / crews, schedule
 * class) leave it out with the reason.
 */
export async function calendarBasisOf(
  manager: EntityManager,
  scope: ReportScope,
  scheduleClass: string | null,
  asOf: Date = new Date(),
): Promise<CalendarBasisView> {
  const plantDay = await loadPlantDay(manager, scope.tenantId);
  const omitted = omissionOf(scope, scheduleClass);
  const end = scope.to < asOf ? scope.to : asOf;
  const days = calendarDays(
    { start: scope.from, end },
    plantDay.timezone,
    plantDay.dayStart,
  );
  const open =
    omitted || days.length === 0
      ? new Map<string, CalendarDay[]>()
      : await uncoveredDays(manager, scope, days);
  const results =
    open.size === 0
      ? []
      : await unitResults(manager, scope, open, {
          start: scope.from,
          end,
          asOf,
        });
  const names = await unitNames(manager, scope.tenantId, [...open.keys()]);
  return {
    basis: 'calendar',
    label: CALENDAR_BASIS_LABEL,
    timezone: plantDay.timezone,
    operationalDayStart: plantDay.dayStart,
    omitted,
    ...resultViews(results, names),
  };
}

/** Per-unit views and the total (Σ terms of every unit, ratios after summing). */
function resultViews(
  results: readonly UnitResult[],
  names: ReadonlyMap<string, string>,
): Pick<CalendarBasisView, 'units' | 'total'> {
  return {
    units: results.map((r) => ({
      unitId: r.unitId,
      unitName: names.get(r.unitId) ?? null,
      policy: r.stored ? 'stored' : 'default',
      days: r.days.map(dayView),
      kpis: kpis(r.terms, r.days.length),
    })),
    total: kpis(
      sumTerms(results.map((r) => r.terms)),
      results.reduce((n, r) => n + r.days.length, 0),
    ),
  };
}
