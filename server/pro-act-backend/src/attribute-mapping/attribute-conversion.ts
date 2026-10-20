import { FactRecord } from '../production-event/revisions/event-facts';
import { DigitalState, DurationUnit, FieldRule } from './field-rule';

/** One problem found while mapping a source record (kept with the source facts, ING04). */
export interface MappingDiagnostic extends FactRecord {
  code: string;
  field: string | null;
  message: string;
}

export type ConvertedValue = string | number | boolean | DigitalState;

export type Conversion =
  | { ok: true; value: ConvertedValue }
  | { ok: false; diagnostic: MappingDiagnostic };

const UNIT_SECONDS: Readonly<
  Record<Exclude<DurationUnit, 'timespan'>, number>
> = { seconds: 1, minutes: 60, hours: 3600 };

/** `[d.]hh:mm:ss[.fff]` (PI TimeSpan text). */
const TIMESPAN = /^(?:(\d+)\.)?(\d{1,2}):(\d{2}):(\d{2}(?:\.\d+)?)$/;

/** Typed conversion of one raw attribute value under `rule` (no `[object Object]`, no NaN). */
export function convertValue(rule: FieldRule, raw: unknown): Conversion {
  const value = unwrap(raw);
  switch (rule.type) {
    case 'number':
      return toNumber(rule, value);
    case 'string':
      return toText(rule, value);
    case 'bool':
      return toBool(rule, value);
    case 'digital':
      return toDigital(rule, value);
    case 'duration':
      return toDurationSeconds(withDeliveredUnit(rule, raw), value);
    case 'timestamp':
      return toTimestamp(rule, value);
  }
}

/** Parses `[d.]hh:mm:ss[.fff]` into seconds; null when the text is not a TimeSpan. */
export function parseTimeSpan(text: string): number | null {
  const match = TIMESPAN.exec(text.trim());
  if (!match) return null;
  const [, days, hours, minutes, seconds] = match;
  if (Number(minutes) > 59 || Number(seconds) >= 60) return null;
  return (
    Number(days ?? 0) * 86400 +
    Number(hours) * 3600 +
    Number(minutes) * 60 +
    Number(seconds)
  );
}

export function diagnostic(
  code: string,
  field: string | null,
  message: string,
): MappingDiagnostic {
  return { code, field, message };
}

/** A PI stream value wrapper `{ Value, Timestamp }` is unwrapped; digital states (with Name) are kept. */
/** PI `UnitsAbbreviation` of time units → the duration unit they mean. */
const DELIVERED_TIME_UNITS: Readonly<
  Record<string, Exclude<DurationUnit, 'timespan'>>
> = {
  s: 'seconds',
  sec: 'seconds',
  secs: 'seconds',
  second: 'seconds',
  seconds: 'seconds',
  min: 'minutes',
  mins: 'minutes',
  minute: 'minutes',
  minutes: 'minutes',
  h: 'hours',
  hr: 'hours',
  hrs: 'hours',
  hour: 'hours',
  hours: 'hours',
};

/**
 * A duration delivered with a time unit (`{ Value: 300, UnitsAbbreviation: 's' }`) is read in that unit:
 * the rule's unit is the fallback for unitless values, never a reason to scale seconds as minutes.
 */
function withDeliveredUnit(rule: FieldRule, raw: unknown): FieldRule {
  if (!isObject(raw) || typeof raw.UnitsAbbreviation !== 'string') return rule;
  const unit = DELIVERED_TIME_UNITS[raw.UnitsAbbreviation.trim().toLowerCase()];
  return unit ? { ...rule, unit } : rule;
}

function unwrap(raw: unknown): unknown {
  if (isObject(raw) && !('Name' in raw) && 'Value' in raw) {
    return raw.Value;
  }
  return raw;
}

function toNumber(rule: FieldRule, value: unknown): Conversion {
  const number =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(number)
    ? { ok: true, value: number }
    : mismatch(rule, value);
}

function toText(rule: FieldRule, value: unknown): Conversion {
  if (typeof value === 'string') return { ok: true, value };
  if (typeof value === 'number' || typeof value === 'boolean') {
    return { ok: true, value: String(value) };
  }
  const digital = digitalOf(value);
  return digital ? { ok: true, value: digital.name } : mismatch(rule, value);
}

function toBool(rule: FieldRule, value: unknown): Conversion {
  if (typeof value === 'boolean') return { ok: true, value };
  if (value === 1 || value === 'true' || value === 'True') {
    return { ok: true, value: true };
  }
  if (value === 0 || value === 'false' || value === 'False') {
    return { ok: true, value: false };
  }
  return mismatch(rule, value);
}

function toDigital(rule: FieldRule, value: unknown): Conversion {
  const digital = digitalOf(value);
  if (digital) return { ok: true, value: digital };
  if (typeof value === 'string' && value.trim() !== '') {
    return {
      ok: true,
      value: { name: value.trim(), value: null, isSystem: false },
    };
  }
  return mismatch(rule, value);
}

function toDurationSeconds(rule: FieldRule, value: unknown): Conversion {
  if (!rule.unit) {
    return {
      ok: false,
      diagnostic: diagnostic(
        'DURATION_UNIT_MISSING',
        rule.targetField,
        `Duration rule for ${rule.sourceAttr} has no unit`,
      ),
    };
  }
  const seconds =
    rule.unit === 'timespan'
      ? typeof value === 'string'
        ? parseTimeSpan(value)
        : null
      : scaled(value, UNIT_SECONDS[rule.unit]);
  if (seconds === null) {
    return {
      ok: false,
      diagnostic: diagnostic(
        'DURATION_UNPARSEABLE',
        rule.targetField,
        `${rule.sourceAttr} is not a duration in ${rule.unit}: ${describe(value)}`,
      ),
    };
  }
  return { ok: true, value: seconds };
}

function toTimestamp(rule: FieldRule, value: unknown): Conversion {
  const date =
    value instanceof Date
      ? value
      : typeof value === 'string'
        ? new Date(value)
        : null;
  return date && !Number.isNaN(date.getTime())
    ? { ok: true, value: date.toISOString() }
    : mismatch(rule, value);
}

/** Numbers and numeric strings only: a TimeSpan text under a numeric unit is not guessed. */
function scaled(value: unknown, factor: number): number | null {
  const number =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\s*-?\d+(\.\d+)?\s*$/.test(value)
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(number) && number >= 0 ? number * factor : null;
}

function digitalOf(value: unknown): DigitalState | null {
  if (!isObject(value) || typeof value.Name !== 'string') return null;
  const raw = value.Value;
  return {
    name: value.Name,
    value: typeof raw === 'number' || typeof raw === 'string' ? raw : null,
    isSystem: value.IsSystem === true,
  };
}

function mismatch(rule: FieldRule, value: unknown): Conversion {
  return {
    ok: false,
    diagnostic: diagnostic(
      'TYPE_MISMATCH',
      rule.targetField,
      `${rule.sourceAttr} is not a ${rule.type}: ${describe(value)}`,
    ),
  };
}

function describe(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return (text ?? String(value)).slice(0, 80);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
