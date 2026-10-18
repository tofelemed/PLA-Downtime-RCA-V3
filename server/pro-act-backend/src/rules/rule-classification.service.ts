import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { CodeDrivenAxis } from '../code-library/classification-basis';
import {
  ActiveCodingRule,
  fillOpenAxes,
  RuleFill,
  RuleProposal,
  ruleProposals,
} from './rule-defaults';
import { RuleEventSource } from './rule-event-facts';

/**
 * Applies the tenant's active `coding_default` rules (plan 3.8) to a new event: rules run in priority
 * order (then name) with the pure interpreter; the first rule that sets an axis wins. Only axes the user,
 * the source and the reason code left open are filled (precedence stated value > reason code rule /
 * default > declarative rule > event-type default), and every filled axis records its rule and version
 * in the basis. Bulk creators (PI / MQTT ingest, the state engine) load `activeRules` once per batch and
 * apply them with the pure helpers of `rule-defaults.ts`.
 */
@Injectable()
export class RuleClassificationService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  /** The versions in force of the tenant's active `coding_default` rules, in evaluation order. */
  activeRules(tenantId: string): Promise<ActiveCodingRule[]> {
    return this.manager.query<ActiveCodingRule[]>(
      `SELECT r."id", v."version", v."definition"
         FROM "rules" r
         JOIN "rule_versions" v ON v."rule_id" = r."id" AND v."version" = r."active_version"
        WHERE r."tenant_id" = $1 AND r."kind" = 'coding_default' AND r."state" = 'active'
        ORDER BY r."priority", r."name"`,
      [tenantId],
    );
  }

  async proposals(
    tenantId: string,
    event: RuleEventSource,
  ): Promise<RuleProposal[]> {
    return ruleProposals(await this.activeRules(tenantId), event);
  }

  /**
   * Proposals for the open axes only, as values and classification basis entries. `open` names the
   * axes nobody set yet.
   */
  async fillOpenAxes(
    tenantId: string,
    event: RuleEventSource,
    open: ReadonlySet<CodeDrivenAxis>,
  ): Promise<RuleFill> {
    if (open.size === 0) return { values: {}, basis: {} };
    return fillOpenAxes(await this.activeRules(tenantId), event, open);
  }
}
