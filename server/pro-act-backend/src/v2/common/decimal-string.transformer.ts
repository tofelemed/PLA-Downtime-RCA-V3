import { Transform } from 'class-transformer';
import { ValueTransformer } from 'typeorm';

/**
 * Decimals cross the API as strings (API03) so no precision is lost in JSON. Accepts what the driver
 * hands back: pg returns NUMERIC as text, unless a type parser (as in app.module.ts) turned it into a number.
 */
export function toDecimalString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return null;
}

/** TypeORM column transformer for `numeric` columns on v2 entities: `@Column({ type: 'numeric', transformer: decimalStringTransformer })`. */
export class DecimalStringTransformer implements ValueTransformer {
  to(value: string | number | null | undefined): string | null {
    return toDecimalString(value);
  }

  from(value: unknown): string | null {
    return toDecimalString(value);
  }
}

export const decimalStringTransformer = new DecimalStringTransformer();

/** Serialises a DTO property as a decimal string when the response is converted to plain JSON. */
export const DecimalString = (): PropertyDecorator =>
  Transform(({ value }) => toDecimalString(value), { toPlainOnly: true });
