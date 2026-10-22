import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestContext } from '../common/context/request-context';
import { scopedQuery } from '../common/query/scoped-query';
import { Tenant } from '../tenant/tenant.entity';
import { Unit } from '../unit/unit.entity';
import { invalidReference, notFound } from './calendar-errors';
import { ensureDefaultSite } from './default-site';
import { Site } from './entities/site.entity';

/**
 * Sites (spec §3.1, plan 2.1 step 1). Every tenant has one default site; tenants created after the
 * `Calendars` migration get theirs on first use, from `tenants.timezone` (or `UTC` flagged as a
 * fallback). A unit without `site_id` belongs to its tenant's default site.
 */
@Injectable()
export class SitesService {
  constructor(
    @InjectRepository(Site) private readonly sites: Repository<Site>,
    @InjectRepository(Unit) private readonly units: Repository<Unit>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
  ) {}

  /** A site of the caller's tenant; 404 for foreign or unknown ids. */
  async get(context: RequestContext, id: string): Promise<Site> {
    const site = await scopedQuery(this.sites, 's', { context })
      .andWhere('s.id = :id', { id })
      .getOne();
    if (!site) throw notFound('Site');
    return site;
  }

  /** Body reference: the site, the tenant's default site when omitted, 422 when foreign. */
  async resolve(tenantId: string, siteId: string | undefined): Promise<Site> {
    if (!siteId) return this.defaultSite(tenantId);
    const site = await this.sites.findOne({ where: { id: siteId, tenantId } });
    if (!site) throw invalidReference('siteId', 'site');
    return site;
  }

  /** The tenant's default site, created from the tenant timezone when missing. */
  async defaultSite(tenantId: string): Promise<Site> {
    const existing = await this.sites.findOne({
      where: { tenantId, isDefault: true },
    });
    if (existing) return existing;
    const tenant = await this.tenants.findOne({ where: { id: tenantId } });
    return ensureDefaultSite(this.sites.manager, {
      id: tenantId,
      name: tenant?.name,
      organizationId: tenant?.organizationId,
      timezone: tenant?.timezone,
    });
  }

  /** Unit of the tenant (422 `INVALID_REFERENCE` otherwise) and its site. */
  async unitWithSite(
    tenantId: string,
    unitId: string,
  ): Promise<{ unit: Unit; site: Site }> {
    const unit = await this.units.findOne({ where: { id: unitId, tenantId } });
    if (!unit) throw invalidReference('unitId', 'unit');
    const site = unit.siteId
      ? await this.sites.findOneOrFail({ where: { id: unit.siteId } })
      : await this.defaultSite(tenantId);
    return { unit, site };
  }

  /** Units of a site (the default site also owns units without `site_id`). */
  async unitIdsOf(site: Site): Promise<string[]> {
    const qb = this.units
      .createQueryBuilder('u')
      .select('u.id', 'id')
      .where('u.tenantId = :tenantId', { tenantId: site.tenantId });
    if (site.isDefault) {
      qb.andWhere('(u.siteId = :siteId OR u.siteId IS NULL)', {
        siteId: site.id,
      });
    } else {
      qb.andWhere('u.siteId = :siteId', { siteId: site.id });
    }
    const rows = await qb.orderBy('u.id').getRawMany<{ id: string }>();
    return rows.map((row) => row.id);
  }
}
