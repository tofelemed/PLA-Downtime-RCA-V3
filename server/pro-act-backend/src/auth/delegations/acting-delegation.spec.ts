import { RequestContext } from '../../common/context/request-context';
import { actingDelegation } from './acting-delegation';

const T = 'tenant-a';
const unit = { id: 'unit-1', siteId: 'site-1' };
const context = (patch: Partial<RequestContext>): RequestContext => ({
  userId: 'deputy',
  tenantId: T,
  organizationId: null,
  legacyRole: 'Operator',
  roles: ['Operator', 'operator', 'manager_approver'],
  scopes: [],
  isSuperAdmin: false,
  correlationId: 'c',
  ...patch,
});
const delegated = {
  kind: 'tenant' as const,
  id: T,
  role: 'manager_approver',
  tenantId: T,
  delegationId: 'd1',
  delegatorId: 'manager',
};

/** SME R1 / R6: a decision taken only through a delegation names it; one taken on own authority does not. */
describe('actingDelegation', () => {
  const roles = ['manager_approver', 'production_accountant'];

  it('names the delegation when the role comes only from it', () => {
    expect(
      actingDelegation(context({ scopes: [delegated] }), roles, unit),
    ).toEqual({
      delegationId: 'd1',
      delegatorId: 'manager',
      role: 'manager_approver',
    });
  });

  it('is null when an own grant or the legacy role covers the unit', () => {
    const own = {
      kind: 'unit' as const,
      id: 'unit-1',
      role: 'production_accountant',
      tenantId: T,
    };
    expect(
      actingDelegation(context({ scopes: [delegated, own] }), roles, unit),
    ).toBeNull();
    expect(
      actingDelegation(
        context({
          legacyRole: 'Manager',
          roles: ['Manager', 'manager_approver'],
          scopes: [delegated],
        }),
        roles,
        unit,
      ),
    ).toBeNull();
  });

  it('a delegation on another unit does not count', () => {
    const elsewhere = { ...delegated, kind: 'unit' as const, id: 'unit-2' };
    expect(
      actingDelegation(context({ scopes: [elsewhere] }), roles, unit),
    ).toBeNull();
  });
});
