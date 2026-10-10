import { RULE_KIND_SPECS, RuleKind, RuleState } from './grammar/rule-catalog';
import { RuleDefinition } from './grammar/rule-definition';
import { Rule } from './entities/rule.entity';
import { RuleVersion, RuleVersionOrigin } from './entities/rule-version.entity';

/** v2 view of a rule (plan 3.8): the version in force and the pending draft side by side. */
export interface RuleV2View {
  id: string;
  kind: RuleKind;
  name: string;
  description: string | null;
  priority: number;
  state: RuleState;
  activeVersion: number | null;
  /** definition of the version in force (null for a never-activated or retired rule) */
  activeDefinition: RuleDefinition | null;
  draft: {
    definition: RuleDefinition;
    authorId: string | null;
    updatedAt: string | null;
  } | null;
  /** what consumes rules of this kind in R1 */
  appliedBy: string;
  rowVersion: number;
  createdAt: string;
  createdBy: string | null;
  retiredAt: string | null;
}

export interface RuleVersionV2View {
  version: number;
  definition: RuleDefinition;
  origin: RuleVersionOrigin;
  restoredVersion: number | null;
  authoredBy: string | null;
  approvedBy: string;
  effectiveFrom: string;
  reason: string | null;
  /** the version in force now */
  current: boolean;
}

export function toRuleView(rule: Rule, active: RuleVersion | null): RuleV2View {
  return {
    id: rule.id,
    kind: rule.kind,
    name: rule.name,
    description: rule.description,
    priority: rule.priority,
    state: rule.state,
    activeVersion: rule.activeVersion,
    activeDefinition:
      rule.state === 'active' ? (active?.definition ?? null) : null,
    draft: rule.draftDefinition
      ? {
          definition: rule.draftDefinition,
          authorId: rule.draftAuthor,
          updatedAt: rule.draftUpdatedAt?.toISOString() ?? null,
        }
      : null,
    appliedBy: RULE_KIND_SPECS[rule.kind].appliedBy,
    rowVersion: rule.rowVersion,
    createdAt: rule.createdAt.toISOString(),
    createdBy: rule.createdBy,
    retiredAt: rule.retiredAt?.toISOString() ?? null,
  };
}

export function toRuleVersionView(
  row: RuleVersion,
  rule: Pick<Rule, 'state' | 'activeVersion'>,
): RuleVersionV2View {
  return {
    version: row.version,
    definition: row.definition,
    origin: row.origin,
    restoredVersion: row.restoredVersion,
    authoredBy: row.authoredBy,
    approvedBy: row.approvedBy,
    effectiveFrom: row.effectiveFrom.toISOString(),
    reason: row.reason,
    current: rule.state === 'active' && rule.activeVersion === row.version,
  };
}
