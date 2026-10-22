import { useNavigate } from 'react-router-dom';
import { useChangeRule, useCreateRule, type RuleCreateBody } from '@/api/v2/queries/rules';
import type { RuleView } from '@/api/v2/types/rules';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { ruleCreatedResult, rulePagePath } from '../model/codes-save-result';
import { useCodesSaveFeedback } from './use-codes-save-feedback';

/**
 * Save of the rule builder (DECISIONS 2026-10-22 "Save feedback"): a new rule ends in the result dialog
 * (View rule · Add another · Back to Rules · Next; dismissing it opens the rule's page, so a second Create
 * cannot duplicate it), a saved draft in a toast. A refusal is the red `alert` (field errors stay on their
 * rows) and `failure` for the rows; `save` resolves false then.
 */
export function useRuleSave(rule: RuleView | null, onAddAnother: () => void) {
  const create = useCreateRule();
  const change = useChangeRule();
  const feedback = useCodesSaveFeedback({ withFields: false });
  const capabilities = useCapabilities();
  const navigate = useNavigate();
  const submit = (body: RuleCreateBody) => {
    if (rule) return feedback.run(() => change.submit({ rule, body: { name: body.name, description: body.description, priority: body.priority, definition: body.definition } }), 'Rule draft saved');
    return feedback.run(() => create.submit(body), (created) =>
      ruleCreatedResult(created, { capabilities, onAddAnother, onDismiss: () => navigate(rulePagePath(created.id), { replace: true }) }));
  };
  const save = async (body: RuleCreateBody): Promise<boolean> => {
    try {
      await submit(body);
      return true;
    } catch {
      return false;
    }
  };
  return { save, pending: create.isPending || change.isPending, failure: feedback.failure, clearFailure: feedback.clearFailure, alert: feedback.alert, dialog: feedback.dialog };
}
