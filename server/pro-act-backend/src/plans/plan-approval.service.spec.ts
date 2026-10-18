import { ForbiddenException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { RequestContext } from '../common/context/request-context';
import { PlanVersion } from './entities/plan-version.entity';
import { PlanApprovalService } from './plan-approval.service';
import { PlanVersionsService } from './plan-versions.service';

const TENANT = 'tenant-a';
const AUTHOR = 'user-author';
const OTHER = 'user-other-manager';

/** Thrown by the fake once the approval got past the separation-of-duties gate (slice read). */
class PastTheGate extends Error {}

function managerContext(userId: string, isSuperAdmin = false): RequestContext {
  return {
    userId,
    tenantId: TENANT,
    organizationId: null,
    legacyRole: isSuperAdmin ? 'SuperAdmin' : 'TenantAdmin',
    roles: ['manager_approver'],
    scopes: [
      {
        kind: 'tenant',
        id: TENANT,
        role: 'manager_approver',
        tenantId: TENANT,
      },
    ],
    isSuperAdmin,
    correlationId: 'test',
  };
}

/** An open version with generated periods, created by `createdBy` and edited by someone else. */
function openVersion(createdBy: string | null): PlanVersion {
  return {
    id: 'version-1',
    tenantId: TENANT,
    planId: 'plan-1',
    version: 1,
    scenarioId: 'scenario-1',
    unitId: 'unit-1',
    approvalState: 'draft',
    periodsGeneratedAt: new Date('2026-10-01T00:00:00Z'),
    createdBy,
    updatedBy: OTHER,
  } as unknown as PlanVersion;
}

function serviceOver(version: PlanVersion): PlanApprovalService {
  const manager = {
    query: () => Promise.resolve([]),
    findOne: () => Promise.resolve(version),
    findBy: () => Promise.reject(new PastTheGate()),
  } as unknown as EntityManager;
  const transaction = (work: (m: EntityManager) => Promise<unknown>) =>
    work(manager);
  const versions = {
    manager: { transaction },
  } as unknown as Repository<PlanVersion>;
  const plans = {
    getVersion: () => Promise.resolve(version),
  } as unknown as PlanVersionsService;
  return new PlanApprovalService(versions, plans);
}

function approve(version: PlanVersion, context: RequestContext) {
  return serviceOver(version)
    .approve(context, 'plan-1', { expectedVersion: 1 })
    .catch((e: unknown) => e);
}

describe('PlanApprovalService.approve — separation of duties (D06)', () => {
  it('refuses the creator of the version with 403 SEPARATION_OF_DUTIES', async () => {
    const error = await approve(openVersion(AUTHOR), managerContext(AUTHOR));
    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({
      code: 'SEPARATION_OF_DUTIES',
    });
  });

  it('lets SuperAdmin pass the author gate for their own version', async () => {
    const error = await approve(
      openVersion(AUTHOR),
      managerContext(AUTHOR, true),
    );
    expect(error).toBeInstanceOf(PastTheGate);
  });

  it('lets another manager approve, including one who only edited the draft', async () => {
    const error = await approve(openVersion(AUTHOR), managerContext(OTHER));
    expect(error).toBeInstanceOf(PastTheGate);
  });

  it('does not restrict a version without an author', async () => {
    const error = await approve(openVersion(null), managerContext(OTHER));
    expect(error).toBeInstanceOf(PastTheGate);
  });
});
