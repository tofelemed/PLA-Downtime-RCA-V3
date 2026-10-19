import { READ_ONLY_ROLES } from '../../auth/guards/write-access.guard';
import { RoleName, SCOPE_ROLES } from '../../auth/roles/role-model';

/**
 * Who decides a suggested duplicate stop (merge, keep both) and undoes a merge: every event writer — any
 * scope role that is not read-only (the `WriteAccessGuard` rule of event writes; legacy roles carry their
 * D06 scope role, SuperAdmin / OrgAdmin satisfy every role). The decision routes and the approval inbox's
 * `stop-merge` kind both use this set, so who sees the item is who can decide it.
 */
export const STOP_DECISION_ROLES: readonly RoleName[] = SCOPE_ROLES.filter(
  (role) => !READ_ONLY_ROLES.has(role),
);
