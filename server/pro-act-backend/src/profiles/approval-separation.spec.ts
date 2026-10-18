import { ForbiddenException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { RequestContext } from '../common/context/request-context';
import { FxRate } from '../valuation/entities/fx-rate.entity';
import { FxRatesService } from '../valuation/fx-rates.service';
import { ProductionProfile } from './entities/production-profile.entity';
import { UnitProductRate } from './entities/unit-product-rate.entity';
import { ValuationRate } from './entities/valuation-rate.entity';
import { ProfileReferences } from './profile-references';
import { ProfilesService } from './profiles.service';
import { RatesService } from './rates.service';
import { ValuationRatesService } from './valuation-rates.service';

jest.mock('../common/outbox/outbox-writer', () => ({
  enqueueOutbox: jest.fn(() => Promise.resolve()),
}));

const TENANT = 'tenant-a';
const AUTHOR = 'user-author';
const OTHER = 'user-other-manager';

/** A manager with a tenant-wide grant (D06 manager_approver), possibly a SuperAdmin. */
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

/** A draft version row of any versioned table, created by `createdBy`. */
function draftRow(createdBy: string | null): Record<string, unknown> {
  return {
    id: 'row-1',
    tenantId: TENANT,
    version: 1,
    state: 'draft',
    effectiveFrom: new Date('2026-10-01T00:00:00Z'),
    effectiveTo: null,
    approvedBy: null,
    approvedAt: null,
    createdBy,
    updatedBy: createdBy,
    rowVersion: 1,
    profileId: 'profile-1',
    impactCodeId: null,
    rateKind: 'sustained',
    basis: 'contribution_margin',
    quantityUom: 't',
    rateTimebase: 'h',
    fromCurrency: 'USD',
    toCurrency: 'IRR',
  };
}

/** Stand-in for the transaction manager `approveVersion` uses (row lock, family read, save). */
function fakeManager(row: Record<string, unknown>) {
  const qb = {
    setLock: () => qb,
    where: () => qb,
    andWhere: () => qb,
    getOne: () => Promise.resolve(row),
    getMany: () => Promise.resolve([]),
  };
  const save = jest.fn((saved: unknown) => Promise.resolve(saved));
  const manager = {
    getRepository: () => ({ metadata: { tableName: 'versioned' } }),
    query: () => Promise.resolve([]),
    createQueryBuilder: () => qb,
    save,
  };
  return { manager: manager as unknown as EntityManager, save };
}

/** Repository whose `transaction` runs the work on the fake manager. */
function repositoryOver<T extends object>(manager: EntityManager) {
  const transaction = (work: (m: EntityManager) => Promise<unknown>) =>
    work(manager);
  return { manager: { transaction } } as unknown as Repository<T>;
}

type Approve = (context: RequestContext) => Promise<{ approvedBy: unknown }>;

/** Builds the service under test over a row and returns its approve command. */
type Harness = (row: Record<string, unknown>) => {
  approve: Approve;
  save: jest.Mock;
};

function expectSeparationOfDuties(error: unknown): void {
  expect(error).toBeInstanceOf(ForbiddenException);
  expect((error as ForbiddenException).getResponse()).toMatchObject({
    code: 'SEPARATION_OF_DUTIES',
  });
}

function separationSuite(name: string, harness: Harness): void {
  describe(`${name} approve — separation of duties (D06)`, () => {
    it('refuses the draft author with 403 SEPARATION_OF_DUTIES and writes nothing', async () => {
      const { approve, save } = harness(draftRow(AUTHOR));
      const error = await approve(managerContext(AUTHOR)).catch(
        (e: unknown) => e,
      );
      expectSeparationOfDuties(error);
      expect(save).not.toHaveBeenCalled();
    });

    it('lets SuperAdmin approve their own draft and retains the actual approver', async () => {
      const { approve, save } = harness(draftRow(AUTHOR));
      const approved = await approve(managerContext(AUTHOR, true));
      expect(approved.approvedBy).toBe(AUTHOR);
      expect(save).toHaveBeenCalled();
    });

    it('lets another manager approve the draft', async () => {
      const { approve, save } = harness(draftRow(AUTHOR));
      const approved = await approve(managerContext(OTHER));
      expect(approved.approvedBy).toBe(OTHER);
      expect(save).toHaveBeenCalled();
    });

    it('does not restrict a draft without an author (system rows)', async () => {
      const { approve } = harness(draftRow(null));
      const approved = await approve(managerContext(OTHER));
      expect(approved.approvedBy).toBe(OTHER);
    });
  });
}

/** ProfilesService stand-in for the rate services: the profile is readable. */
function readableProfiles(): ProfilesService {
  return {
    get: () => Promise.resolve(draftRow(OTHER)),
  } as unknown as ProfilesService;
}

separationSuite('ProfilesService', (row) => {
  const { manager, save } = fakeManager(row);
  const service = new ProfilesService(
    repositoryOver<ProductionProfile>(manager),
    {} as ProfileReferences,
  );
  jest
    .spyOn(service, 'get')
    .mockResolvedValue(row as unknown as ProductionProfile);
  return { approve: (ctx) => service.approve(ctx, 'row-1', false), save };
});

separationSuite('RatesService', (row) => {
  const { manager, save } = fakeManager(row);
  const service = new RatesService(
    repositoryOver<UnitProductRate>(manager),
    readableProfiles(),
  );
  jest
    .spyOn(service, 'get')
    .mockResolvedValue(row as unknown as UnitProductRate);
  return { approve: (ctx) => service.approve(ctx, 'row-1', false), save };
});

separationSuite('ValuationRatesService', (row) => {
  const { manager, save } = fakeManager(row);
  const service = new ValuationRatesService(
    repositoryOver<ValuationRate>(manager),
    readableProfiles(),
    {} as ProfileReferences,
  );
  jest.spyOn(service, 'get').mockResolvedValue(row as unknown as ValuationRate);
  return { approve: (ctx) => service.approve(ctx, 'row-1', false), save };
});

separationSuite('FxRatesService', (row) => {
  const { manager, save } = fakeManager(row);
  const service = new FxRatesService(repositoryOver<FxRate>(manager));
  jest.spyOn(service, 'get').mockResolvedValue(row as unknown as FxRate);
  return {
    approve: async (ctx) => (await service.approve(ctx, 'row-1', false)).rate,
    save,
  };
});
