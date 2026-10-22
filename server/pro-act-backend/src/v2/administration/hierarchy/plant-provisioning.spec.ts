import { EntityManager } from 'typeorm';
import { RequestContext } from '../../../common/context/request-context';
import { Tenant } from '../../../tenant/tenant.entity';
import { provisionPlant } from './plant-provisioning';

const PLANT = '11111111-1111-4111-8111-111111111111';
const ORG = '22222222-2222-4222-8222-222222222222';
const USER = '55555555-5555-4555-8555-555555555555';

function plant(timezone: string | null = 'Asia/Tehran'): Tenant {
  return {
    id: PLANT,
    name: 'Marun',
    organizationId: ORG,
    timezone,
  } as Tenant;
}

function creator(patch: Partial<RequestContext> = {}): RequestContext {
  return {
    userId: USER,
    tenantId: '66666666-6666-4666-8666-666666666666',
    organizationId: ORG,
    legacyRole: 'OrgAdmin',
    roles: ['OrgAdmin'],
    scopes: [],
    isSuperAdmin: false,
    correlationId: 'c1',
    ...patch,
  };
}

function setup() {
  const inserted: Array<Record<string, unknown>> = [];
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const builder = {
    insert: () => builder,
    values: (values: Record<string, unknown>) => {
      inserted.push(values);
      return builder;
    },
    orIgnore: () => builder,
    execute: () => Promise.resolve({}),
  };
  const sites = {
    findOne: () => Promise.resolve(null),
    findOneOrFail: () => Promise.resolve({ id: 'site-1' }),
    createQueryBuilder: () => builder,
  };
  const manager = {
    getRepository: () => sites,
    query: jest.fn((sql: string, params: unknown[]) => {
      queries.push({ sql, params });
      return Promise.resolve([]);
    }),
  } as unknown as EntityManager;
  return { manager, inserted, queries };
}

describe('provisionPlant', () => {
  it('creates the default site and grants no role (OrgAdmin reaches its plants by organization)', async () => {
    const { manager, inserted, queries } = setup();
    await provisionPlant(manager, plant(), creator());
    expect(inserted).toEqual([
      expect.objectContaining({
        tenantId: PLANT,
        organizationId: ORG,
        name: 'Marun',
        timezone: 'Asia/Tehran',
        timezoneFallback: false,
        operationalDayStart: '06:00',
        isDefault: true,
        createdBy: USER,
      }),
    ]);
    expect(queries).toHaveLength(0);
  });

  it('falls back to UTC for a plant without a valid time zone', async () => {
    const { manager, inserted, queries } = setup();
    await provisionPlant(
      manager,
      plant(null),
      creator({ isSuperAdmin: true, legacyRole: 'SuperAdmin' }),
    );
    expect(inserted[0]).toMatchObject({
      timezone: 'UTC',
      timezoneFallback: true,
    });
    expect(queries).toHaveLength(0);
  });

  it('records no creator for an identity without a user id', async () => {
    const { manager, inserted } = setup();
    await provisionPlant(manager, plant(), creator({ userId: 'service' }));
    expect(inserted[0]).toMatchObject({ createdBy: null });
  });
});
