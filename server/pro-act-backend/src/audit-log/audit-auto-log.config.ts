/** Routes that must not generate auto-audit entries (avoid loops / noise). */
export const AUDIT_SKIP_ROUTE_PREFIXES = [
  'auth',
  'health',
  'audit-logs',
  'reports',
  'realtime',
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
  rcas: 'RCA',
  'rca-recommendations': 'RCARecommendation',
  'rca-templates': 'RCATemplate',
  'rca-actions': 'RCAAction',
  tasks: 'Task',
  products: 'Product',
  'impact-codes': 'ImpactCode',
  'oee-codes': 'OEECode',
  'reason-codes': 'ReasonCode',
  'app-settings': 'AppSettings',
  'hierarchy-mappings': 'HierarchyMapping',
  'custom-attribute-definitions': 'CustomAttributeDefinition',
  'custom-attribute-values': 'CustomAttributeValue',
  'user-scopes': 'UserScope',
  branding: 'Branding',
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
  // `/api/v2/rcas` audits as `rcas` (plan 3.9): the URI version is not the entity
  return normalizedSegments(path)[0] || '';
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

/** Which record an audited write is attributed to. */
export interface AuditTarget {
  entityType: string;
  entityId: string;
  /** sub-resource of a parent route (`rcas/:id/actions` → `actions` with the created action's id) */
  subresource?: { kind: string; id?: string };
}

export interface AuditTargetInput {
  path: string;
  params?: Record<string, string>;
  /** `id` of the response body, when it has one */
  responseId?: string;
  /** `id` of the request body, when it has one */
  requestId?: string;
}

/**
 * Attribution rule: a write under a parent route (`POST /v2/rcas/:id/actions`, `POST /v2/rcas/:id/links`,
 * `:id/approve`, ...) is logged against the PARENT — entityType of the first route segment with the
 * `:id` of the route — so `GET /audit-logs?entityType=RCA&entityId=<case>` lists everything done to the
 * case; the sub-resource kind and the created child's id go to the details. A plain collection route
 * (`POST /units`, `PATCH /v2/rca-actions/:id`) is attributed to the record itself, preferring the
 * response id, then the route id, then the request body id.
 */
export function resolveAuditTarget(input: AuditTargetInput): AuditTarget {
  const entityType = resolveEntityType(input.path);
  const routeId = input.params?.id;
  const segments = normalizedSegments(input.path);
  if (routeId && segments.length >= 3 && segments[1] === routeId) {
    const childId =
      input.responseId && input.responseId !== routeId
        ? input.responseId
        : undefined;
    return {
      entityType,
      entityId: routeId,
      subresource: { kind: segments[2], id: childId },
    };
  }
  return {
    entityType,
    entityId: input.responseId || routeId || input.requestId || 'unknown',
  };
}

function normalizedSegments(path: string): string[] {
  return path
    .split('?')[0]
    .replace(/^\/api\/?/, '')
    .replace(/^v\d+\//, '')
    .split('/')
    .filter(Boolean);
}
