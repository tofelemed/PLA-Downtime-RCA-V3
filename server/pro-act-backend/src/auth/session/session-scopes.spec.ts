import { ScopeGrant } from '../../common/context/request-context';
import { tenantIdsOf, toSessionScopes } from './session-scopes';

const grant = (
  tenantId: string,
  role: string,
  kind: ScopeGrant['kind'] = 'tenant',
  id = tenantId,
): ScopeGrant => ({ tenantId, role, kind, id });

describe('toSessionScopes (login / profile scopes)', () => {
  it('maps a tenant-wide grant to one scope without unit or site limits', () => {
    expect(toSessionScopes([grant('t1', 'viewer')])).toEqual([
      { tenantId: 't1', role: 'viewer' },
    ]);
  });

  it('adds the organization of the tenant when known', () => {
    const organizations = new Map([['t1', 'org-a']]);
    expect(toSessionScopes([grant('t1', 'operator')], organizations)).toEqual([
      { tenantId: 't1', organizationId: 'org-a', role: 'operator' },
    ]);
  });

  it('lists the units of a unit-limited grant, each once', () => {
    const grants = [
      grant('t1', 'operator', 'unit', 'line-1'),
      grant('t1', 'operator', 'unit', 'line-1'),
      grant('t1', 'operator', 'unit', 'line-2'),
    ];
    expect(toSessionScopes(grants)).toEqual([
      { tenantId: 't1', role: 'operator', unitIds: ['line-1', 'line-2'] },
    ]);
  });

  it('lists the sites of a site-limited grant', () => {
    expect(toSessionScopes([grant('t1', 'viewer', 'site', 'site-1')])).toEqual([
      { tenantId: 't1', role: 'viewer', siteIds: ['site-1'] },
    ]);
  });

  it('a tenant-wide row makes the role tenant-wide even next to unit rows', () => {
    const grants = [
      grant('t1', 'operator', 'unit', 'line-1'),
      grant('t1', 'operator'),
    ];
    expect(toSessionScopes(grants)).toEqual([
      { tenantId: 't1', role: 'operator' },
    ]);
  });

  it('keeps one scope per tenant and role, in order of first appearance', () => {
    const grants = [
      grant('t2', 'viewer'),
      grant('t1', 'production_engineer'),
      grant('t1', 'integration_admin'),
      grant('t2', 'viewer'),
    ];
    expect(
      toSessionScopes(grants).map((scope) => `${scope.tenantId}:${scope.role}`),
    ).toEqual(['t2:viewer', 't1:production_engineer', 't1:integration_admin']);
  });

  it('never carries anything but tenant, organization, role and limits', () => {
    const [scope] = toSessionScopes([grant('t1', 'viewer')]);
    expect(Object.keys(scope).sort()).toEqual(['role', 'tenantId']);
  });

  it('tenantIdsOf lists each tenant once', () => {
    expect(
      tenantIdsOf([grant('t1', 'a'), grant('t2', 'b'), grant('t1', 'c')]),
    ).toEqual(['t1', 't2']);
    expect(tenantIdsOf([])).toEqual([]);
  });
});
