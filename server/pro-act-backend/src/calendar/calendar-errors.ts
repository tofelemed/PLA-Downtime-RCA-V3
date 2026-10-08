import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CalendarDefinitionError } from '../domain/calendar/calendar.types';

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

export function conflict(code: string, message: string): ConflictException {
  return new ConflictException({ code, message });
}

/** Runs pure calendar code and turns its definition errors into 422 responses. */
export function asUnprocessable<T>(work: () => T): T {
  try {
    return work();
  } catch (error: unknown) {
    if (error instanceof CalendarDefinitionError) {
      throw invalid(error.code, error.message);
    }
    throw error;
  }
}

/** Postgres exclusion violation (`23P01`): two instances of one unit would overlap. */
export function isExclusionViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const withCode = error as {
    code?: unknown;
    driverError?: { code?: unknown };
  };
  return withCode.code === '23P01' || withCode.driverError?.code === '23P01';
}
