import { HttpException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { Site } from '../../calendar/entities/site.entity';
import { SitesService } from '../../calendar/sites.service';
import { RequestContext } from '../../common/context/request-context';
import { SitesListQueryDto } from './site-v2.dto';
import { SitesV2Service } from './sites-v2.service';

const PLANT = '11111111-1111-4111-8111-111111111111';
const ORG = '22222222-2222-4222-8222-222222222222';
const DEFAULT_ID = '33333333-3333-4333-8333-333333333333';
const NORTH_ID = '44444444-4444-4444-8444-444444444444';
const CREATED = new Date('2026-10-22T08:00:00.000Z');

function site(patch: Partial<Site>): Site {
  return {
    id: DEFAULT_ID,
    tenantId: PLANT,
    organizationId: ORG,
    name: 'Plant One',
    timezone: 'Asia/Tehran',
    timezoneFallback: false,
    operationalDayStart: '06:00:00',
    isDefault: true,
    rowVersion: 1,
    createdAt: CREATED,
    ...patch,
  } as Site;
}

function context(patch: Partial<RequestContext> = {}): RequestContext {
  return {
    userId: '55555555-5555-4555-8555-555555555555',
    tenantId: PLANT,
    organizationId: ORG,
    legacyRole: 'TenantAdmin',
    roles: ['TenantAdmin', 'manager_approver'],
    scopes: [],
    isSuperAdmin: false,
    correlationId: 'c1',
    ...patch,
  };
}

interface Options {
  rows?: Site[];
  nameTaken?: boolean;
  saveError?: Error;
  /** the plant has no default site until `SitesService.defaultSite` creates it */
  noDefaultYet?: boolean;
}

function setup(options: Options = {}) {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const saved: Site[] = [];
  let census = 0;
  const txRepository = {
    create: (value: Partial<Site>) => value as Site,
    save: jest.fn((value: Site) => {
      if (options.saveError) return Promise.reject(options.saveError);
      const row = {
        ...value,
        id: value.id ?? NORTH_ID,
        rowVersion: value.rowVersion ?? 1,
        createdAt: value.createdAt ?? CREATED,
      };
      saved.push(row);
      return Promise.resolve(row);
    }),
  };
  const manager = {
    query: jest.fn((sql: string, params: unknown[]) => {
      queries.push({ sql, params });
      if (sql.includes('FROM "tenants"'))
        return Promise.resolve([
          { organization_id: ORG, timezone: 'Asia/Tehran' },
        ]);
      if (sql.includes('lower("name")'))
        return Promise.resolve(options.nameTaken ? [{}] : []);
      if (sql.includes('FROM "units"'))
        return Promise.resolve([
          ...(options.noDefaultYet && census++ === 0
            ? []
            : [{ id: DEFAULT_ID, is_default: true, count: 3 }]),
          { id: NORTH_ID, is_default: false, count: 1 },
        ]);
      return Promise.resolve([]);
    }),
    transaction: <T>(work: (m: unknown) => Promise<T>) => work(manager),
    getRepository: () => txRepository,
  };
  const chain = {
    where: () => chain,
    andWhere: () => chain,
    orderBy: () => chain,
    addOrderBy: () => chain,
    limit: () => chain,
    getMany: () => Promise.resolve(options.rows ?? []),
    getOne: () => Promise.resolve(options.rows?.[0] ?? null),
  };
  const repository = {
    manager,
    createQueryBuilder: () => chain,
  } as unknown as Repository<Site>;
  const defaultSite = jest.fn(() => Promise.resolve(site({})));
  const calendarSites = { defaultSite } as unknown as SitesService;
  return {
    service: new SitesV2Service(repository, calendarSites),
    queries,
    saved,
    defaultSite,
  };
}

async function errorCode(work: Promise<unknown>): Promise<unknown> {
  try {
    await work;
    return undefined;
  } catch (error) {
    const response = (error as HttpException).getResponse() as {
      code?: string;
    };
    return [(error as HttpException).getStatus(), response.code];
  }
}

function listQuery(patch: Partial<SitesListQueryDto> = {}): SitesListQueryDto {
  return Object.assign(new SitesListQueryDto(), { sort: 'name', ...patch });
}

describe('SitesV2Service', () => {
  it('lists the plant sites with unit counts from one statement', async () => {
    const north = site({
      id: NORTH_ID,
      name: 'North',
      isDefault: false,
      operationalDayStart: '07:30:00',
    });
    const { service, queries, defaultSite } = setup({
      rows: [north, site({})],
    });
    const page = await service.list(context(), listQuery());
    expect(page.items).toEqual([
      {
        id: NORTH_ID,
        name: 'North',
        timezone: 'Asia/Tehran',
        operationalDayStart: '07:30',
        isDefault: false,
        unitCount: 1,
        timezoneFallback: false,
        rowVersion: 1,
        createdAt: CREATED.toISOString(),
      },
      {
        id: DEFAULT_ID,
        name: 'Plant One',
        timezone: 'Asia/Tehran',
        operationalDayStart: '06:00',
        isDefault: true,
        unitCount: 3,
        timezoneFallback: false,
        rowVersion: 1,
        createdAt: CREATED.toISOString(),
      },
    ]);
    expect(page.nextCursor).toBeNull();
    expect(page.scope).toEqual({ tenantId: PLANT });
    const unitQueries = queries.filter((q) => q.sql.includes('"units"'));
    expect(unitQueries).toHaveLength(1);
    expect(unitQueries[0].params).toEqual([PLANT]);
    expect(defaultSite).not.toHaveBeenCalled();
  });

  it('creates the default site on first use, then counts again', async () => {
    const { service, queries, defaultSite } = setup({
      rows: [site({})],
      noDefaultYet: true,
    });
    const page = await service.list(context(), listQuery());
    expect(defaultSite).toHaveBeenCalledWith(PLANT);
    expect(queries.filter((q) => q.sql.includes('"units"'))).toHaveLength(2);
    expect(page.items[0]).toMatchObject({ isDefault: true, unitCount: 3 });
  });

  it('creates a site with the plant time zone and the default site day start', async () => {
    const { service, saved } = setup();
    const view = await service.create(context(), { name: 'North' });
    expect(saved[0]).toMatchObject({
      tenantId: PLANT,
      organizationId: ORG,
      name: 'North',
      timezone: 'Asia/Tehran',
      operationalDayStart: '06:00:00',
      isDefault: false,
    });
    expect(view).toEqual({
      id: NORTH_ID,
      name: 'North',
      timezone: 'Asia/Tehran',
      timezoneFallback: false,
      operationalDayStart: '06:00',
      isDefault: false,
      unitCount: 0,
      rowVersion: 1,
      createdAt: CREATED.toISOString(),
    });
  });

  it('keeps an explicit zone and day start', async () => {
    const { service, saved } = setup();
    await service.create(context(), {
      name: 'Port',
      timezone: 'Asia/Dubai',
      operationalDayStart: '07:00',
    });
    expect(saved[0]).toMatchObject({
      timezone: 'Asia/Dubai',
      operationalDayStart: '07:00',
    });
  });

  it('refuses a duplicate name (pre-check and unique index) with 409 SITE_NAME_EXISTS', async () => {
    expect(
      await errorCode(
        setup({ nameTaken: true }).service.create(context(), { name: 'n' }),
      ),
    ).toEqual([409, 'SITE_NAME_EXISTS']);
    const race = new QueryFailedError(
      'INSERT',
      [],
      Object.assign(new Error('duplicate'), { code: '23505' }),
    );
    expect(
      await errorCode(
        setup({ saveError: race }).service.create(context(), { name: 'n' }),
      ),
    ).toEqual([409, 'SITE_NAME_EXISTS']);
  });

  it('lets only the plant organization administrator in besides super and plant administrators', async () => {
    const { service } = setup();
    const foreignOrgAdmin = context({
      legacyRole: 'OrgAdmin',
      roles: ['OrgAdmin'],
      organizationId: '99999999-9999-4999-8999-999999999999',
    });
    expect(
      await errorCode(service.create(foreignOrgAdmin, { name: 'X' })),
    ).toEqual([403, 'ORGANIZATION_NOT_ALLOWED']);
    const ownOrgAdmin = context({
      legacyRole: 'OrgAdmin',
      roles: ['OrgAdmin'],
    });
    await expect(
      service.create(ownOrgAdmin, { name: 'X' }),
    ).resolves.toMatchObject({ name: 'X' });
  });

  it('gets one site with its unit count; foreign ids are 404', async () => {
    const north = site({ id: NORTH_ID, name: 'North', isDefault: false });
    await expect(
      setup({ rows: [north] }).service.get(context(), NORTH_ID),
    ).resolves.toMatchObject({ id: NORTH_ID, unitCount: 1 });
    expect(await errorCode(setup().service.get(context(), NORTH_ID))).toEqual([
      404,
      'NOT_FOUND',
    ]);
  });

  it('renames a site of the plant; foreign ids are 404, duplicates 409', async () => {
    const north = site({ id: NORTH_ID, name: 'North', isDefault: false });
    const { service, saved } = setup({ rows: [north] });
    const view = await service.rename(context(), NORTH_ID, { name: 'Nord' });
    expect(saved[0]).toMatchObject({ id: NORTH_ID, name: 'Nord' });
    expect(view).toMatchObject({ name: 'Nord', unitCount: 1 });
    expect(
      await errorCode(
        setup().service.rename(context(), NORTH_ID, { name: 'A' }),
      ),
    ).toEqual([404, 'NOT_FOUND']);
    expect(
      await errorCode(
        setup({ rows: [north], nameTaken: true }).service.rename(
          context(),
          NORTH_ID,
          { name: 'Plant One' },
        ),
      ),
    ).toEqual([409, 'SITE_NAME_EXISTS']);
  });
});
