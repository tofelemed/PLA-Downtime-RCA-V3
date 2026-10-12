import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { rolesForLegacyRole } from '../auth/roles/role-model';
import { RequestContext } from '../common/context/request-context';
import { RealtimeGateway } from '../realtime.gateway';
import { Tenant } from './tenant.entity';
import { TenantService } from './tenant.service';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

function caller(
  legacyRole: string,
  overrides: Partial<RequestContext> = {},
): RequestContext {
  return {
    userId: 'caller',
    tenantId: TENANT_A,
    organizationId: 'org-1',
    legacyRole,
    roles: rolesForLegacyRole(legacyRole),
    scopes: [],
    isSuperAdmin: legacyRole === 'SuperAdmin',
    correlationId: 'c',
    ...overrides,
  };
}

function tenantRow(id: string): Tenant {
  return {
    id,
    code: id,
    name: id,
    organizationId: 'org-1',
    isActive: true,
    calendarSystem: 'gregorian',
    digits: 'latin',
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

function setup() {
  const rows = new Map([TENANT_A, TENANT_B].map((id) => [id, tenantRow(id)]));
  const repository = {
    findOneBy: jest.fn(({ id }: { id: string }) => {
      const row = rows.get(id);
      return Promise.resolve(row ? { ...row } : null);
    }),
    update: jest.fn((id: string, changes: Partial<Tenant>) => {
      const row = rows.get(id);
      if (row) rows.set(id, { ...row, ...changes });
      return Promise.resolve({ affected: row ? 1 : 0 });
    }),
  };
  const gateway = { broadcastEntityEvent: jest.fn() };
  const service = new TenantService(
    repository as unknown as Repository<Tenant>,
    gateway as unknown as RealtimeGateway,
  );
  return { service, repository, gateway };
}

const PERSIAN = { calendarSystem: 'persian', digits: 'persian' } as const;

function errorOf(work: Promise<unknown>): Promise<unknown> {
  return work.then(
    () => undefined,
    (error: unknown) => error,
  );
}

describe('TenantService.updateDisplaySettings', () => {
  it.each([
    ['SuperAdmin', caller('SuperAdmin', { tenantId: null })],
    ['a TenantAdmin of the tenant', caller('TenantAdmin')],
    ['a Manager (manager_approver) of the tenant', caller('Manager')],
    ['an OrgAdmin acting in the tenant', caller('OrgAdmin')],
    [
      'a manager_approver scope role acting in the tenant',
      caller('Engineer', {
        roles: ['production_engineer', 'manager_approver'],
        scopes: [
          {
            kind: 'tenant',
            id: TENANT_A,
            role: 'manager_approver',
            tenantId: TENANT_A,
          },
        ],
      }),
    ],
  ])('lets %s change both fields', async (_label, ctx) => {
    const { service, gateway } = setup();
    const updated = await service.updateDisplaySettings(ctx, TENANT_A, PERSIAN);
    expect(updated).toMatchObject({ id: TENANT_A, ...PERSIAN });
    expect(gateway.broadcastEntityEvent).toHaveBeenCalledWith(
      'Updated',
      'tenant',
      expect.objectContaining({ id: TENANT_A, ...PERSIAN }),
    );
  });

  it.each([
    ['a production_engineer (Engineer)', caller('Engineer')],
    ['an Analyst', caller('Analyst')],
    ['an Operator', caller('Operator')],
  ])('refuses %s with FORBIDDEN_ROLE', async (_label, ctx) => {
    const { service, repository } = setup();
    const error = await errorOf(
      service.updateDisplaySettings(ctx, TENANT_A, PERSIAN),
    );
    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({
      code: 'FORBIDDEN_ROLE',
    });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('refuses a TenantAdmin of another tenant who is only a member of this one', async () => {
    const { service, repository } = setup();
    const ctx = caller('TenantAdmin', {
      tenantId: TENANT_B,
      scopes: [
        { kind: 'tenant', id: TENANT_A, role: 'viewer', tenantId: TENANT_A },
      ],
    });
    const error = await errorOf(
      service.updateDisplaySettings(ctx, TENANT_A, PERSIAN),
    );
    expect(error).toBeInstanceOf(ForbiddenException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('answers NOT_FOUND for a tenant the caller cannot see', async () => {
    const { service, repository } = setup();
    const ctx = caller('TenantAdmin', { tenantId: TENANT_B });
    const error = await errorOf(
      service.updateDisplaySettings(ctx, TENANT_A, PERSIAN),
    );
    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).getResponse()).toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('answers NOT_FOUND for an unknown tenant, even to a SuperAdmin', async () => {
    const { service } = setup();
    const error = await errorOf(
      service.updateDisplaySettings(caller('SuperAdmin'), 'missing', PERSIAN),
    );
    expect(error).toBeInstanceOf(NotFoundException);
  });

  it('updates only the fields sent', async () => {
    const { service, repository } = setup();
    const updated = await service.updateDisplaySettings(
      caller('TenantAdmin'),
      TENANT_A,
      { digits: 'persian' },
    );
    expect(repository.update).toHaveBeenCalledWith(TENANT_A, {
      digits: 'persian',
    });
    expect(updated).toMatchObject({
      calendarSystem: 'gregorian',
      digits: 'persian',
    });
  });

  it('returns the tenant unchanged for an empty body without writing', async () => {
    const { service, repository, gateway } = setup();
    const updated = await service.updateDisplaySettings(
      caller('TenantAdmin'),
      TENANT_A,
      {},
    );
    expect(updated).toMatchObject({
      calendarSystem: 'gregorian',
      digits: 'latin',
    });
    expect(repository.update).not.toHaveBeenCalled();
    expect(gateway.broadcastEntityEvent).not.toHaveBeenCalled();
  });
});
