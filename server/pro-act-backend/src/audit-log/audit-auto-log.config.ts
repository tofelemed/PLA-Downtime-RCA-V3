/** Routes that must not generate auto-audit entries (avoid loops / noise). */
export const AUDIT_SKIP_ROUTE_PREFIXES = [
  'auth',
  'health',
  'audit-logs',
  'reports',
  'realtime',
  'streaming',
  'pi-proxy',
];

/** Map API route segment → audit entity type label */
export const AUDIT_ENTITY_ROUTE_MAP: Record<string, string> = {
  users: 'User',
  organizations: 'Organization',
  tenants: 'Tenant',
  units: 'Unit',
  assets: 'Asset',
  'production-plans': 'ProductionPlan',
  'production-events': 'ProductionEvent',
  'production-losses': 'ProductionLoss',
  'production-plan-templates': 'ProductionPlanTemplate',
  rcas: 'RCA',
  'rca-recommendations': 'RCARecommendation',
  'rca-templates': 'RCATemplate',
  'rca-evidence': 'RCAEvidence',
  'rca-trigger-config': 'RCATriggerConfig',
  tasks: 'Task',
  roles: 'Role',
  products: 'Product',
  'impact-codes': 'ImpactCode',
  'oee-codes': 'OEECode',
  'reason-codes': 'ReasonCode',
  'logic-tree-nodes': 'LogicTreeNode',
  'dashboard-configurations': 'DashboardConfiguration',
  'app-settings': 'AppSettings',
  'unmapped-events': 'UnmappedEvent',
  'hierarchy-mappings': 'HierarchyMapping',
  'pi-connections': 'PIConnection',
  'pi-sync-jobs': 'PISyncJob',
  connectivity: 'Connectivity',
  'custom-attribute-definitions': 'CustomAttributeDefinition',
  'custom-attribute-values': 'CustomAttributeValue',
};

export function methodToAuditAction(method: string): string {
  switch (method.toUpperCase()) {
    case 'POST':
      return 'CREATE';
    case 'PUT':
    case 'PATCH':
      return 'UPDATE';
    case 'DELETE':
      return 'DELETE';
    default:
      return method.toUpperCase();
  }
}

export function resolveRouteSegment(path: string): string {
  const normalized = path.split('?')[0].replace(/^\/api\/?/, '');
  return normalized.split('/').filter(Boolean)[0] || '';
}

export function shouldSkipAudit(path: string, method: string): boolean {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
    return true;
  }
  const segment = resolveRouteSegment(path);
  return AUDIT_SKIP_ROUTE_PREFIXES.includes(segment);
}

export function resolveEntityType(path: string): string {
  const segment = resolveRouteSegment(path);
  if (AUDIT_ENTITY_ROUTE_MAP[segment]) {
    return AUDIT_ENTITY_ROUTE_MAP[segment];
  }
  return segment
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}
