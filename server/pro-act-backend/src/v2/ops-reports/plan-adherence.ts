import { EntityManager } from 'typeorm';
import { Dec, formatDec, toDec, ZERO } from '../../domain/actuals/decimal';
import { AnalyticsResponse } from '../common/response';
import { ReportScope } from '../reports/report-scope';
import {
  productionByProduct,
  ProductionRowView,
  ratio,
} from './production-by-product';

/** How one product (grade) kept to its plan over the window's plant days (R11). */
export interface PlanAdherenceRowView {
  productId: string | null;
  productCode: string | null;
  productName: string | null;
  uom: string | null;
  /** days with a plan target, run on such a day, planned but not run, run without a plan target */
  plannedDays: number;
  ranAsPlannedDays: number;
  missedDays: number;
  unplannedDays: number;
  target: string;
  actual: string;
  /** Σ actual / Σ target */
  attainment: string | null;
  /** Σ min(actual, target) per day / Σ target: overproduction on one day never makes up for another */
  volumeAdherence: string | null;
  /** ranAsPlannedDays / plannedDays */
  dayAdherence: string | null;
}

export interface PlanAdherenceView {
  rows: PlanAdherenceRowView[];
  calculationRunIds: string[];
}

const positive = (value: string | null) => {
  const d = toDec(value);
  return d !== null && d.gt(0) ? d : null;
};

function adherenceOf(days: readonly ProductionRowView[]): PlanAdherenceRowView {
  let target = ZERO;
  let actual = ZERO;
  let capped = ZERO;
  const count = { planned: 0, ran: 0, missed: 0, unplanned: 0 };
  for (const day of days) {
    const t = positive(day.target);
    const a = positive(day.actual);
    if (t) target = target.plus(t);
    if (a) actual = actual.plus(a);
    if (t) {
      count.planned += 1;
      if (a) count.ran += 1;
      else count.missed += 1;
      if (a) capped = capped.plus(Dec.min(a, t));
    } else if (a) count.unplanned += 1;
  }
  const first = days[0];
  const targetText = formatDec(target);
  return {
    productId: first.productId,
    productCode: first.productCode,
    productName: first.productName,
    uom: first.uom,
    plannedDays: count.planned,
    ranAsPlannedDays: count.ran,
    missedDays: count.missed,
    unplannedDays: count.unplanned,
    target: targetText,
    actual: formatDec(actual),
    attainment: ratio(formatDec(actual), targetText),
    volumeAdherence: ratio(formatDec(capped), targetText),
    dayAdherence:
      count.planned === 0
        ? null
        : formatDec(new Dec(count.ran).div(count.planned)),
  };
}

/** Day rows grouped per product and unit of measure, in the server's product order. */
export function planAdherence(
  days: readonly ProductionRowView[],
): PlanAdherenceRowView[] {
  const byProduct = new Map<string, ProductionRowView[]>();
  for (const day of days) {
    const key = `${day.productId ?? '-'}|${day.uom ?? '-'}`;
    byProduct.set(key, [...(byProduct.get(key) ?? []), day]);
  }
  return [...byProduct.values()]
    .map(adherenceOf)
    .sort((a, b) => (a.productCode ?? '~').localeCompare(b.productCode ?? '~'));
}

/**
 * `GET /reports/plan-adherence` (R11): per product (grade), whether it ran on the plant days the plan gave
 * it a target and how much of the target it met — attainment, volume adherence capped per day, and day
 * adherence — from the per-day production of the shown runs (plan ledger target and actual).
 */
export async function planAdherenceReport(
  manager: EntityManager,
  scope: ReportScope,
): Promise<AnalyticsResponse<PlanAdherenceView>> {
  const daily = await productionByProduct(manager, scope, 'day');
  return {
    ...daily,
    data: {
      rows: planAdherence(daily.data.rows),
      calculationRunIds: daily.data.calculationRunIds,
    },
  };
}
