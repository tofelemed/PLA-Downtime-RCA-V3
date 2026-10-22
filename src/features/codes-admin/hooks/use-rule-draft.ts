import { useState } from 'react';
import type { RuleKind } from '@/api/v2/types/rules';
import {
  ActionRow,
  ConditionList,
  ConditionRow,
  emptyAction,
  emptyCondition,
  RuleDraft,
} from '../model/rule-form';

/** Editing state of one rule draft (rows keyed so error messages stay on their row). */
export function useRuleDraft(initial: () => RuleDraft) {
  const [draft, setDraft] = useState<RuleDraft>(initial);
  const patch = (changes: Partial<RuleDraft>) => setDraft((current) => ({ ...current, ...changes }));
  const updateCondition = (list: ConditionList, key: string, changes: Partial<ConditionRow>) =>
    setDraft((current) => ({ ...current, [list]: current[list].map((row) => (row.key === key ? { ...row, ...changes } : row)) }));
  const addCondition = (list: ConditionList) => setDraft((current) => ({ ...current, [list]: [...current[list], emptyCondition()] }));
  const removeCondition = (list: ConditionList, key: string) =>
    setDraft((current) => ({ ...current, [list]: current[list].filter((row) => row.key !== key) }));
  const updateAction = (key: string, changes: Partial<ActionRow>) =>
    setDraft((current) => ({ ...current, actions: current.actions.map((row) => (row.key === key ? { ...row, ...changes } : row)) }));
  const addAction = (type: ActionRow['type']) => setDraft((current) => ({ ...current, actions: [...current.actions, emptyAction(type)] }));
  const removeAction = (key: string) => setDraft((current) => ({ ...current, actions: current.actions.filter((row) => row.key !== key) }));
  const setKind = (kind: RuleKind) => patch({ kind, actions: [emptyAction(kind === 'coding_default' || kind === 'status_derivation' ? 'set' : 'flag')] });
  /** a whole new draft, e.g. an empty one for "Add another" */
  const replace = (next: RuleDraft) => setDraft(next);
  return { draft, patch, replace, setKind, updateCondition, addCondition, removeCondition, updateAction, addAction, removeAction };
}

export type RuleDraftState = ReturnType<typeof useRuleDraft>;
