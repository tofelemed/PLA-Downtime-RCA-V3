import { EntityManager } from 'typeorm';
import { ActiveCodingRule } from './rule-defaults';

/** A lazy, batch-cached source of the tenant's active `coding_default` rules (item 8: once per batch). */
export type CodingRuleSource = () => Promise<readonly ActiveCodingRule[]>;

/**
 * The versions in force of the tenant's active `coding_default` rules, in evaluation order (plan 3.8);
 * none for a row without a tenant.
 */
export async function activeCodingRulesIn(
  manager: EntityManager,
  tenantId: string | null | undefined,
): Promise<ActiveCodingRule[]> {
  if (!tenantId) return [];
  return manager.query<ActiveCodingRule[]>(
    `SELECT r."id", v."version", v."definition"
       FROM "rules" r
       JOIN "rule_versions" v ON v."rule_id" = r."id" AND v."version" = r."active_version"
      WHERE r."tenant_id" = $1 AND r."kind" = 'coding_default' AND r."state" = 'active'
      ORDER BY r."priority", r."name"`,
    [tenantId],
  );
}
