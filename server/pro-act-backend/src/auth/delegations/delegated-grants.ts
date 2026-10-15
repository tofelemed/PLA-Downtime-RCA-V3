import { EntityManager } from 'typeorm';
import { ScopeGrant } from '../../common/context/request-context';
import { GrantRef, holdsForScope } from './delegation-rules';

interface DelegationRow {
  id: string;
  tenant_id: string;
  delegator_id: string;
  role: string;
  scope_kind: 'tenant' | 'site' | 'unit';
  scope_id: string;
  site_of_unit: string | null;
  delegator_role: string | null;
  delegator_tenant: string | null;
}

interface GrantRow {
  user_id: string;
  tenant_id: string;
  role: string;
  scope_kind: 'tenant' | 'site' | 'unit';
  scope_id: string;
}

/** Delegations to the user in force at `$2`, with an active delegator (IDX_role_delegations_delegate_until). */
const IN_FORCE_SQL = `SELECT d."id", d."tenant_id", d."delegator_id", d."role", d."scope_kind", d."scope_id",
       n."site_id" AS "site_of_unit", du."role" AS "delegator_role", du."tenant_id" AS "delegator_tenant"
  FROM "role_delegations" d
  JOIN "users" du ON du."id" = d."delegator_id" AND du."is_active" IS DISTINCT FROM false
  LEFT JOIN "units" n ON d."scope_kind" = 'unit' AND n."id" = d."scope_id"
 WHERE d."delegate_id" = $1 AND d."revoked_at" IS NULL AND d."valid_from" <= $2 AND d."valid_until" > $2`;

const GRANTS_SQL = `SELECT s."user_id", s."tenant_id", s."role", s."scope_kind", s."scope_id"
  FROM "user_scopes" s WHERE s."user_id" = ANY($1::uuid[])`;

/**
 * SME R1 / R6: the scope grants a user holds as a delegate at `at` — each delegation in force whose
 * delegator still holds the role on that scope (own grant or legacy home-plant role; a delegate never
 * passes a role on), as a grant marked with the delegation and the delegator. Two indexed queries, and
 * only the first when the user has no delegation.
 */
export async function delegatedGrants(
  manager: EntityManager,
  userId: string,
  at: Date,
): Promise<ScopeGrant[]> {
  const rows: DelegationRow[] = await manager.query(IN_FORCE_SQL, [userId, at]);
  if (rows.length === 0) return [];
  const delegators = [...new Set(rows.map((r) => r.delegator_id))];
  const grants: GrantRow[] = await manager.query(GRANTS_SQL, [delegators]);
  const byDelegator = new Map<string, GrantRef[]>();
  for (const g of grants) {
    const list = byDelegator.get(g.user_id) ?? [];
    list.push({
      tenantId: g.tenant_id,
      role: g.role,
      kind: g.scope_kind,
      id: g.scope_id,
    });
    byDelegator.set(g.user_id, list);
  }
  return rows
    .filter((r) =>
      holdsForScope(
        byDelegator.get(r.delegator_id) ?? [],
        { role: r.delegator_role, tenantId: r.delegator_tenant },
        {
          tenantId: r.tenant_id,
          role: r.role,
          kind: r.scope_kind,
          id: r.scope_id,
          siteOfUnit: r.site_of_unit,
        },
      ),
    )
    .map((r) => ({
      kind: r.scope_kind,
      id: r.scope_id,
      role: r.role,
      tenantId: r.tenant_id,
      delegationId: r.id,
      delegatorId: r.delegator_id,
    }));
}
