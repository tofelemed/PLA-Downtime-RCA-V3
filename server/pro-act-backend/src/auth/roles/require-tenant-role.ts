import { ForbiddenException } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { legacyRolesOf } from './legacy-roles-of';
import { satisfiesRole } from './role-model';

/** A plant-wide change needs the required role at plant scope, not an unrelated broad read grant. */
export function requireTenantRole(
  context: RequestContext,
  required: readonly string[],
): void {
  const legacy = legacyRolesOf(context);
  const grants = context.scopes
    .filter(
      (scope) => scope.tenantId === context.tenantId && scope.kind === 'tenant',
    )
    .map((scope) => scope.role);
  const global = context.roles.filter(
    (role) => role === 'SuperAdmin' || role === 'OrgAdmin',
  );
  if (
    required.some((role) =>
      satisfiesRole([...legacy, ...grants, ...global], role),
    )
  )
    return;
  throw new ForbiddenException({
    code: 'FORBIDDEN_ROLE',
    message: `Requires one of these roles on the plant: ${required.join(', ')}`,
  });
}
