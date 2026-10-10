import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import {
  ClassificationBasis,
  CodeDrivenAxis,
} from '../code-library/classification-basis';
import { isSetAction, RuleDefinition } from './grammar/rule-definition';
import { evaluateRule } from './grammar/rule-interpreter';
import { eventFacts, RuleEventSource } from './rule-event-facts';

/** A value an active `coding_default` rule proposes for one axis. */
export interface RuleProposal {
  axis: CodeDrivenAxis;
  value: string;
  ruleId: string;
  ruleVersion: number;
}

interface ActiveRuleRow {
  id: string;
  version: number;
  definition: RuleDefinition;
}

const AXES: readonly CodeDrivenAxis[] = [
  'scheduleClass',
  'oeeComponent',
  'impactCodeId',
];

/**
 * Applies the tenant's active `coding_default` rules (plan 3.8) to a new event: rules run in priority
 * order (then name) with the pure interpreter; the first rule that sets an axis wins. Only axes the user
 * and the reason code left open are filled (precedence user > reason code rule / default > declarative
 * rule > event-type default), and every filled axis records its rule and version in the basis.
 */
@Injectable()
export class RuleClassificationService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  async proposals(
    tenantId: string,
    event: RuleEventSource,
  ): Promise<RuleProposal[]> {
    const rules: ActiveRuleRow[] = await this.manager.query(
      `SELECT r."id", v."version", v."definition"
         FROM "rules" r
         JOIN "rule_versions" v ON v."rule_id" = r."id" AND v."version" = r."active_version"
        WHERE r."tenant_id" = $1 AND r."kind" = 'coding_default' AND r."state" = 'active'
        ORDER BY r."priority", r."name"`,
      [tenantId],
    );
    if (rules.length === 0) return [];
    const facts = eventFacts(event);
    const chosen = new Map<CodeDrivenAxis, RuleProposal>();
    for (const rule of rules) {
      for (const action of evaluateRule(rule.definition, facts).actions) {
        if (!isSetAction(action)) continue;
        const axis = AXES.find((entry) => entry === action.set);
        if (!axis || chosen.has(axis)) continue;
        chosen.set(axis, {
          axis,
          value: action.value,
          ruleId: rule.id,
          ruleVersion: rule.version,
        });
      }
    }
    return [...chosen.values()];
  }

  /**
   * Proposals for the open axes only, as values and classification basis entries. `open` names the
   * axes nobody set yet.
   */
  async fillOpenAxes(
    tenantId: string,
    event: RuleEventSource,
    open: ReadonlySet<CodeDrivenAxis>,
  ): Promise<{
    values: Partial<Record<CodeDrivenAxis, string>>;
    basis: ClassificationBasis;
  }> {
    const values: Partial<Record<CodeDrivenAxis, string>> = {};
    const basis: ClassificationBasis = {};
    for (const proposal of await this.proposals(tenantId, event)) {
      if (!open.has(proposal.axis)) continue;
      values[proposal.axis] = proposal.value;
      basis[proposal.axis] = {
        source: 'declarative_rule',
        ruleId: proposal.ruleId,
        ruleVersion: proposal.ruleVersion,
        defaultValue: proposal.value,
        overridesDefault: false,
      };
    }
    return { values, basis };
  }
}
