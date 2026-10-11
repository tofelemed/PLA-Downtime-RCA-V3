import { ConflictException } from '@nestjs/common';
import { PlanGenerationError } from '../domain/plans/plan.types';
import { invalid } from '../profiles/profile-errors';

export {
  assertNotAuthor,
  invalid,
  invalidReference,
  invalidTransition,
  isExclusionViolation,
  notFound,
} from '../profiles/profile-errors';

export function conflict(code: string, message: string): ConflictException {
  return new ConflictException({ code, message });
}

/** One approved plan version that a candidate would overlap (PLAN04). */
export interface PlanConflict {
  planId: string;
  version: number;
  productId: string;
  activeFrom: Date;
  activeTo: Date;
}

/** 409 `PLAN_OVERLAP`: another approved version of the scenario plans the same unit and product. */
export function planOverlap(
  conflicts: readonly PlanConflict[],
): ConflictException {
  return new ConflictException({
    code: 'PLAN_OVERLAP',
    message:
      'an approved plan version of this scenario already plans the unit and product in this interval',
    details: {
      conflicts: conflicts.map((c) => ({
        planId: c.planId,
        version: c.version,
        productId: c.productId,
        activeFrom: c.activeFrom.toISOString(),
        activeTo: c.activeTo.toISOString(),
      })),
    },
  });
}

/** Runs pure plan code and turns its refusals into 422 responses. */
export function asUnprocessable<T>(work: () => T): T {
  try {
    return work();
  } catch (error: unknown) {
    if (error instanceof PlanGenerationError) {
      throw invalid(error.code, error.message);
    }
    throw error;
  }
}

/** Postgres unique violation (`23505`). */
export function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const withCode = error as {
    code?: unknown;
    driverError?: { code?: unknown };
  };
  return withCode.code === '23505' || withCode.driverError?.code === '23505';
}
