import type { LossBasis } from '@/api/v2/types/loss-accounting';

/** How a period is accounted: per day or per shift, declared by OT or computed. */
export interface PeriodRegime {
  isDay: boolean;
  isDeclared: boolean;
}

/** What a period, day or reconciliation view says of its own regime. */
export interface RegimeFacts {
  isDayGrain?: boolean;
  lossBasis?: LossBasis | null;
}

/**
 * A period's regime from its own view: the grain from its window, the basis from its current run. The policy
 * in force (`inForce`) decides the basis only for a period without a run yet, so a historic shift period
 * keeps its shift wording after the plant moved to daily declared accounting.
 */
export function periodRegime(view: RegimeFacts, inForce: PeriodRegime): PeriodRegime {
  const basis = view.lossBasis ?? null;
  return {
    isDay: view.isDayGrain ?? inForce.isDay,
    isDeclared: basis === null ? inForce.isDeclared : basis === 'declared',
  };
}

/** The grid-wide wording (column header, note): declared or per day only when every listed period is. */
export function listRegime(rows: readonly RegimeFacts[], inForce: PeriodRegime): PeriodRegime {
  if (rows.length === 0) return inForce;
  const regimes = rows.map((row) => periodRegime(row, inForce));
  return { isDay: regimes.every((r) => r.isDay), isDeclared: regimes.every((r) => r.isDeclared) };
}
