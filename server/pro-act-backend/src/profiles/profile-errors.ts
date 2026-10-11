import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { VersionRef } from '../domain/profiles/profile.types';
import { RateMathError } from '../domain/profiles/rate-math';

/**
 * 403 `SEPARATION_OF_DUTIES` (D06, owner decision 2026-10-12): the author of a draft version — the user
 * who created it (`createdBy`), whoever edited it afterwards — never approves it, whatever their roles
 * (SuperAdmin included). Rows without an author (system or legacy rows) are not restricted.
 */
export function assertNotAuthor(
  row: { createdBy: string | null },
  approverId: string | null,
  what: string,
): void {
  if (!row.createdBy || row.createdBy !== approverId) return;
  throw new ForbiddenException({
    code: 'SEPARATION_OF_DUTIES',
    message: `${what} drafts are approved by someone other than their author`,
  });
}

/** 422 with a specific code (semantic validation, CONVENTIONS §7). */
export function invalid(
  code: string,
  message: string,
): UnprocessableEntityException {
  return new UnprocessableEntityException({ code, message });
}

/** 422 `INVALID_REFERENCE`: a body id that is not of the acting tenant (no existence leak). */
export function invalidReference(
  field: string,
  what: string,
): UnprocessableEntityException {
  return invalid(
    'INVALID_REFERENCE',
    `${field} is not a ${what} of the tenant`,
  );
}

export function notFound(what: string): NotFoundException {
  return new NotFoundException({
    code: 'NOT_FOUND',
    message: `${what} not found`,
  });
}

export function invalidTransition(
  what: string,
  from: string,
  to: string,
): ConflictException {
  return new ConflictException({
    code: 'INVALID_TRANSITION',
    message: `a ${from} ${what} cannot become ${to}`,
  });
}

/** 409 `VERSION_OVERLAP` naming every approved version the candidate would overlap. */
export function versionOverlap(
  what: string,
  conflicts: readonly VersionRef[],
): ConflictException {
  const versions = conflicts.map((c) => `v${c.version}`).join(', ');
  return new ConflictException({
    code: 'VERSION_OVERLAP',
    message: `the ${what} overlaps approved version(s) ${versions || '(concurrent approval)'}`,
    details: {
      conflicts: conflicts.map((c) => ({
        id: c.id,
        version: c.version,
        effectiveFrom: c.from.toISOString(),
        effectiveTo: c.to ? c.to.toISOString() : null,
      })),
    },
  });
}

/** Postgres exclusion violation (`23P01`): a concurrent approval won the race. */
export function isExclusionViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const withCode = error as {
    code?: unknown;
    driverError?: { code?: unknown };
  };
  return withCode.code === '23P01' || withCode.driverError?.code === '23P01';
}

/** Runs rate arithmetic and turns its errors into 422 responses. */
export function asUnprocessable<T>(work: () => T): T {
  try {
    return work();
  } catch (error: unknown) {
    if (error instanceof RateMathError)
      throw invalid(error.code, error.message);
    throw error;
  }
}
