/** A stored workflow policy body that does not have its kind's shape (never guessed around). */
export class WorkflowPolicyError extends Error {}

export type Raw = Record<string, unknown>;

export function record(value: unknown, field: string): Raw {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new WorkflowPolicyError(`${field} must be an object`);
  }
  return value as Raw;
}

export function integer(value: unknown, field: string, min = 0): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
    throw new WorkflowPolicyError(`${field} must be an integer >= ${min}`);
  }
  return value;
}

export function positive(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new WorkflowPolicyError(`${field} must be a number > 0`);
  }
  return value;
}

export function flag(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new WorkflowPolicyError(`${field} must be a boolean`);
  }
  return value;
}

export function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new WorkflowPolicyError(
      `${field} must be one of ${allowed.join(', ')}`,
    );
  }
  return value as T;
}

export function stringList(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new WorkflowPolicyError(`${field} must be a list of strings`);
  }
  return value as string[];
}

/** ISO weekdays 1–7, each once. */
export function weekdays(value: unknown, field: string): number[] {
  if (
    !Array.isArray(value) ||
    value.some((d) => !Number.isInteger(d) || d < 1 || d > 7) ||
    new Set(value).size !== value.length
  ) {
    throw new WorkflowPolicyError(`${field} must list ISO weekdays 1–7 once`);
  }
  return [...(value as number[])].sort((a, b) => a - b);
}
