import { useMemo, useState } from 'react';
import { useEffectiveMappings } from '@/api/v2/queries/integration-mappings';
import type { FieldRule, FieldValueType } from '@/api/v2/types/integration-mappings';
import { addRule, changedRules, patchRule, type RulePatch } from '../model/mapping-draft';

/**
 * Draft of one template's rules over the effective rules of the connection (plan 3.7 mapping editor).
 * The draft is reset whenever the effective rules change (another version saved, other template).
 */
export function useMappingDraft(connectionId: string, templateName: string) {
  const effectiveList = useEffectiveMappings(connectionId);
  const effective = useMemo(
    () => effectiveList.data?.find((entry) => entry.templateName === templateName) ?? null,
    [effectiveList.data, templateName],
  );
  const baseKey = JSON.stringify([templateName, effective?.rules ?? null, effective?.override?.version ?? null]);
  const [state, setState] = useState<{ key: string; draft: FieldRule[] }>({ key: '', draft: [] });
  const draft = state.key === baseKey ? state.draft : (effective?.rules ?? []);
  const update = (next: FieldRule[]) => setState({ key: baseKey, draft: next });
  const changed = changedRules(effective?.rules ?? [], draft);
  return {
    query: effectiveList,
    effective,
    draft,
    changed,
    patch: (targetField: string, patch: RulePatch) => update(patchRule(draft, targetField, patch)),
    add: (targetField: string, type: FieldValueType, sourceAttr: string) => update(addRule(draft, targetField, type, sourceAttr)),
    reset: () => update(effective?.rules ?? []),
  };
}
