import { ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RequestContext } from '../../../common/context/request-context';
import { ValidationFailedException } from '../../../common/errors/validation-failed.exception';
import { createValidationPipe } from '../../../common/validation/validation-pipe.factory';
import { GrantUserScopeDto } from '../user-scopes/user-scopes-v2.dto';
import { PlantUserDirectory } from './plant-user-directory';
import {
  assertMayEditProfile,
  isFromOtherPlant,
  mayManageAccess,
  permissionsOf,
} from './user-manage-rules';

const ID = '7b0d3f3e-7c3a-4a43-9a51-5f3e2f0b1c2d';

function context(
  roles: string[],
  overrides: Partial<RequestContext> = {},
): RequestContext {
  return {
    userId: 'caller',
    tenantId: 'plant-a',
    organizationId: 'org',
    legacyRole: roles[0],
    roles,
    scopes: [],
    isSuperAdmin: false,
    correlationId: 'c',
    ...overrides,
  };
}

const member = {
  id: 'u1',
  role: 'Operator',
  tenantId: 'plant-a',
  organizationId: 'org',
};
const grantee = { ...member, id: 'u2', tenantId: 'plant-b' };
const admin = context(['TenantAdmin', 'manager_approver']);

describe('users granted in from another plant: rules', () => {
  it('tells home members from users of another plant', () => {
    expect(isFromOtherPlant(admin, member)).toBe(false);
    expect(isFromOtherPlant(admin, grantee)).toBe(true);
    expect(isFromOtherPlant(admin, { tenantId: null })).toBe(false);
  });

  it('keeps profile changes with the home plant, except for a super administrator', () => {
    expect(() => assertMayEditProfile(admin, member)).not.toThrow();
    expect(() => assertMayEditProfile(admin, grantee)).toThrow(
      ForbiddenException,
    );
    try {
      assertMayEditProfile(admin, grantee);
    } catch (error) {
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'HOME_PLANT_ONLY',
      });
    }
    const superAdmin = context(['SuperAdmin'], { isSuperAdmin: true });
    expect(() => assertMayEditProfile(superAdmin, grantee)).not.toThrow();
    const orgAdmin = context(['OrgAdmin']);
    expect(() => assertMayEditProfile(orgAdmin, grantee)).toThrow(
      ForbiddenException,
    );
  });

  it('lets the caller manage the access of users ranked below it, never its own', () => {
    expect(mayManageAccess(admin, grantee)).toBe(true);
    expect(mayManageAccess(admin, { ...grantee, role: 'TenantAdmin' })).toBe(
      false,
    );
    expect(mayManageAccess(admin, { ...grantee, id: 'caller' })).toBe(false);
    expect(permissionsOf(admin, grantee)).toEqual({
      manageable: false,
      accessManageable: true,
    });
    expect(permissionsOf(admin, member)).toEqual({
      manageable: true,
      accessManageable: true,
    });
  });

  it('accepts a grant for a user id or an exact e-mail', async () => {
    const pipe = createValidationPipe();
    const validate = (payload: Record<string, unknown>) =>
      pipe.transform(payload, { type: 'body', metatype: GrantUserScopeDto });
    await expect(validate({ userId: ID, role: 'viewer' })).resolves.toEqual(
      expect.objectContaining({ userId: ID }),
    );
    await expect(
      validate({ email: 'grace@acme.com', role: 'viewer' }),
    ).resolves.toEqual(expect.objectContaining({ email: 'grace@acme.com' }));
    await expect(validate({ role: 'viewer' })).rejects.toBeInstanceOf(
      ValidationFailedException,
    );
    await expect(
      validate({ email: 'grace', role: 'viewer' }),
    ).rejects.toBeInstanceOf(ValidationFailedException);
  });
});

describe('PlantUserDirectory', () => {
  function capture(): {
    directory: PlantUserDirectory;
    calls: Array<{ sql: string; params: unknown[] }>;
  } {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const dataSource = {
      query: (sql: string, params: unknown[]) => {
        calls.push({ sql, params });
        return Promise.resolve([]);
      },
    } as unknown as DataSource;
    return { directory: new PlantUserDirectory(dataSource), calls };
  }

  it('reads members only through the checked directory function, with the given tenant', async () => {
    const { directory, calls } = capture();
    await directory.page(
      { kind: 'plant', tenantId: 'plant-a', organizationId: 'org' },
      {
        q: '50%_off',
        searchEmail: true,
        roles: ['Operator'],
        isActive: true,
        sort: { field: 'name', direction: 'ASC' },
        limit: 20,
      },
    );
    const [{ sql, params }] = calls;
    expect(sql).toContain('app_plant_user_directory($1::uuid)');
    expect(sql).toContain('"u"."tenant_id" IS NULL');
    expect(sql).not.toContain('password_hash');
    expect(params).toEqual([
      'plant-a',
      'org',
      '%50\\%\\_off%',
      ['Operator'],
      true,
      21,
    ]);
  });

  it('skips the query for an empty id list and finds by e-mail through the organization function', async () => {
    const { directory, calls } = capture();
    await expect(directory.members('plant-a', [])).resolves.toEqual([]);
    expect(calls).toHaveLength(0);
    await expect(
      directory.byEmail('plant-a', 'grace@acme.com'),
    ).resolves.toBeUndefined();
    expect(calls[0].sql).toContain('app_organization_user_by_email');
    expect(calls[0].params).toEqual(['plant-a', 'grace@acme.com']);
  });
});
