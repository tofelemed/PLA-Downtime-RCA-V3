import { EntityManager } from 'typeorm';
import { isValidTimeZone } from '../domain/calendar/zone-timeline';
import { Site } from './entities/site.entity';

/** D03: the operational day starts at 06:00 unless a site says otherwise. */
export const DEFAULT_OPERATIONAL_DAY_START = '06:00';

/** What a plant's default site is made from: the plant (tenant) row. */
export interface DefaultSiteSource {
  id: string;
  name?: string | null;
  organizationId?: string | null;
  timezone?: string | null;
}

/**
 * Inserts the plant's default site (named after the plant, in the plant's IANA time zone, or `UTC` flagged
 * as a fallback) unless it already has one, and returns it. Shared by the on-first-use path
 * (`SitesService.defaultSite`) and plant creation, which runs it inside its transaction.
 */
export async function ensureDefaultSite(
  manager: EntityManager,
  plant: DefaultSiteSource,
  actorId: string | null = null,
): Promise<Site> {
  const sites = manager.getRepository(Site);
  const existing = await sites.findOne({
    where: { tenantId: plant.id, isDefault: true },
  });
  if (existing) return existing;
  const zone = plant.timezone?.trim() ?? '';
  const valid = zone !== '' && isValidTimeZone(zone);
  await sites
    .createQueryBuilder()
    .insert()
    .values({
      tenantId: plant.id,
      organizationId: plant.organizationId ?? null,
      name: plant.name ?? 'Default site',
      timezone: valid ? zone : 'UTC',
      timezoneFallback: !valid,
      operationalDayStart: DEFAULT_OPERATIONAL_DAY_START,
      isDefault: true,
      createdBy: actorId,
      updatedBy: actorId,
    })
    .orIgnore()
    .execute();
  return sites.findOneOrFail({
    where: { tenantId: plant.id, isDefault: true },
  });
}
