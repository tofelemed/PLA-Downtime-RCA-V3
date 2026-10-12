import { V2ApiError } from '@/api/v2/errors';

/** Field name (as the API names it) → message shown under that input. */
export type FieldErrors = Record<string, string>;

/** The 422 field errors of a refused command keyed by field, so they land on the same inputs. */
export function serverFieldErrors(error: unknown): FieldErrors {
  return error instanceof V2ApiError ? error.fieldErrorMap() : {};
}

/** A half-open validity: a start is required and an end, when given, must follow it (ISO UTC instants). */
export function validityErrors(from: string | null, to: string | null): FieldErrors {
  const errors: FieldErrors = {};
  if (!from) errors.effectiveFrom = 'Enter the date and time it starts.';
  if (from && to && Date.parse(to) <= Date.parse(from)) errors.effectiveTo = 'The end must be after the start.';
  return errors;
}
