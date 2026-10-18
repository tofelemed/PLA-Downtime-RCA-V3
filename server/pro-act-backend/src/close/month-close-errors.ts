import {
  ConflictException,
  ForbiddenException,
  HttpException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MonthCloseRefusal } from '../domain/close/month-close-machine';
import { ClosePrerequisites } from './month-coverage';

const MESSAGES: Readonly<Record<MonthCloseRefusal, string>> = {
  INVALID_TRANSITION: 'the month is not in a state that allows this step',
  CLOSE_PREREQUISITES:
    'every scheduled period of the month must exist and be approved, every production day certified (when the policy requires it) and no change proposal open',
  SEPARATION_OF_DUTIES:
    'finance signs off independently of the quantity close and of the materiality review',
  MATERIALITY_REVIEW_REQUIRED:
    'the month reaches a materiality threshold; the extra review comes before the finance sign-off',
  MATERIALITY_REVIEW_NOT_REQUIRED:
    'the month reaches no materiality threshold; no extra review is needed',
};

/** A refused month close step as the API error (403 segregation, 422 prerequisites, 409 otherwise). */
export function monthCloseRefused(
  refusal: MonthCloseRefusal,
  state: string,
  prerequisites: ClosePrerequisites,
): HttpException {
  const body = { code: refusal, message: MESSAGES[refusal] };
  if (refusal === 'SEPARATION_OF_DUTIES') return new ForbiddenException(body);
  if (refusal === 'CLOSE_PREREQUISITES') {
    return new UnprocessableEntityException({
      ...body,
      details: {
        pendingCount: prerequisites.pendingCount,
        pending: prerequisites.pending,
        uncertifiedDays: prerequisites.uncertifiedDays,
        missingPeriodCount: prerequisites.missingPeriodCount,
        missingPeriods: prerequisites.missingPeriods,
        openProposalCount: prerequisites.openProposalCount,
        openProposals: prerequisites.openProposals,
      },
    });
  }
  return new ConflictException({ ...body, details: { state } });
}

/**
 * 422 MONTH_NOT_ENDED: quantities are closed only after the month is over in the plant time zone (its last
 * local date and its last shift ended), whatever the state of its periods.
 */
export function monthNotEnded(
  monthKey: string,
  endsAt: Date,
): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code: 'MONTH_NOT_ENDED',
    message: `${monthKey} has not ended: its quantities can be closed from ${endsAt.toISOString()}`,
    details: { monthEndsAt: endsAt.toISOString() },
  });
}

/** 403 MATERIALITY_REVIEWER: the caller holds none of the policy's reviewer roles. */
export function notMaterialityReviewer(
  roles: readonly string[],
): ForbiddenException {
  return new ForbiddenException({
    code: 'MATERIALITY_REVIEWER',
    message: `the materiality review needs one of the roles ${roles.join(', ')}`,
  });
}
