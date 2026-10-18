import { rolesForLegacyRole, satisfiesRole } from '../../auth/roles/role-model';
import { RequestContext } from '../../common/context/request-context';

/** Match roles at the record's scope, rather than the union of all roles on unrelated units. */
export function approvalScope(
  context: RequestContext,
  roles: readonly string[],
  unit?: string,
): { sql: string; parameters: Record<string, unknown> } {
  if (context.isSuperAdmin) return { sql: 'TRUE', parameters: {} };
  const grants = context.scopes.filter(
    (grant) => grant.tenantId === context.tenantId,
  );
  const legacy = [
    ...rolesForLegacyRole(context.legacyRole).filter((role) =>
      context.roles.includes(role),
    ),
    ...context.roles.filter((role) => role === 'OrgAdmin'),
  ];
  if (roles.some((role) => satisfiesRole(legacy, role)))
    return { sql: 'TRUE', parameters: {} };
  const eligible = grants.filter((grant) =>
    roles.some((role) => satisfiesRole(rolesForLegacyRole(grant.role), role)),
  );
  if (eligible.some((grant) => grant.kind === 'tenant'))
    return { sql: 'TRUE', parameters: {} };
  if (!unit) return { sql: 'FALSE', parameters: {} };
  const units = eligible
    .filter((grant) => grant.kind === 'unit')
    .map((grant) => grant.id);
  const sites = eligible
    .filter((grant) => grant.kind === 'site')
    .map((grant) => grant.id);
  const clauses: string[] = [];
  const parameters: Record<string, unknown> = {
    approvalTenant: context.tenantId,
  };
  if (units.length) {
    clauses.push(`${unit} IN (:...approvalUnits)`);
    parameters.approvalUnits = units;
  }
  if (sites.length) {
    clauses.push(
      `EXISTS (SELECT 1 FROM units approval_unit WHERE approval_unit.id = ${unit} AND approval_unit.tenant_id = :approvalTenant AND approval_unit.site_id IN (:...approvalSites))`,
    );
    parameters.approvalSites = sites;
  }
  return {
    sql: clauses.length ? `(${clauses.join(' OR ')})` : 'FALSE',
    parameters,
  };
}
