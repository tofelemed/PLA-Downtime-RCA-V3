import { UnprocessableEntityException } from '@nestjs/common';

export type SortDirection = 'ASC' | 'DESC';

export interface SortSpec<Field extends string> {
  field: Field;
  direction: SortDirection;
}

/**
 * Parses `field` / `-field` against the resource's allowlist. DTOs already enforce the allowlist with
 * `@IsIn`, so this is a second line of defence that keeps raw user input out of ORDER BY.
 */
export function parseSort<Field extends string>(
  raw: string | undefined,
  allowed: readonly Field[],
  fallback: SortSpec<Field>,
): SortSpec<Field> {
  if (!raw) {
    return fallback;
  }
  const descending = raw.startsWith('-');
  const field = descending ? raw.slice(1) : raw;
  if (!allowed.includes(field as Field)) {
    const message = `sort must be one of: ${allowed.map((name) => `${name}, -${name}`).join(', ')}`;
    throw new UnprocessableEntityException({
      code: 'VALIDATION_FAILED',
      message: [message],
      fieldErrors: [{ field: 'sort', message, constraint: 'isIn' }],
    });
  }
  return { field: field as Field, direction: descending ? 'DESC' : 'ASC' };
}
