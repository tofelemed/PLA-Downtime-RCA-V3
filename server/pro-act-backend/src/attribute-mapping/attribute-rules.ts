import {
  catalogField,
  catalogTemplate,
  NO_TEMPLATE_KEY,
} from './event-field-catalog';
import { FieldRule } from './field-rule';

/**
 * Rule sets of a template: catalog defaults, then legacy `pi_mappings` overrides, then the tenant's
 * versioned overrides, merged **per target field** (a later layer replaces only the fields it maps, I10).
 */
export function mergeRules(
  ...layers: ReadonlyArray<readonly FieldRule[]>
): FieldRule[] {
  const byField = new Map<string, FieldRule>();
  for (const layer of layers) {
    for (const rule of layer) {
      byField.set(rule.targetField, rule);
    }
  }
  return [...byField.values()];
}

/** Catalog default rules of a template (the no-template rules for an unknown template). */
export function defaultRulesFor(templateName: string): FieldRule[] {
  const template =
    catalogTemplate(templateName) ?? catalogTemplate(NO_TEMPLATE_KEY);
  return template ? [...template.defaultRules] : [];
}

/** Legacy target names written by the v1 mapping UI → catalog fields. */
const LEGACY_TARGETS: Readonly<Record<string, string>> = {
  reasonCodeId: 'reason',
  reasonCode: 'reason',
  impactCodeId: 'impactCode',
  oeeCodeId: 'oeeCode',
  goodQty: 'quantity',
  scrapQty: 'defectiveQuantity',
  duration: 'suppliedDurationSeconds',
};

/**
 * A legacy `{ AttributeName: targetField }` map as typed rules: the catalog field's first type; legacy
 * durations are minutes (plan 1.1 decision). Unknown targets are kept so mapping reports them.
 */
export function legacyRules(
  map: Readonly<Record<string, unknown>>,
): FieldRule[] {
  const rules: FieldRule[] = [];
  for (const [sourceAttr, target] of Object.entries(map)) {
    if (typeof target !== 'string' || target === '') continue;
    const targetField = LEGACY_TARGETS[target] ?? target;
    const type = catalogField(targetField)?.types[0] ?? 'string';
    rules.push({
      sourceAttr,
      targetField,
      type,
      ...(type === 'duration' ? { unit: 'minutes' as const } : {}),
    });
  }
  return rules;
}

/** Problems of a rule set against the catalog (empty = valid); used by the API before saving. */
export function ruleErrors(
  templateName: string,
  rules: readonly FieldRule[],
): string[] {
  const errors: string[] = [];
  const targets = new Set<string>();
  rules.forEach((rule, index) => {
    const at = `fieldRules[${index}]`;
    const field = catalogField(rule.targetField);
    if (!field) {
      errors.push(
        `${at}.targetField ${rule.targetField} is not in the field catalog`,
      );
      return;
    }
    if (
      !field.templates.includes('*') &&
      !field.templates.includes(templateName)
    ) {
      errors.push(
        `${at}.targetField ${rule.targetField} is not allowed for ${templateName}`,
      );
    }
    if (!field.types.includes(rule.type)) {
      errors.push(
        `${at}.type must be one of ${field.types.join(', ')} for ${rule.targetField}`,
      );
    }
    if (rule.type === 'duration' && !rule.unit) {
      errors.push(`${at}.unit is required for duration rules`);
    }
    if (targets.has(rule.targetField)) {
      errors.push(`${at}.targetField ${rule.targetField} is mapped twice`);
    }
    targets.add(rule.targetField);
  });
  return errors;
}
