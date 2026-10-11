import { ForbiddenException } from '@nestjs/common';
import { RequestContext } from '../common/context/request-context';
import { rolesForLegacyRole } from '../auth/roles/role-model';
import { User } from './user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

const stored: User = {
  id: 'u-1',
  name: 'Ana',
  email: 'ana@test.local',
  passwordHash: '$2a$10$secret',
  role: 'Engineer',
  isActive: true,
  tenantId: 'tenant-1',
  organizationId: 'org-1',
  createdAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-10-01T00:00:00Z'),
};

function context(
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

function hasPasswordHash(value: unknown): boolean {
  return JSON.stringify(value)?.includes('passwordHash') ?? false;
}

describe('UsersController', () => {
  const service = {
    findAll: jest.fn().mockResolvedValue([stored, { ...stored, id: 'u-2' }]),
    findById: jest.fn().mockResolvedValue(stored),
    findAssignable: jest.fn().mockResolvedValue([{ id: 'u-1', name: 'Ana' }]),
    create: jest.fn().mockResolvedValue(stored),
    update: jest.fn().mockResolvedValue(stored),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const controller = new UsersController(service as unknown as UsersService);
  const admin = context('TenantAdmin');

  beforeEach(() => jest.clearAllMocks());

  it('never returns passwordHash from any user-returning route', async () => {
    const responses = await Promise.all([
      controller.findAll(),
      controller.findOne('u-1'),
      controller.findAssignable(admin),
      controller.create(admin, {
        name: 'New',
        email: 'new@test.local',
        password: 'pw',
        role: 'Engineer',
      }),
      controller.update(admin, 'u-1', { name: 'Ana B' }),
    ]);
    for (const response of responses) {
      expect(hasPasswordHash(response)).toBe(false);
    }
    expect(responses[0]).toHaveLength(2);
    expect(responses[1]).toMatchObject({ id: 'u-1', email: 'ana@test.local' });
  });

  it('places a new user into the caller tenant and organization and refuses roles above the caller', async () => {
    await controller.create(admin, {
      name: 'New',
      email: 'new@test.local',
      password: 'pw',
      role: 'Operator',
    });
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        organizationId: 'org-1',
      }),
    );
    await expect(
      controller.create(admin, {
        name: 'New',
        email: 'new@test.local',
        password: 'pw',
        role: 'OrgAdmin',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.create).toHaveBeenCalledTimes(1);
  });

  it('refuses a promotion above the caller on PUT but allows a change within rank', async () => {
    await expect(
      controller.update(admin, 'u-1', { role: 'OrgAdmin' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await controller.update(admin, 'u-1', { role: 'TenantAdmin' });
    await controller.update(admin, 'u-1', { role: 'Engineer', name: 'Ana' });
    expect(service.update).toHaveBeenCalledTimes(2);
  });

  it('refuses editing or deleting a peer or a user of another tenant', async () => {
    service.findById.mockResolvedValueOnce({ ...stored, role: 'TenantAdmin' });
    await expect(
      controller.update(admin, 'u-1', { name: 'x' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    service.findById.mockResolvedValueOnce({ ...stored, role: 'TenantAdmin' });
    await expect(controller.remove(admin, 'u-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    service.findById.mockResolvedValueOnce({ ...stored, tenantId: 'tenant-2' });
    await expect(controller.remove(admin, 'u-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(service.update).not.toHaveBeenCalled();
    expect(service.remove).not.toHaveBeenCalled();
    await controller.remove(admin, 'u-1');
    expect(service.remove).toHaveBeenCalledWith('u-1');
  });

  it('reads the assignable list for the acting tenant only', async () => {
    await controller.findAssignable(context('Operator'));
    expect(service.findAssignable).toHaveBeenCalledWith('tenant-1');
    await expect(
      controller.findAssignable(context('Operator', { tenantId: null })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
