import { EntityManager } from 'typeorm';
import { ScopeGrant } from '../../common/context/request-context';
import {
  DelegationRow,
  grantsFromDelegations,
  GrantRow,
} from '../delegations/delegated-grants';

/** Delegations to `$1` in force at `$2` (IDX_role_delegations_delegate_until); same filter as delegated-grants. */
const IN_FORCE = `d."delegate_id" = $1 AND d."revoked_at" IS NULL AND d."valid_from" <= $2 AND d."valid_until" > $2`;

/**
 * Everything identity resolution reads, in one statement (perf audit P01: it was 3 sequential statements on
 * every authenticated request): the user's stored role and active flag, the own `user_scopes` grants, the
 * delegations in force (with an active delegator) and those delegators' grants. Still read on every request,
 * so a downgrade or deactivation applies on the next one (plan 3.11, D15).
 */
const IDENTITY_SQL = `SELECT
  (SELECT json_build_object('role', u."role", 'isActive', u."is_active") FROM "users" u WHERE u."id" = $1) AS "user",
  (SELECT coalesce(json_agg(json_build_object('kind', s."scope_kind", 'id', s."scope_id", 'role', s."role",
                                              'tenantId', s."tenant_id")), '[]'::json)
     FROM "user_scopes" s WHERE s."user_id" = $1) AS "own",
  (SELECT coalesce(json_agg(json_build_object('id', d."id", 'tenant_id', d."tenant_id", 'delegator_id', d."delegator_id",
            'role', d."role", 'scope_kind', d."scope_kind", 'scope_id', d."scope_id", 'site_of_unit', n."site_id",
            'delegator_role', du."role", 'delegator_tenant', du."tenant_id")), '[]'::json)
     FROM "role_delegations" d
     JOIN "users" du ON du."id" = d."delegator_id" AND du."is_active" IS DISTINCT FROM false
     LEFT JOIN "units" n ON d."scope_kind" = 'unit' AND n."id" = d."scope_id"
    WHERE ${IN_FORCE}) AS "delegations",
  (SELECT coalesce(json_agg(json_build_object('user_id', g."user_id", 'tenant_id', g."tenant_id", 'role', g."role",
            'scope_kind', g."scope_kind", 'scope_id', g."scope_id")), '[]'::json)
     FROM "user_scopes" g
    WHERE g."user_id" IN (SELECT d."delegator_id" FROM "role_delegations" d WHERE ${IN_FORCE})) AS "delegatorGrants"`;

interface IdentityRow {
  user: { role: string | null; isActive: boolean | null } | null;
  own: ScopeGrant[];
  delegations: DelegationRow[];
  delegatorGrants: GrantRow[];
}

export interface IdentitySnapshot {
  /** the `users` row, or null for an identity without one */
  user: { role: string | null; isActive: boolean } | null;
  /** own grants plus the grants held now as a delegate (SME R1 / R6) */
  grants: ScopeGrant[];
}

export async function identitySnapshot(
  manager: EntityManager,
  userId: string,
  at: Date,
): Promise<IdentitySnapshot> {
  const [row] = await manager.query<IdentityRow[]>(IDENTITY_SQL, [userId, at]);
  return {
    user: row.user
      ? { role: row.user.role, isActive: row.user.isActive === true }
      : null,
    grants: [
      ...row.own,
      ...(row.delegations.length > 0
        ? grantsFromDelegations(row.delegations, row.delegatorGrants)
        : []),
    ],
  };
}
