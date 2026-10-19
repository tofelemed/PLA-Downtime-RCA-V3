/** The server's code pattern (`code-v2.dto.ts`): a letter or digit first, then letters, digits and . _ : - (≤ 50). */
const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,49}$/;

export interface NewCodeErrors {
  code?: string;
}

/**
 * Inline checks of the new-code dialog (QA L7): the pattern and a duplicate among the codes already
 * loaded for the library. The server stays authoritative (409 for a duplicate it knows of).
 */
export function newCodeErrors(code: string, existing: readonly string[]): NewCodeErrors {
  const errors: NewCodeErrors = {};
  const trimmed = code.trim();
  if (trimmed !== '' && !CODE_PATTERN.test(trimmed)) errors.code = 'Use letters, digits and . _ : - only, starting with a letter or digit (at most 50).';
  else if (trimmed !== '' && existing.includes(trimmed)) errors.code = `${trimmed} already exists in this library.`;
  return errors;
}

/** Why Create is disabled, or null when it can be pressed. */
export function createDisabledReason(code: string, name: string, errors: NewCodeErrors): string | null {
  if (code.trim() === '' && name.trim() === '') return 'Enter a code and a name.';
  if (code.trim() === '') return 'Enter a code.';
  if (errors.code) return 'Fix the code first.';
  if (name.trim() === '') return 'Enter a name.';
  return null;
}
