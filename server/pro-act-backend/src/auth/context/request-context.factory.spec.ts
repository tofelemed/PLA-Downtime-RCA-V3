import { Repository } from 'typeorm';
import { ScopeGrant } from '../../common/context/request-context';
import { Tenant } from '../../tenant/tenant.entity';
import { User } from '../../users/user.entity';
import { actingDelegation } from '../delegations/acting-delegation';
import { holdsAnyRoleOnUnit } from '../roles/unit-roles';
import { AccessDenialAuditService } from '../scopes/access-denial-audit.service';
import { UserScopesService } from '../scopes/user-scopes.service';
import { RequestContextFactory } from './request-context.factory';

const HOME = '10000000-0000-4000-8000-000000000001';
const SELECTED = '20000000-0000-4000-8000-000000000002';
const UNIT = { id: 'allowed-unit', siteId: null };
const OTHER = { id: 'other-unit', siteId: null };

function factory(scopes: ScopeGrant[], sameOrganization = true) {
  return new RequestContextFactory(
    {
      grantsForUser: jest.fn().mockResolvedValue(scopes),
    } as unknown as UserScopesService,
    { record: jest.fn() } as unknown as AccessDenialAuditService,
    {
      countBy: jest.fn().mockResolvedValue(sameOrganization ? 1 : 0),
    } as unknown as Repository<Tenant>,
    {} as Repository<User>,
  );
}

function input(role = 'Manager', selectedTenant = SELECTED) {
  return {
    payload: {
      sub: 'fixture-user',
      email: 'fixture@example.invalid',
      role,
      tenantId: HOME,
      organizationId: 'home-org',
    },
    selectedTenant,
    correlationId: 'scope-provenance',
  };
}

function grants(delegated = false): ScopeGrant[] {
  return [
    { kind: 'tenant', id: SELECTED, tenantId: SELECTED, role: 'viewer' },
    {
      kind: 'unit',
      id: UNIT.id,
      tenantId: SELECTED,
      role: 'manager_approver',
      ...(delegated
        ? { delegationId: 'delegation-1', delegatorId: 'delegator-1' }
        : {}),
    },
  ];
}

describe('RequestContextFactory legacy role provenance', () => {
  it('does not turn a matching foreign-unit role into the home legacy role', async () => {
    const context = await factory(grants()).build(input());
    expect(context.roles).toContain('manager_approver');
    expect(context.legacyRole).toBeNull();
    expect(holdsAnyRoleOnUnit(context, UNIT, ['manager_approver'])).toBe(true);
    expect(holdsAnyRoleOnUnit(context, OTHER, ['manager_approver'])).toBe(
      false,
    );
  });

  it('records the foreign-unit delegation even when its role matches the home mapping', async () => {
    const context = await factory(grants(true)).build(input());
    expect(actingDelegation(context, ['manager_approver'], UNIT)).toEqual({
      delegationId: 'delegation-1',
      delegatorId: 'delegator-1',
      role: 'manager_approver',
    });
  });

  it('preserves the legacy role in its home plant', async () => {
    const context = await factory([]).build(input('Manager', HOME));
    expect(context.legacyRole).toBe('Manager');
    expect(holdsAnyRoleOnUnit(context, OTHER, ['manager_approver'])).toBe(true);
  });

  it('preserves OrgAdmin only inside its own organization', async () => {
    const within = await factory(grants()).build(input('OrgAdmin'));
    expect(within.legacyRole).toBe('OrgAdmin');
    expect(holdsAnyRoleOnUnit(within, OTHER, ['quality_approver'])).toBe(true);
    const outside = await factory(grants(), false).build(input('OrgAdmin'));
    expect(outside.legacyRole).toBeNull();
    expect(holdsAnyRoleOnUnit(outside, OTHER, ['quality_approver'])).toBe(
      false,
    );
  });

  it('preserves SuperAdmin in an existing selected plant', async () => {
    const context = await factory([]).build(input('SuperAdmin'));
    expect(context.legacyRole).toBe('SuperAdmin');
    expect(holdsAnyRoleOnUnit(context, OTHER, ['metrology_approver'])).toBe(
      true,
    );
  });
});

describe('RequestContextFactory: guide roles only (QA audit 2026-10-19)', () => {
  const own = (
    role: string,
    kind: ScopeGrant['kind'] = 'tenant',
  ): ScopeGrant => ({
    kind,
    id: kind === 'tenant' ? HOME : UNIT.id,
    tenantId: HOME,
    role,
  });

  it('an Analyst with an explicit finance_approver grant is not a production engineer', async () => {
    const context = await factory([own('finance_approver')]).build(
      input('Analyst', HOME),
    );
    expect(context.roles).toEqual(['Analyst', 'finance_approver']);
    expect(holdsAnyRoleOnUnit(context, OTHER, ['production_engineer'])).toBe(
      false,
    );
  });

  it('keeps the D06 mapping while the user holds no own grant in the plant', async () => {
    const context = await factory([]).build(input('Analyst', HOME));
    expect(context.roles).toEqual(['Analyst', 'production_engineer']);
  });

  it('a delegated grant alone does not replace the legacy mapping', async () => {
    const delegated: ScopeGrant = {
      ...own('quality_approver'),
      delegationId: 'd-1',
      delegatorId: 'p-1',
    };
    const context = await factory([delegated]).build(input('Analyst', HOME));
    expect(context.roles).toContain('production_engineer');
  });

  it('a unit-scoped grant of the mapped role is not widened to the whole plant', async () => {
    const context = await factory([own('production_engineer', 'unit')]).build(
      input('Engineer', HOME),
    );
    expect(holdsAnyRoleOnUnit(context, UNIT, ['production_engineer'])).toBe(
      true,
    );
    expect(holdsAnyRoleOnUnit(context, OTHER, ['production_engineer'])).toBe(
      false,
    );
  });
});
