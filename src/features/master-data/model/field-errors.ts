import { V2ApiError } from '@/api/v2/errors';

/** Messages per form field, e.g. `{ code: 'This code is already used…' }`. */
export type FieldErrors = Partial<Record<string, string>>;

const DECIMAL = /^\d+(\.\d+)?$/;

/** Plain-language text of a refused field; the server's own wording is never shown verbatim. */
function messageOf(error: V2ApiError, field: string): string {
  if (error.code === 'MASTER_DATA_CODE_EXISTS' && field === 'code') {
    return 'This code is already used. Codes must be unique — choose another code.';
  }
  if (field === 'logicTree') return 'The logic tree is too large (500 nodes, 12 levels at most) or repeats a node.';
  if (field === 'checklistIds') return 'Choose active verification checklists only.';
  if (error.code === 'INVALID_REFERENCE') return 'Choose an active entry from the list.';
  if (error.code === 'CODE_CYCLE') return 'A cause cannot be placed under itself or one of its sub-causes.';
  return 'Check this value.';
}

/**
 * The fields a refused write names (422 `fieldErrors`, 409 MASTER_DATA_CODE_EXISTS on `code`), keyed by the
 * form's own field names via `fieldMap` (server field → form field); empty for any other failure.
 */
export function fieldErrorsOf(error: unknown, fieldMap: Readonly<Record<string, string>> = {}): FieldErrors {
  if (!(error instanceof V2ApiError)) return {};
  const result: FieldErrors = {};
  for (const entry of error.fieldErrors) {
    const root = entry.field.split(/[.[]/)[0];
    const field = fieldMap[root] ?? root;
    result[field] = messageOf(error, root);
  }
  return result;
}

/** Required text check: `undefined` when filled. */
export function requiredText(value: string, label: string): string | undefined {
  return value.trim() ? undefined : `${label} is required.`;
}

/** Optional non-negative decimal (legacy numbers): `undefined` when blank or valid. */
export function optionalDecimal(value: string, label: string): string | undefined {
  const text = value.trim();
  if (!text || DECIMAL.test(text)) return undefined;
  return `${label} must be a number of zero or more, e.g. 12.5.`;
}

/** Drops the fields without a message; an empty result means the form is valid. */
export function compactErrors(errors: FieldErrors): FieldErrors {
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => Boolean(message)));
}

/** Blank text → `null` (clears the field on a change). */
export function textOrNull(value: string): string | null {
  const text = value.trim();
  return text ? text : null;
}
