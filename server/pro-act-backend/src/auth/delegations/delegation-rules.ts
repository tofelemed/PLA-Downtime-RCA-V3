import { legacyRolesApplying } from '../roles/role-model';

/** A grant as the rules see it: a role on the tenant, a site or a unit of one tenant. */
export interface GrantRef {
  tenantId: string;
  role: string;
  kind: 'tenant' | 'site' | 'unit';
  id: string;
}

/** What a delegation hands over: a role on a scope; `siteOfUnit` is the unit's site for a unit scope. */
export interface DelegatedScope {
  tenantId: string;
  role: string;
  kind: 'tenant' | 'site' | 'unit';
  id: string;
  siteOfUnit: string | null;
}

/** The longest delegation (engineering default, DECISIONS 15 Oct 2026): absences, not standing grants. */
export const MAX_DELEGATION_DAYS = 90;

/**
 * Whether `grants` (own scope grants of the delegator) or the delegator's legacy home-plant role (its D06
 * mapping only while the delegator holds no own grant in that plant) cover the
 * delegated role on the delegated scope: a tenant grant covers everything, a site grant its site and the
 * site's units, a unit grant only that unit. Delegated grants never count (a delegate cannot pass a role on).
 */
export function holdsForScope(
  grants: readonly GrantRef[],
  legacy: { role: string | null; tenantId: string | null },
  target: DelegatedScope,
): boolean {
  const ownGrantInPlant = grants.some((g) => g.tenantId === target.tenantId);
  if (
    legacy.tenantId === target.tenantId &&
    legacyRolesApplying(legacy.role, ownGrantInPlant).includes(target.role)
  ) {
    return true;
  }
  return grants.some(
    (g) =>
      g.tenantId === target.tenantId &&
      g.role === target.role &&
      (g.kind === 'tenant' ||
        (g.kind === target.kind && g.id === target.id) ||
        (g.kind === 'site' &&
          target.kind === 'unit' &&
          g.id === target.siteOfUnit)),
  );
}

export type DelegationRefusal =
  | 'SELF_DELEGATION'
  | 'INVALID_INTERVAL'
  | 'TOO_LONG'
  | 'ALREADY_ENDED';

/** Interval and party rules of a new delegation (null = valid). */
export function delegationRefusal(input: {
  delegatorId: string;
  delegateId: string;
  validFrom: Date;
  validUntil: Date;
  now: Date;
}): DelegationRefusal | null {
  if (input.delegatorId === input.delegateId) return 'SELF_DELEGATION';
  const span = input.validUntil.getTime() - input.validFrom.getTime();
  if (!(span > 0)) return 'INVALID_INTERVAL';
  if (span > MAX_DELEGATION_DAYS * 86_400_000) return 'TOO_LONG';
  if (input.validUntil.getTime() <= input.now.getTime()) return 'ALREADY_ENDED';
  return null;
}

/** In force at `at`: started, not ended (half-open) and not revoked. */
export function delegationInForce(
  d: { validFrom: Date; validUntil: Date; revokedAt: Date | null },
  at: Date,
): boolean {
  return (
    d.revokedAt === null &&
    d.validFrom.getTime() <= at.getTime() &&
    at.getTime() < d.validUntil.getTime()
  );
}
