import type { AttributePreviewBody } from '@/api/v2/queries/integration-mappings';
import type { DurationUnit, FieldRule, FieldValueType } from '@/api/v2/types/integration-mappings';
import type { SampleRecordView } from '@/api/v2/types/integrations';

/**
 * Mapping editor state (plan 3.7, ING04): the effective rules of a template as the server merged them,
 * edited field by field. Only rules that differ from the effective ones are sent — as draft rules to the
 * preview, and as the next override version when saved — so the override indicator is exact.
 */
export const NO_TEMPLATE = '*NoTemplate*';

const sameRule = (a: FieldRule, b: FieldRule) =>
  a.sourceAttr === b.sourceAttr &&
  a.type === b.type &&
  (a.unit ?? null) === (b.unit ?? null) &&
  Boolean(a.required) === Boolean(b.required) &&
  JSON.stringify(a.aliases ?? []) === JSON.stringify(b.aliases ?? []);

/** Rules of the draft that differ from the effective rule of the same target field (or are new). */
export function changedRules(effective: readonly FieldRule[], draft: readonly FieldRule[]): FieldRule[] {
  const byField = new Map(effective.map((rule) => [rule.targetField, rule]));
  return draft.filter((rule) => {
    const current = byField.get(rule.targetField);
    return !current || !sameRule(current, rule);
  });
}

export type RulePatch = Partial<Pick<FieldRule, 'sourceAttr' | 'type' | 'unit'>>;

/** The draft with one target field changed; a non-duration type drops the unit, a duration needs one. */
export function patchRule(draft: readonly FieldRule[], targetField: string, patch: RulePatch): FieldRule[] {
  return draft.map((rule) => {
    if (rule.targetField !== targetField) return rule;
    const next: FieldRule = { ...rule, ...patch };
    if (next.type !== 'duration') delete next.unit;
    else if (!next.unit) next.unit = 'seconds';
    return next;
  });
}

/** Adds a rule for a catalog field not mapped yet (first accepted type). */
export function addRule(draft: readonly FieldRule[], targetField: string, type: FieldValueType, sourceAttr: string): FieldRule[] {
  if (draft.some((rule) => rule.targetField === targetField)) return [...draft];
  const rule: FieldRule = { sourceAttr, targetField, type };
  if (type === 'duration') rule.unit = 'seconds';
  return [...draft, rule];
}

export const DURATION_UNITS: readonly DurationUnit[] = ['seconds', 'minutes', 'hours', 'timespan'];

/** Body of the typed preview for one sampled record with the changed rules as the draft. */
export function previewBody(input: {
  sample: SampleRecordView;
  connectionId: string;
  templateName: string;
  draft: readonly FieldRule[];
}): AttributePreviewBody {
  return {
    templateName: input.templateName,
    connectionId: input.connectionId,
    attributes: input.sample.attributes,
    startTime: input.sample.startTime,
    ...(input.sample.endTime ? { endTime: input.sample.endTime } : {}),
    ...(input.draft.length > 0 ? { fieldRules: input.draft.map((rule) => ({ ...rule })) } : {}),
  };
}

/** A mapped value as text: numbers and strings as they are, digital states by name, objects as JSON. */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  const name = (value as { name?: unknown }).name;
  return typeof name === 'string' ? name : JSON.stringify(value);
}
