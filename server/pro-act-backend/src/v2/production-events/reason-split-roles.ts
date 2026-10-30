import { ForbiddenException } from '@nestjs/common';
import { satisfiesRole } from '../../auth/roles/role-model';
import { RequestContext } from '../../common/context/request-context';
import { isWeighted, ReasonWeight } from '../../domain/events/reason-weights';

/**
 * Owner decision 2026-10-30 (D-T5 follow-up, ISO 14224 practice): the operator records one reason at the
 * console; a split of a stop or a production loss across several reasons — and the removal of a stored
 * split — is review work of the production engineer, the reliability engineer or the manager approver.
 * SuperAdmin / OrgAdmin satisfy every role. The UI mirrors this list (`src/features/auth/server-role-sets.ts`).
 */
export const REASON_SPLITTERS = [
  'production_engineer',
  'reliability_engineer',
  'manager_approver',
] as const;

export const REASON_SPLIT_ROLE_MESSAGE =
  'A split across several reasons is entered or removed by a production engineer, reliability engineer or manager approver; an operator records one reason';

export function maySplitReasons(context: RequestContext): boolean {
  return REASON_SPLITTERS.some((role) => satisfiesRole(context.roles, role));
}

/**
 * Whether a write's normalised reason columns set a split (two or more reasons) or remove the stored one.
 * A single reason is never a split, so `null` on an unsplit event changes nothing.
 */
export function changesSplit(
  stored: readonly ReasonWeight[] | null | undefined,
  written: readonly ReasonWeight[] | null | undefined,
): boolean {
  if (written === undefined) return false;
  return written === null ? isWeighted(stored) : isWeighted(written);
}

/** 403 REASON_SPLIT_ROLE when the write changes a split and the caller may not split reasons. */
export function assertMaySplitReasons(
  context: RequestContext,
  stored: readonly ReasonWeight[] | null | undefined,
  written: readonly ReasonWeight[] | null | undefined,
): void {
  if (!changesSplit(stored, written) || maySplitReasons(context)) return;
  throw new ForbiddenException({
    code: 'REASON_SPLIT_ROLE',
    message: REASON_SPLIT_ROLE_MESSAGE,
  });
}
