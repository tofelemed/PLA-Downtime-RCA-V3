import { EventFacts } from '../production-event/revisions/event-facts';
import {
  convertValue,
  ConvertedValue,
  diagnostic,
  MappingDiagnostic,
} from './attribute-conversion';
import { catalogField } from './event-field-catalog';
import { FieldRule } from './field-rule';

export interface FrameTimes {
  start: Date;
  end: Date | null;
}

export interface AttributeMappingResult {
  /** catalog fields stored in event columns */
  columns: Record<string, string | number | boolean>;
  /** catalog fields kept as source facts only (reason, impact/OEE code, supplied duration) */
  facts: EventFacts;
  diagnostics: MappingDiagnostic[];
}

/** Supplied and timestamp durations may differ by this much before it is reported. */
const DURATION_TOLERANCE_SECONDS = 1;

/**
 * Typed mapping of a source record's attributes (spec ING04): each rule converts its attribute to the
 * catalog field's type; problems become diagnostics instead of `NaN` or `[object Object]`. A supplied
 * duration never moves the timestamps: when both exist and disagree, a `DURATION_MISMATCH` is reported
 * and the timestamps win.
 */
export function mapAttributes(
  rules: readonly FieldRule[],
  attributes: Readonly<Record<string, unknown>>,
  times: FrameTimes,
): AttributeMappingResult {
  const result: AttributeMappingResult = {
    columns: {},
    facts: {},
    diagnostics: [],
  };
  for (const rule of rules) {
    applyRule(result, rule, attributes);
  }
  const mismatch = durationMismatch(result.facts, times);
  if (mismatch) result.diagnostics.push(mismatch);
  return result;
}

function applyRule(
  result: AttributeMappingResult,
  rule: FieldRule,
  attributes: Readonly<Record<string, unknown>>,
): void {
  const field = catalogField(rule.targetField);
  if (!field) {
    result.diagnostics.push(
      diagnostic(
        'UNKNOWN_FIELD',
        rule.targetField,
        `${rule.targetField} is not in the field catalog`,
      ),
    );
    return;
  }
  const raw = firstPresent(attributes, [
    rule.sourceAttr,
    ...(rule.aliases ?? []),
  ]);
  if (raw === undefined) {
    if (rule.required) {
      result.diagnostics.push(
        diagnostic(
          'REQUIRED_MISSING',
          rule.targetField,
          `${rule.sourceAttr} is missing`,
        ),
      );
    }
    return;
  }
  const converted = convertValue(rule, raw);
  if (!converted.ok) {
    result.diagnostics.push(converted.diagnostic);
    return;
  }
  store(result, field.storedAs, rule.targetField, converted.value);
}

function store(
  result: AttributeMappingResult,
  storedAs: 'column' | 'source_fact',
  name: string,
  value: ConvertedValue,
): void {
  if (storedAs === 'source_fact') {
    result.facts[name] = value;
  } else if (typeof value !== 'object') {
    result.columns[name] = value;
  } else {
    result.columns[name] = value.name;
  }
}

function firstPresent(
  attributes: Readonly<Record<string, unknown>>,
  names: readonly string[],
): unknown {
  for (const name of names) {
    const value = attributes[name];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function durationMismatch(
  facts: EventFacts,
  times: FrameTimes,
): MappingDiagnostic | null {
  const supplied = facts.suppliedDurationSeconds;
  if (typeof supplied !== 'number' || !times.end) return null;
  const fromTimestamps = (times.end.getTime() - times.start.getTime()) / 1000;
  if (Math.abs(fromTimestamps - supplied) <= DURATION_TOLERANCE_SECONDS) {
    return null;
  }
  return diagnostic(
    'DURATION_MISMATCH',
    'suppliedDurationSeconds',
    `supplied ${supplied} s, timestamps give ${fromTimestamps} s; the timestamps win`,
  );
}
