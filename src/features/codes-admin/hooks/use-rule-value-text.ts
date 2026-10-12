import type { RulesSchemaView } from '@/api/v2/types/rules';
import { humanize } from '@/features/ux-kit/labels/humanize';
import type { ValueText } from '../model/rule-describe';
import { useReferenceOptions } from './use-reference-options';

/**
 * Display text of values stored in a rule definition: record ids (units, reason and impact codes) by
 * their name, enum tokens in plain words. Numbers and free text stay as written.
 */
export function useRuleValueText(schema: RulesSchemaView): ValueText {
  const references = useReferenceOptions();
  return (field, value) => {
    const spec = schema.fields.find((entry) => entry.name === field);
    const target = schema.kinds.flatMap((kind) => kind.sets).find((entry) => entry.field === field);
    const reference = spec?.references ?? target?.references;
    if (reference) return references[reference]?.find((option) => option.value === value)?.label ?? 'Unknown record';
    if (spec?.type === 'enum' || target?.values) return humanize(value);
    return value;
  };
}
