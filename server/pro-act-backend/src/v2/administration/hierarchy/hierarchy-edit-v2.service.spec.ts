import { RequestContext } from '../../../common/context/request-context';
import { Organization } from '../../../organization/organization.entity';
import { OrganizationService } from '../../../organization/organization.service';
import { Tenant } from '../../../tenant/tenant.entity';
import { HierarchyEditV2Service } from './hierarchy-edit-v2.service';
import { HierarchyV2Service } from './hierarchy-v2.service';
import { PlantV2View } from './hierarchy-v2.view';
import { PlantTimezoneUsage, timezoneLockReason } from './plant-timezone-lock';

const ORG = 'org-1';
const OTHER_ORG = 'org-2';
const PLANT = 'plant-1';
const NO_USAGE: PlantTimezoneUsage = {
  productionEvents: 0,
  signalSamples: 0,
  calculatedPeriods: 0,
};

function context(patch: Partial<RequestContext> = {}): RequestContext {
  return {
    userId: 'u1',
    tenantId: PLANT,
    organizationId: ORG,
    legacyRole: 'OrgAdmin',
    roles: ['OrgAdmin'],
    scopes: [],
    isSuperAdmin: false,
    correlationId: 'c1',
    ...patch,
  };
}

function organization(id = ORG): Organization {
  return {
    id,
    code: 'O1',
    name: 'Org One',
    isActive: true,
    rowVersion: 3,
  } as Organization;
}

function plant(): Tenant {
  return {
    id: PLANT,
    code: 'P1',
    name: 'Plant One',
    organizationId: ORG,
    timezone: 'UTC',
    rowVersion: 5,
  } as Tenant;
}

function setup(options: { usage?: PlantTimezoneUsage; affected?: number }) {
  const updates: Array<Record<string, unknown>> = [];
  const queries: string[] = [];
  const manager = {
    query: jest.fn((sql: string) => {
      queries.push(sql);
      return Promise.resolve(
        sql.includes('production_events') ? [options.usage ?? NO_USAGE] : [],
      );
    }),
    createQueryBuilder: () => {
      const chain = {
        update: () => chain,
        set: (values: Record<string, unknown>) => {
          updates.push(values);
          return chain;
        },
        where: () => chain,
        execute: () => Promise.resolve({ affected: options.affected ?? 1 }),
      };
      return chain;
    },
    transaction: <T>(work: (m: unknown) => Promise<T>) => work(manager),
  };
  const organizationService = {
    findOneVisible: jest.fn((_ctx: RequestContext, id: string) =>
      Promise.resolve(organization(id)),
    ),
  };
  const hierarchy = {
    getPlant: jest.fn(
      (ctx: RequestContext): Promise<PlantV2View> =>
        Promise.resolve({
          id: PLANT,
          canEdit: ctx.isSuperAdmin || ctx.organizationId === ORG,
        } as PlantV2View),
    ),
  };
  const service = new HierarchyEditV2Service(
    { manager } as never,
    { manager, findOne: () => Promise.resolve(plant()) } as never,
    organizationService as unknown as OrganizationService,
    hierarchy as unknown as HierarchyV2Service,
  );
  return { service, updates, queries };
}

describe('HierarchyEditV2Service', () => {
  it('lets an organization administrator rename its own organization (trimmed, changed fields only)', async () => {
    const { service, updates } = setup({});
    await service.updateOrganization(context(), ORG, 3, {
      name: '  Org 1 ',
      description: '',
    });
    // the description was already empty: only the name changes
    expect(updates).toEqual([{ name: 'Org 1' }]);
  });

  it('refuses another organization (403) and a stale revision (412)', async () => {
    const { service, updates } = setup({});
    await expect(
      service.updateOrganization(context(), OTHER_ORG, 3, { name: 'X' }),
    ).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_NOT_ALLOWED' },
    });
    await expect(
      service.updateOrganization(context(), ORG, 2, { name: 'X' }),
    ).rejects.toMatchObject({ response: { code: 'STALE_REVISION' } });
    expect(updates).toEqual([]);
  });

  it('answers 412 when the row changed between the read and the conditional update', async () => {
    const { service } = setup({ affected: 0 });
    await expect(
      service.updateOrganization(context(), ORG, 3, { name: 'X' }),
    ).rejects.toMatchObject({ status: 412 });
  });

  it('changes an unused plant time zone and moves the default site with it', async () => {
    const { service, updates, queries } = setup({});
    const view = await service.updatePlant(context(), PLANT, 5, {
      timezone: 'Asia/Tehran',
    });
    expect(updates).toEqual([{ timezone: 'Asia/Tehran' }]);
    expect(queries.some((sql) => sql.includes('UPDATE "sites"'))).toBe(true);
    expect(view).toMatchObject({
      timezoneEditable: true,
      timezoneLockedReason: null,
    });
  });

  it('refuses a time zone change once the plant has data (409 with counts), never an unknown zone', async () => {
    const usage = {
      productionEvents: 12,
      signalSamples: 0,
      calculatedPeriods: 2,
    };
    const { service, updates } = setup({ usage });
    await expect(
      service.updatePlant(context(), PLANT, 5, { timezone: 'Europe/Berlin' }),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'TIMEZONE_LOCKED', details: { productionEvents: 12 } },
    });
    await expect(
      service.updatePlant(context(), PLANT, 5, { timezone: 'Mars/Base' }),
    ).rejects.toMatchObject({ response: { code: 'INVALID_TIMEZONE' } });
    // the current zone is no change: name edits still save on a locked plant
    await service.updatePlant(context(), PLANT, 5, {
      name: 'Plant 1',
      timezone: 'UTC',
    });
    expect(updates).toEqual([{ name: 'Plant 1' }]);
  });

  it('reports the lock on read to editors only', async () => {
    const usage = {
      productionEvents: 1,
      signalSamples: 1,
      calculatedPeriods: 0,
    };
    const editor = setup({ usage });
    expect(await editor.service.getPlant(context(), PLANT)).toMatchObject({
      timezoneEditable: false,
      timezoneLockedReason: timezoneLockReason(usage),
    });
    const reader = setup({ usage });
    const view = await reader.service.getPlant(
      context({ organizationId: OTHER_ORG }),
      PLANT,
    );
    expect(view).toMatchObject({
      timezoneEditable: false,
      timezoneLockedReason: null,
    });
    expect(reader.queries).toEqual([]);
  });
});

describe('timezoneLockReason', () => {
  it('names the kinds on read and the capped counts in the refusal', () => {
    expect(timezoneLockReason(NO_USAGE)).toBeNull();
    const usage = {
      productionEvents: 1,
      signalSamples: 10_000,
      calculatedPeriods: 3,
    };
    expect(timezoneLockReason(usage)).toContain(
      'production events, signal samples and calculated periods',
    );
    expect(timezoneLockReason(usage, true)).toContain(
      '1 production event, 10,000+ signal samples and 3 calculated periods',
    );
  });
});
