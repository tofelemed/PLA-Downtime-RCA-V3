/** The plan version's half-open UTC validity window `[from, to)`. */
export interface PlanWindow {
  from: string;
  to: string;
}

/** The shown period's identity on the server. */
export interface PeriodSpan {
  unitId: string;
  utcStart: string;
  utcEnd: string;
}

/** `GET /period-summaries` parameters (server overlap semantics; ascending `utcStart` unless `sort` says otherwise). */
export interface NeighbourQuery {
  unitIds: string[];
  from: string;
  to: string;
  limit: number;
  sort?: '-utcStart';
}

/**
 * The next period: the first one of the unit overlapping `[utcEnd, plan end)` — the shown period ends at
 * `utcEnd` and so is not part of it (half-open). Null when the period ends at or after the plan end.
 */
export function nextPeriodQuery(period: PeriodSpan, plan: PlanWindow): NeighbourQuery | null {
  if (Date.parse(period.utcEnd) >= Date.parse(plan.to)) return null;
  return { unitIds: [period.unitId], from: period.utcEnd, to: plan.to, limit: 1 };
}

/**
 * The previous period: the latest one of the unit overlapping `[plan start, utcStart)`, newest first
 * (`sort=-utcStart`, one row) — exact however long the gap before the shown period is.
 */
export function previousPeriodQuery(period: PeriodSpan, plan: PlanWindow): NeighbourQuery | null {
  if (Date.parse(period.utcStart) <= Date.parse(plan.from)) return null;
  return { unitIds: [period.unitId], from: plan.from, to: period.utcStart, limit: 1, sort: '-utcStart' };
}

/** The newest row that starts before the shown period (a row overlapping its start is not a neighbour). */
export function latestBefore<T extends { periodId: string; utcStart: string }>(rows: readonly T[], period: PeriodSpan & { periodId: string }): T | null {
  return rows.find((row) => row.periodId !== period.periodId && Date.parse(row.utcStart) < Date.parse(period.utcStart)) ?? null;
}
