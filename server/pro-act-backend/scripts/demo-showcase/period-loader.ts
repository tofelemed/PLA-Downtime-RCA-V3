/**
 * The production periods of a showcase unit with their plan targets: the periods list (shift, slices)
 * joined to the plan periods of the plans' current versions (target, planning capacity).
 */
import { PersonaSession } from './showcase-client';
import { iso } from './showcase-window';

export interface PeriodRow {
  id: string;
  unitId: string;
  utcStart: string;
  utcEnd: string;
  localDate: string;
  shiftName: string | null;
  isExcluded: boolean;
  slices: Array<{ id: string; planPeriodId: string | null; productId: string }>;
}

interface PlanPeriodRow {
  id: string;
  target: string | null;
  planningCapacityQty: string | null;
  scheduledSeconds: number;
}

interface PlanRow {
  id: string;
  currentVersion: number;
}

export interface LoadedPeriod extends PeriodRow {
  start: number;
  end: number;
  /** Σ slice targets (t); 0 when nothing is planned */
  target: number;
  /** planning rate (t/h) of the period's first planned slice */
  planningRate: number;
}

export async function loadPeriods(
  session: PersonaSession,
  unitId: string,
  from: number,
  to: number,
): Promise<LoadedPeriod[]> {
  const plans = await session.listAll<PlanRow>('/v2/production-plans', {
    unitId,
  });
  const planPeriods = new Map<string, PlanPeriodRow>();
  for (const plan of plans) {
    const rows = await session.listAll<PlanPeriodRow>(
      `/v2/production-plans/${plan.id}/versions/${plan.currentVersion}/periods`,
    );
    rows.forEach((row) => planPeriods.set(row.id, row));
  }
  const periods = await session.listAll<PeriodRow>('/v2/production-periods', {
    unitIds: unitId,
    from: iso(from),
    to: iso(to),
  });
  return periods
    .map((period) => withTarget(period, planPeriods))
    .filter((p) => p.start >= from && p.start < to)
    .sort((a, b) => a.start - b.start);
}

function withTarget(
  period: PeriodRow,
  planPeriods: Map<string, PlanPeriodRow>,
): LoadedPeriod {
  let target = 0;
  let planningRate = 0;
  for (const slice of period.slices) {
    const planned = slice.planPeriodId
      ? planPeriods.get(slice.planPeriodId)
      : undefined;
    if (!planned) continue;
    target += Number(planned.target ?? 0);
    const hours = planned.scheduledSeconds / 3600;
    if (!planningRate && hours > 0)
      planningRate = Number(planned.planningCapacityQty ?? 0) / hours;
  }
  return {
    ...period,
    start: Date.parse(period.utcStart),
    end: Date.parse(period.utcEnd),
    target,
    planningRate,
  };
}
