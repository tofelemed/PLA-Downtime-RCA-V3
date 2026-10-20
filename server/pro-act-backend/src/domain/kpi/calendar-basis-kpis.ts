import { Dec } from '../actuals/decimal';
import { CalendarBasisTerms } from './calendar-basis';
import { KpiUnit } from './kpi.types';

export const CALENDAR_METRICS = [
  'calendar_availability',
  'downtime_total',
  'downtime_unplanned',
  'stop_count',
  'mtbf',
] as const;
export type CalendarMetric = (typeof CALENDAR_METRICS)[number];

/** One calendar-basis KPI: its terms, the value (null with a reason, never 0 or 100 %) and its definition. */
export interface CalendarKpi {
  metric: CalendarMetric;
  basis: 'calendar';
  numerator: Dec | null;
  denominator: Dec | null;
  value: Dec | null;
  unit: KpiUnit;
  reason: string | null;
  cohort: Record<string, string>;
}

/** Ratios keep 10 decimals and seconds 8, as the stored KPI rows. */
const RATIO_SCALE = 10;
const AMOUNT_SCALE = 8;

function amount(
  metric: CalendarMetric,
  value: Dec,
  unit: KpiUnit,
  cohort: Record<string, string>,
): CalendarKpi {
  return {
    metric,
    basis: 'calendar',
    numerator: value,
    denominator: null,
    value,
    unit,
    reason: null,
    cohort,
  };
}

function ratio(
  metric: CalendarMetric,
  terms: {
    numerator: Dec;
    denominator: Dec;
    unit: KpiUnit;
    zeroReason: string;
  },
  cohort: Record<string, string>,
): CalendarKpi {
  const { numerator, denominator, unit } = terms;
  const zero = denominator.isZero();
  const scale = unit === 'ratio' ? RATIO_SCALE : AMOUNT_SCALE;
  return {
    metric,
    basis: 'calendar',
    numerator,
    denominator,
    value: zero ? null : numerator.div(denominator).toDecimalPlaces(scale),
    unit,
    reason: zero ? terms.zeroReason : null,
    cohort,
  };
}

/**
 * Calendar-basis KPIs from summed terms (plan 2.3). Labelled `calendar availability` — 1 − unplanned
 * downtime ÷ calendar time — never ISO 22400 operational availability (no plan, no schedule). MTBF is the
 * calendar run time over D13 failures; without failures it is null (`no_failures`) and keeps its exposure.
 */
export function calendarBasisKpis(terms: CalendarBasisTerms): CalendarKpi[] {
  const calendar = { denominator: 'calendar_time' };
  return [
    ratio(
      'calendar_availability',
      {
        numerator: terms.calendarSeconds.minus(terms.unplannedSeconds),
        denominator: terms.calendarSeconds,
        unit: 'ratio',
        zeroReason: 'no_calendar_time',
      },
      { label: 'calendar availability', ...calendar },
    ),
    amount('downtime_total', terms.downtimeSeconds, 's', {
      within: 'calendar_time',
    }),
    amount('downtime_unplanned', terms.unplannedSeconds, 's', {
      within: 'calendar_time',
    }),
    amount('stop_count', new Dec(terms.stopCount), 'count', {
      cohort: 'stops_starting_in_window',
    }),
    ratio(
      'mtbf',
      {
        numerator: terms.exposureSeconds,
        denominator: new Dec(terms.failureCount),
        unit: 's',
        zeroReason: 'no_failures',
      },
      { exposureBasis: 'calendar_run_time', failureDefinition: 'D13' },
    ),
  ];
}
