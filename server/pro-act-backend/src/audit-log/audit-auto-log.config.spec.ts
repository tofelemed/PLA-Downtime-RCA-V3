import {
  resolveAuditTarget,
  resolveEntityType,
  shouldSkipAudit,
} from './audit-auto-log.config';

describe('audit auto-log route mapping', () => {
  it('maps v1 and v2 RCA routes to their entity types', () => {
    expect(resolveEntityType('/api/rcas/1')).toBe('RCA');
    expect(resolveEntityType('/api/v2/rcas/1/links')).toBe('RCA');
    expect(resolveEntityType('/api/v2/rca-actions/1')).toBe('RCAAction');
    expect(resolveEntityType('/api/v2/production-events/1/rca-link')).toBe(
      'ProductionEvent',
    );
  });

  it('audits writes only and keeps the skip list for versioned paths', () => {
    expect(shouldSkipAudit('/api/v2/rcas', 'GET')).toBe(true);
    expect(shouldSkipAudit('/api/v2/rcas', 'POST')).toBe(false);
    expect(shouldSkipAudit('/api/v2/reports/waterfall', 'POST')).toBe(true);
  });
});

describe('resolveAuditTarget (attribution of sub-resource writes)', () => {
  const caseId = '7b0d3f3e-7c3a-4a43-9a51-5f3e2f0b1c2d';
  const actionId = '0f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f';

  it('attributes POST /v2/rcas/:id/actions to the case with the action in the sub-resource', () => {
    expect(
      resolveAuditTarget({
        path: '/api/v2/rcas/' + caseId + '/actions',
        params: { id: caseId },
        responseId: actionId,
      }),
    ).toEqual({
      entityType: 'RCA',
      entityId: caseId,
      subresource: { kind: 'actions', id: actionId },
    });
  });

  it('attributes POST /v2/rcas/:id/links to the case even without a response id', () => {
    expect(
      resolveAuditTarget({
        path: '/api/v2/rcas/' + caseId + '/links?x=1',
        params: { id: caseId },
      }),
    ).toEqual({
      entityType: 'RCA',
      entityId: caseId,
      subresource: { kind: 'links', id: undefined },
    });
  });

  it('attributes an action route (:id/approve) to the record without a child id', () => {
    expect(
      resolveAuditTarget({
        path: '/api/v2/production-plans/' + caseId + '/approve',
        params: { id: caseId },
        responseId: caseId,
      }),
    ).toEqual({
      entityType: 'ProductionPlan',
      entityId: caseId,
      subresource: { kind: 'approve', id: undefined },
    });
  });

  it('keeps collection routes on the record itself: response id, then route id, then body id', () => {
    expect(
      resolveAuditTarget({ path: '/api/units', responseId: actionId }),
    ).toEqual({ entityType: 'Unit', entityId: actionId });
    expect(
      resolveAuditTarget({
        path: '/api/v2/rca-actions/' + actionId,
        params: { id: actionId },
      }),
    ).toEqual({ entityType: 'RCAAction', entityId: actionId });
    expect(
      resolveAuditTarget({ path: '/api/units', requestId: actionId }),
    ).toEqual({ entityType: 'Unit', entityId: actionId });
    expect(resolveAuditTarget({ path: '/api/units' })).toEqual({
      entityType: 'Unit',
      entityId: 'unknown',
    });
  });

  it('ignores a route parameter that is not the parent id (`:key/value`, `:tenantId/import`)', () => {
    expect(
      resolveAuditTarget({
        path: '/api/app-settings/theme/value',
        params: { key: 'theme' },
        responseId: actionId,
      }),
    ).toEqual({ entityType: 'AppSettings', entityId: actionId });
  });
});
