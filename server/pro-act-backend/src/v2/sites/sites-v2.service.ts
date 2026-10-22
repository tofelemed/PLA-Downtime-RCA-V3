import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Site } from '../../calendar/entities/site.entity';
import { SitesService } from '../../calendar/sites.service';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { isValidTimeZone } from '../../domain/calendar/zone-timeline';
import { listResponse, ListResponse } from '../common/response';
import { isUniqueViolation } from '../master-data/common/master-data-errors';
import { containsPattern } from '../master-data/common/search';
import { sortedKeysetPage } from '../master-data/common/sorted-keyset-page';
import { siteNameTaken, siteNotFound } from './site-errors';
import {
  SitesListQueryDto,
  SiteV2ChangeDto,
  SiteV2CreateDto,
} from './site-v2.dto';
import { toSiteView, SiteV2View } from './site-v2.view';
import { siteCensus, SiteCensus } from './site-census';
import { assertSiteWriter } from './site-writers';

const NONE = '00000000-0000-0000-0000-000000000000';

/**
 * Sites of the acting plant (DECISIONS 2026-10-22 "Site level is exposed"): list (the default site is
 * created on first use), create and rename. No delete: units, calendars and crews reference sites. Writes are
 * audited by the global audit interceptor.
 */
@Injectable()
export class SitesV2Service {
  constructor(
    @InjectRepository(Site) private readonly sites: Repository<Site>,
    private readonly calendarSites: SitesService,
  ) {}

  async list(
    context: RequestContext,
    query: SitesListQueryDto,
  ): Promise<ListResponse<SiteV2View>> {
    const tenantId = requireTenantId(context);
    const census = await this.census(tenantId);
    const qb = scopedQuery(this.sites, 's', { context });
    const text = query.q?.trim();
    if (text) {
      qb.andWhere('s.name ILIKE :searchText', {
        searchText: containsPattern(text),
      });
    }
    const page = await sortedKeysetPage(qb, {
      alias: 's',
      sort: query.sort,
      cursor: query.cursor,
      limit: query.limit,
    });
    const items = page.items.map((site) =>
      toSiteView(site, census.unitCounts.get(site.id) ?? 0),
    );
    return listResponse(items, page.nextCursor, { tenantId });
  }

  /** One site of the acting plant; foreign ids are 404. */
  async get(context: RequestContext, id: string): Promise<SiteV2View> {
    return this.withUnitCount(await this.find(context, id));
  }

  async create(
    context: RequestContext,
    input: SiteV2CreateDto,
  ): Promise<SiteV2View> {
    const tenantId = requireTenantId(context);
    const plant = await assertSiteWriter(this.sites.manager, context, tenantId);
    const fallback = await this.calendarSites.defaultSite(tenantId);
    const plantZone = plant.timezone?.trim() ?? '';
    const timezone =
      input.timezone ??
      (isValidTimeZone(plantZone) ? plantZone : fallback.timezone);
    const name = { tenantId, name: input.name };
    const site = await this.writeNamed(name, (manager) =>
      manager.getRepository(Site).save(
        manager.getRepository(Site).create({
          tenantId,
          organizationId: plant.organizationId,
          name: input.name,
          timezone,
          timezoneFallback: false,
          operationalDayStart:
            input.operationalDayStart ?? fallback.operationalDayStart,
          isDefault: false,
          createdBy: context.userId,
          updatedBy: context.userId,
        }),
      ),
    );
    return toSiteView(site, 0);
  }

  async rename(
    context: RequestContext,
    id: string,
    input: SiteV2ChangeDto,
  ): Promise<SiteV2View> {
    const tenantId = requireTenantId(context);
    await assertSiteWriter(this.sites.manager, context, tenantId);
    const site = await this.find(context, id);
    const name = { tenantId, name: input.name, exceptId: site.id };
    const renamed =
      site.name === input.name
        ? site
        : await this.writeNamed(name, (manager) => {
            site.name = input.name;
            site.updatedBy = context.userId;
            return manager.getRepository(Site).save(site);
          });
    return this.withUnitCount(renamed);
  }

  private async withUnitCount(site: Site): Promise<SiteV2View> {
    const census = await this.census(site.tenantId);
    return toSiteView(site, census.unitCounts.get(site.id) ?? 0);
  }

  /** Unit counts per site; the default site is created on first use (then counted again). */
  private async census(tenantId: string): Promise<SiteCensus> {
    const census = await siteCensus(this.sites.manager, tenantId);
    if (census.hasDefault) return census;
    await this.calendarSites.defaultSite(tenantId);
    return siteCensus(this.sites.manager, tenantId);
  }

  private async find(context: RequestContext, id: string): Promise<Site> {
    const site = await scopedQuery(this.sites, 's', { context })
      .andWhere('s.id = :id', { id })
      .getOne();
    if (!site) throw siteNotFound();
    return site;
  }

  /** Runs a name-carrying write in a transaction; a duplicate name (any case) is 409 SITE_NAME_EXISTS. */
  private async writeNamed(
    name: NameClaim,
    write: (manager: EntityManager) => Promise<Site>,
  ): Promise<Site> {
    try {
      return await this.sites.manager.transaction(async (manager) => {
        await assertNameFree(manager, name);
        return write(manager);
      });
    } catch (error) {
      throw isUniqueViolation(error) ? siteNameTaken(name.name) : error;
    }
  }
}

/** A site name wanted in a plant, by a new site or by the site `exceptId` being renamed. */
interface NameClaim {
  tenantId: string;
  name: string;
  exceptId?: string;
}

/** 409 SITE_NAME_EXISTS when another site of the plant has the name (any case). */
async function assertNameFree(
  manager: EntityManager,
  claim: NameClaim,
): Promise<void> {
  const rows = await manager.query<unknown[]>(
    `SELECT 1 FROM "sites" WHERE "tenant_id" = $1 AND lower("name") = lower($2) AND "id" <> $3 LIMIT 1`,
    [claim.tenantId, claim.name, claim.exceptId ?? NONE],
  );
  if (rows.length > 0) throw siteNameTaken(claim.name);
}
