import { RequestContext } from '../../common/context/request-context';
import { legacyRolesApplying } from './role-model';

/**
 * The roles the caller's legacy `users.role` contributes in the acting plant: none outside the plants
 * where the legacy role applies (already decided by `context.roles`), and its D06 scope role only while
 * the caller holds no own grant in the plant (QA audit 2026-10-19, `legacyRolesApplying`).
 */
export function legacyRolesOf(context: RequestContext): string[] {
  const ownGrant = context.scopes.some(
    (scope) => scope.tenantId === context.tenantId && !scope.delegationId,
  );
  return legacyRolesApplying(context.legacyRole, ownGrant).filter((role) =>
    context.roles.includes(role),
  );
}
