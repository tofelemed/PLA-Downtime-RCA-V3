/** Typed attribute mapping rules (spec ING04, plan 1.3). */
export const FIELD_VALUE_TYPES = [
  'number',
  'string',
  'bool',
  'digital',
  'duration',
  'timestamp',
] as const;
export type FieldValueType = (typeof FIELD_VALUE_TYPES)[number];

/** `timespan` = `[d.]hh:mm:ss[.fff]` text, the PI TimeSpan form. */
export const DURATION_UNITS = [
  'seconds',
  'minutes',
  'hours',
  'timespan',
] as const;
export type DurationUnit = (typeof DURATION_UNITS)[number];

/** One source attribute → one catalog field. */
export interface FieldRule {
  /** attribute name as the source delivers it (case-sensitive) */
  sourceAttr: string;
  /** further attribute names tried in order when `sourceAttr` is absent */
  aliases?: string[];
  /** a field of the event field catalog */
  targetField: string;
  type: FieldValueType;
  /** required for `duration` rules */
  unit?: DurationUnit;
  required?: boolean;
}

/** Digital state as delivered (PI enumeration value): Name and Value are both kept. */
export type DigitalState = {
  name: string;
  value: string | number | null;
  isSystem: boolean;
};
