/** Field readers of the `rca_policy` parser: a malformed value is an error, never a silent default. */
export class RcaPolicyError extends Error {}

export type Raw = Record<string, unknown>;

export function record(value: unknown, field: string): Raw {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new RcaPolicyError(`${field} must be an object`);
  }
  return value as Raw;
}

export function integer(value: unknown, field: string, min = 0): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
    throw new RcaPolicyError(`${field} must be an integer >= ${min}`);
  }
  return value;
}

export function share(value: unknown, field: string): number {
  if (typeof value !== 'number' || !(value > 0) || value > 1) {
    throw new RcaPolicyError(`${field} must be a number in (0, 1]`);
  }
  return value;
}

/** A decimal in [0, 1] (0 and 1 included). */
export function fraction(value: unknown, field: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new RcaPolicyError(`${field} must be a number in [0, 1]`);
  }
  return value;
}

export function nullableNumber(value: unknown, field: string): number | null {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new RcaPolicyError(`${field} must be null or a number >= 0`);
  }
  return value;
}

export function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new RcaPolicyError(`${field} must be one of ${allowed.join(', ')}`);
  }
  return value as T;
}

export function stringList(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new RcaPolicyError(`${field} must be a list of strings`);
  }
  return value as string[];
}

export function listOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T[] {
  return stringList(value, field).map((item) => oneOf(item, allowed, field));
}

/** A section absent from a version written before it existed takes `fallback`; present, it must parse. */
export function section<T>(
  raw: Raw,
  key: string,
  fallback: T,
  parse: (value: Raw) => T,
): T {
  const value = raw[key];
  if (value === undefined) return fallback;
  return parse(record(value, key));
}
