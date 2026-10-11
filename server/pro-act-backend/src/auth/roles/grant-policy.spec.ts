import { ForbiddenException } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { rolesForLegacyRole } from './role-model';
import {
  assertCallerMayGrant,
  assertCallerMayManage,
  assertCallerMayPlace,
  memberTenantIds,
} from './grant-policy';

function caller(
  legacyRole: string,
  overrides: Partial<RequestContext> = {},
): RequestContext {
  return {
    userId: 'caller',
    tenantId: 'tenant-1',
    organizationId: 'org-1',
    legacyRole,
    roles: rolesForLegacyRole(legacyRole),
    scopes: [],
    isSuperAdmin: legacyRole === 'SuperAdmin',
    correlationId: 'c',
    ...overrides,
  };
}

const code = (work: () => void): string | undefined => {
  try {
    work();
    return undefined;
  } catch (error) {
    expect(error).toBeInstanceOf(ForbiddenException);
    return ((error as ForbiddenException).getResponse() as { code: string })
      .code;
  }
};

describe('assertCallerMayManage (PUT / DELETE /users/:id)', () => {
  const tenantAdmin = caller('TenantAdmin');

  it('refuses a peer: a TenantAdmin cannot edit or delete another TenantAdmin', () => {
    expect(
      code(() =>
        assertCallerMayManage(tenantAdmin, {
          role: 'TenantAdmin',
          tenantId: 'tenant-1',
          organizationId: 'org-1',
        }),
      ),
    ).toBe('ROLE_GRANT_NOT_ALLOWED');
    expect(
      code(() =>
        assertCallerMayManage(caller('OrgAdmin'), {
          role: 'OrgAdmin',
          organizationId: 'org-1',
        }),
      ),
    ).toBe('ROLE_GRANT_NOT_ALLOWED');
  });

  it('refuses a target above the caller', () => {
    expect(
      code(() =>
        assertCallerMayManage(tenantAdmin, {
          role: 'OrgAdmin',
          tenantId: 'tenant-1',
        }),
      ),
    ).toBe('ROLE_GRANT_NOT_ALLOWED');
  });

  it('allows a lower-ranked user of the acting tenant, refuses one of another tenant', () => {
    expect(
      code(() =>
        assertCallerMayManage(tenantAdmin, {
          role: 'Engineer',
          tenantId: 'tenant-1',
        }),
      ),
    ).toBeUndefined();
    expect(
      code(() =>
        assertCallerMayManage(tenantAdmin, {
          role: 'Engineer',
          tenantId: 'tenant-2',
        }),
      ),
    ).toBe('TENANT_NOT_ALLOWED');
  });

  it('OrgAdmin reaches its organization only; SuperAdmin reaches everyone', () => {
    const orgAdmin = caller('OrgAdmin');
    expect(
      code(() =>
        assertCallerMayManage(orgAdmin, {
          role: 'TenantAdmin',
          tenantId: 'tenant-9',
          organizationId: 'org-1',
        }),
      ),
    ).toBeUndefined();
    expect(
      code(() =>
        assertCallerMayManage(orgAdmin, {
          role: 'TenantAdmin',
          organizationId: 'org-2',
        }),
      ),
    ).toBe('ORGANIZATION_NOT_ALLOWED');
    expect(
      code(() =>
        assertCallerMayManage(caller('SuperAdmin'), { role: 'SuperAdmin' }),
      ),
    ).toBeUndefined();
  });
});

describe('assertCallerMayGrant (role on create or on a role change)', () => {
  it('refuses a promotion above the caller and allows up to its own rank', () => {
    const tenantAdmin = caller('TenantAdmin');
    expect(code(() => assertCallerMayGrant(tenantAdmin, 'OrgAdmin'))).toBe(
      'ROLE_GRANT_NOT_ALLOWED',
    );
    expect(code(() => assertCallerMayGrant(tenantAdmin, 'SuperAdmin'))).toBe(
      'ROLE_GRANT_NOT_ALLOWED',
    );
    expect(
      code(() => assertCallerMayGrant(tenantAdmin, 'TenantAdmin')),
    ).toBeUndefined();
    expect(
      code(() => assertCallerMayGrant(tenantAdmin, 'Operator')),
    ).toBeUndefined();
    expect(code(() => assertCallerMayGrant(tenantAdmin, 'nonsense'))).toBe(
      'ROLE_GRANT_NOT_ALLOWED',
    );
  });
});

describe('assertCallerMayPlace', () => {
  it('keeps non-SuperAdmins inside their acting tenant and organization', () => {
    const tenantAdmin = caller('TenantAdmin');
    expect(
      code(() => assertCallerMayPlace(tenantAdmin, { tenantId: 'tenant-1' })),
    ).toBeUndefined();
    expect(
      code(() => assertCallerMayPlace(tenantAdmin, { tenantId: 'tenant-2' })),
    ).toBe('TENANT_NOT_ALLOWED');
    expect(
      code(() =>
        assertCallerMayPlace(tenantAdmin, { organizationId: 'org-2' }),
      ),
    ).toBe('ORGANIZATION_NOT_ALLOWED');
    expect(
      code(() => assertCallerMayPlace(tenantAdmin, { tenantName: 'New' })),
    ).toBe('ORGANIZATION_CREATE_NOT_ALLOWED');
    expect(
      code(() =>
        assertCallerMayPlace(caller('SuperAdmin'), { tenantId: 'tenant-2' }),
      ),
    ).toBeUndefined();
  });
});

describe('memberTenantIds', () => {
  it('is the acting tenant plus every scope tenant, without duplicates', () => {
    const context = caller('Engineer', {
      scopes: [
        {
          kind: 'tenant',
          id: 'tenant-1',
          role: 'viewer',
          tenantId: 'tenant-1',
        },
        { kind: 'unit', id: 'u-1', role: 'operator', tenantId: 'tenant-3' },
      ],
    });
    expect(memberTenantIds(context).sort()).toEqual(['tenant-1', 'tenant-3']);
  });
});
