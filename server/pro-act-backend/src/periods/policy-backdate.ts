import { ConflictException } from '@nestjs/common';
import { invalid } from '../profiles/profile-errors';

/**
 * Commissioning backdate (owner, 18 Oct 2026, DECISIONS "Marun HDPE training plant"): a policy version
 * that otherwise takes effect at approval / record time may state an effective-from in the past, with a
 * reason, while no calculated period of its scope overlaps [effectiveFrom, now). Approved history is never
 * rewritten: the instant must follow every approved version of the same scope.
 */
export interface BackdateRequest {
  effectiveFrom?: string;
  backdateReason?: string;
}

export interface Backdate {
  effectiveFrom: Date;
  reason: string;
}

/** A period whose figures were calculated (calculation run or approved revision) inside the range. */
export interface CalculatedPeriod {
  periodId: string;
  unitId: string;
  unitName: string;
  localDate: string;
  shiftName: string | null;
  utcStart: Date;
  utcEnd: Date;
}

/**
 * The requested backdate, or null when the version takes effect now (no `effectiveFrom`).
 * 422 INVALID_EFFECTIVE_FROM (not a past instant), BACKDATE_REASON_REQUIRED, BACKDATE_REASON_WITHOUT_EFFECTIVE_FROM.
 */
export function parseBackdate(
  request: BackdateRequest,
  now: Date,
): Backdate | null {
  const reason = request.backdateReason?.trim() ?? '';
  if (request.effectiveFrom === undefined) {
    if (reason) {
      throw invalid(
        'BACKDATE_REASON_WITHOUT_EFFECTIVE_FROM',
        'backdateReason is only stated with a past effectiveFrom',
      );
    }
    return null;
  }
  const effectiveFrom = new Date(request.effectiveFrom);
  if (Number.isNaN(effectiveFrom.getTime())) {
    throw invalid('INVALID_EFFECTIVE_FROM', 'effectiveFrom is not an instant');
  }
  if (effectiveFrom.getTime() >= now.getTime()) {
    throw invalid(
      'INVALID_EFFECTIVE_FROM',
      'effectiveFrom must be in the past (commissioning backdate); leave it empty to take effect now',
    );
  }
  if (!reason) {
    throw invalid(
      'BACKDATE_REASON_REQUIRED',
      'a reason is required to backdate a policy version',
    );
  }
  return { effectiveFrom, reason };
}

/** 409 BACKDATE_REWRITES_HISTORY unless the instant follows the latest approved version of the scope. */
export function assertAfterApprovedHistory(
  latestApprovedFrom: Date | null,
  backdate: Backdate,
): void {
  if (!latestApprovedFrom) return;
  if (backdate.effectiveFrom.getTime() > latestApprovedFrom.getTime()) return;
  throw new ConflictException({
    code: 'BACKDATE_REWRITES_HISTORY',
    message: `effectiveFrom must be after ${latestApprovedFrom.toISOString()}, when the latest approved version of this scope took effect`,
    details: { latestEffectiveFrom: latestApprovedFrom.toISOString() },
  });
}

const periodLabel = (period: CalculatedPeriod): string =>
  `${period.unitName} ${period.localDate}${period.shiftName ? ` ${period.shiftName}` : ''}`;

/** 409 BACKDATE_OVERLAPS_CALCULATION naming the calculated periods (the first page of them). */
export function backdateOverlapsCalculation(
  periods: readonly CalculatedPeriod[],
  total: number,
): ConflictException {
  return overlapConflict('BACKDATE_OVERLAPS_CALCULATION', periods, total, {
    what: 'calculated period(s)',
    rule: 'a version cannot be backdated over figures already calculated',
  });
}

/**
 * 409 BACKDATE_OVERLAPS_APPROVED_VALUE (valuation policy, owner 18 Oct 2026): approved figures of the plant
 * lie in the range; they are revalued only through change proposals (`restateApproved`), never silently.
 */
export function backdateOverlapsApprovedValue(
  periods: readonly CalculatedPeriod[],
  total: number,
): ConflictException {
  return overlapConflict('BACKDATE_OVERLAPS_APPROVED_VALUE', periods, total, {
    what: 'period(s) with approved figures',
    rule: 'approved figures are never revalued silently; state restateApproved to open a change proposal for each of them',
  });
}

function overlapConflict(
  code: string,
  periods: readonly CalculatedPeriod[],
  total: number,
  text: { what: string; rule: string },
): ConflictException {
  const more =
    total > periods.length ? ` and ${total - periods.length} more` : '';
  return new ConflictException({
    code,
    message:
      `effectiveFrom overlaps ${total} ${text.what}: ${periods.map(periodLabel).join(', ')}${more}; ` +
      text.rule,
    details: {
      total,
      periods: periods.map((period) => ({
        periodId: period.periodId,
        unitId: period.unitId,
        unitName: period.unitName,
        localDate: period.localDate,
        shiftName: period.shiftName,
        utcStart: period.utcStart.toISOString(),
        utcEnd: period.utcEnd.toISOString(),
      })),
    },
  });
}
