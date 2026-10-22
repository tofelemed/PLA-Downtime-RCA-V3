import type { UnitImpactRuleView } from '@/api/v2/types/unit-impact';
import type { Capabilities } from '@/features/auth/capabilities';
import { nextSetupLink, type SaveResult } from '@/features/ux-kit/save-result';
import { sectionNameOf } from '../../components/master-data-sections';

export const IMPACT_RULES_PATH = '/master-data/unit-impact-rules';

export interface ImpactRuleSaveResultInput {
  rule: UnitImpactRuleView;
  /** "P-101 — Feed pump on Extruder 1" */
  recordLabel: string;
  /** "Add another": opens a fresh form */
  onAddAnother: () => void;
  capabilities?: Capabilities;
}

/**
 * The result dialog of a new draft rule (DECISIONS 2026-10-22): View rule (its row) · Add another · Back to
 * Unit impact rules · Next: <setup page>. A draft applies only after another manager approves it.
 */
export function impactRuleSaveResult({ rule, recordLabel, onAddAnother, capabilities }: ImpactRuleSaveResultInput): SaveResult {
  return {
    title: `Draft rule version ${rule.version} added`,
    recordLabel,
    message: 'Another manager approves it; until then stops of this asset keep their current impact.',
    // the rule's unit as the list filter, so its row is among few
    viewPath: `${IMPACT_RULES_PATH}?unitId=${encodeURIComponent(rule.unitId)}#unit-impact-rule-${rule.id}`,
    viewLabel: 'View rule',
    listPath: IMPACT_RULES_PATH,
    listLabel: sectionNameOf(IMPACT_RULES_PATH),
    onAddAnother,
    next: nextSetupLink(IMPACT_RULES_PATH, { unitId: rule.unitId, capabilities }),
  };
}
