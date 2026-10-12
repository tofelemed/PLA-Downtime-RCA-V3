/** Tolerant readers of the JSON text columns of `rcas` (v1 and v2 shapes; unknown values become null). */
export type Raw = Record<string, unknown>;

export const text = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0
    ? value
    : typeof value === 'number'
      ? String(value)
      : null;

export const bool = (value: unknown): boolean | null =>
  typeof value === 'boolean' ? value : null;

/** A decimal as text (`"1250.5"`): numbers and numeric strings; anything else is null. */
export function decimalText(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value.trim()))
    return value.trim();
  return null;
}

export function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is string =>
          typeof entry === 'string' && entry.length > 0,
      )
    : [];
}

function parse(stored: unknown): unknown {
  if (typeof stored !== 'string') return stored;
  try {
    return JSON.parse(stored) as unknown;
  } catch {
    return null;
  }
}

const isRaw = (value: unknown): value is Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function parseArray(stored: unknown): Raw[] {
  const value = parse(stored);
  return Array.isArray(value) ? value.filter(isRaw) : [];
}

export function parseObject(stored: unknown): Raw | null {
  const value = parse(stored);
  return isRaw(value) ? value : null;
}

export function readIds(stored: unknown): string[] {
  return strings(parse(stored));
}
