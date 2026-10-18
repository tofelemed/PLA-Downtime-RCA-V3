import { V2ApiError } from '@/api/v2/errors';
import { fieldReason, type FieldVocabulary } from '@/features/ux-kit/errors';

/** Field name (as the API names it) → message shown under that input. */
export type FieldErrors = Record<string, string>;

/**
 * The 422 field errors of a refused command keyed by field, so they land on the same inputs — as a sentence
 * without the field name, enum choices with the form's labels (`fields`), else humanized.
 */
export function serverFieldErrors(error: unknown, fields?: FieldVocabulary): FieldErrors {
  if (!(error instanceof V2ApiError)) return {};
  return Object.fromEntries(
    Object.entries(error.fieldErrorMap()).map(([field, message]) => [field, fieldReason(field, message, fields)]),
  );
}

/** A half-open validity: a start is required and an end, when given, must follow it (ISO UTC instants). */
export function validityErrors(from: string | null, to: string | null): FieldErrors {
  const errors: FieldErrors = {};
  if (!from) errors.effectiveFrom = 'Enter the date and time it starts.';
  if (from && to && Date.parse(to) <= Date.parse(from)) errors.effectiveTo = 'The end must be after the start.';
  return errors;
}
