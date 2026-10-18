import { Backdate, parseBackdate } from '../periods/policy-backdate';
import { invalid } from '../profiles/profile-errors';

/** The backdate fields of a valuation policy write (`ValuationPolicyCreateDto`). */
export interface ValuationBackdateRequest {
  effectiveFrom: string;
  backdateReason?: string;
  restateApproved?: boolean;
}

/** A backdated valuation policy version: the commissioning backdate plus the restatement choice. */
export interface ValuationBackdate extends Backdate {
  /** approved figures in range get a change proposal at approval instead of refusing the version */
  restateApproved: boolean;
}

/**
 * Commissioning backdate of a valuation policy version (owner, 18 Oct 2026, DECISIONS "Marun E2E follow-up
 * decisions" → Valuation basis). `effectiveFrom` is always stated; one before `now` is a backdate and needs
 * a reason (422 BACKDATE_REASON_REQUIRED). A reason or `restateApproved` without a past instant is refused
 * (422 BACKDATE_REASON_WITHOUT_EFFECTIVE_FROM / RESTATE_WITHOUT_BACKDATE). null = not backdated.
 */
export function parseValuationBackdate(
  request: ValuationBackdateRequest,
  now: Date,
): ValuationBackdate | null {
  const instant = new Date(request.effectiveFrom).getTime();
  const past = !Number.isNaN(instant) && instant < now.getTime();
  const backdate = parseBackdate(
    {
      effectiveFrom: past ? request.effectiveFrom : undefined,
      backdateReason: request.backdateReason,
    },
    now,
  );
  if (!backdate) {
    if (request.restateApproved) {
      throw invalid(
        'RESTATE_WITHOUT_BACKDATE',
        'restateApproved is only stated with a past effectiveFrom and a backdateReason',
      );
    }
    return null;
  }
  return { ...backdate, restateApproved: request.restateApproved === true };
}
