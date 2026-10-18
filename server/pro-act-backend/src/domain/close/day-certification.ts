import { Dec, formatDec, toDec, ZERO } from '../actuals/decimal';

/** One shift (or daily) period of a production day as certification sees it. */
export interface DayPeriod {
  periodId: string;
  isExcluded: boolean;
  /** latest revision not cancelled: none, draft, in_review, stale, approved */
  workflow: string;
  /** who submitted the approved (or open) revision */
  submittedBy: string | null;
}

/**
 * `open` — some period still needs work; `ready` — every period that needs it is approved; `certified` —
 * one approval certified the day's roll-up (owner decision 14 Oct: day certification, SME R2).
 */
export type DayState = 'open' | 'ready' | 'certified';

/** A period needs approval unless it is excluded from scheduled time and was never reconciled. */
export const needsApproval = (p: DayPeriod) =>
  !(p.isExcluded && p.workflow === 'none');

export function dayState(
  periods: readonly DayPeriod[],
  certified: boolean,
): DayState {
  if (certified) return 'certified';
  const required = periods.filter(needsApproval);
  if (required.length === 0) return 'open';
  return required.every((p) => p.workflow === 'approved') ? 'ready' : 'open';
}

export type CertifyRefusal =
  | 'DAY_CERTIFIED'
  | 'DAY_NOT_READY'
  | 'SEPARATION_OF_DUTIES';

/**
 * Whether `certifier` may certify the day: every period that needs approval approved (no open revision),
 * not certified already, and the certifier submitted none of its shift periods (separation of duties).
 */
export function certifyRefusal(
  certifier: string,
  periods: readonly DayPeriod[],
  certified: boolean,
  isSuperAdmin = false,
): CertifyRefusal | null {
  if (certified) return 'DAY_CERTIFIED';
  if (dayState(periods, false) !== 'ready') return 'DAY_NOT_READY';
  const submitters = periods.filter(needsApproval).map((p) => p.submittedBy);
  if (!isSuperAdmin && submitters.includes(certifier))
    return 'SEPARATION_OF_DUTIES';
  return null;
}

/** Plan-ledger figures of one period (decimal strings, null = unknown). */
export interface PeriodFigures {
  uom: string | null;
  target: string | null;
  actual: string | null;
  gap: string | null;
  attributed: string | null;
  residual: string | null;
}

export interface DayRollup {
  uom: string | null;
  periods: number;
  target: string | null;
  actual: string | null;
  gap: string | null;
  attributed: string | null;
  residual: string | null;
}

type Figure = 'target' | 'actual' | 'gap' | 'attributed' | 'residual';

/**
 * The day's figures rolled up from its shift periods, per unit of measure (SME R2 worked example: shifts of
 * 100, 110 and 90 t make a 300 t day — each quantity is stored once, on its shift, and only summed here);
 * an unknown shift figure leaves the day's figure unknown.
 */
export function dayRollup(periods: readonly PeriodFigures[]): DayRollup[] {
  const byUom = new Map<string, PeriodFigures[]>();
  for (const p of periods) {
    const key = p.uom ?? '';
    byUom.set(key, [...(byUom.get(key) ?? []), p]);
  }
  return [...byUom.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([uom, rows]) => {
      const sum = (f: Figure): string | null => {
        let total: Dec = ZERO;
        for (const row of rows) {
          const value = toDec(row[f]);
          if (value === null) return null;
          total = total.plus(value);
        }
        return formatDec(total);
      };
      return {
        uom: uom === '' ? null : uom,
        periods: rows.length,
        target: sum('target'),
        actual: sum('actual'),
        gap: sum('gap'),
        attributed: sum('attributed'),
        residual: sum('residual'),
      };
    });
}
