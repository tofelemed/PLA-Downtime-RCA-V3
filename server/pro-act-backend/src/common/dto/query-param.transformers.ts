import { TransformFnParams } from 'class-transformer';

/**
 * Query-string booleans: with `enableImplicitConversion`, `Boolean('false') === true`, so the raw
 * value must be read from the source object instead of the already-converted one.
 */
export function toBooleanParam({ obj, key }: TransformFnParams): unknown {
  const raw = (obj as Record<string, unknown>)[key];
  if (raw === true || raw === 'true' || raw === '1') {
    return true;
  }
  if (raw === false || raw === 'false' || raw === '0') {
    return false;
  }
  return raw;
}

/** Repeated params (`?unitIds=a&unitIds=b`) arrive as an array; a single `?unitIds=a` as a string. */
export function toArrayParam({ value }: TransformFnParams): unknown {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return Array.isArray(value) ? value : [value];
}
