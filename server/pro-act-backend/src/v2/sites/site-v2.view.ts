import { Site } from '../../calendar/entities/site.entity';
import { normalizeTime } from '../../domain/calendar/wall-clock';

/**
 * `GET /api/v2/sites` item, `GET /api/v2/sites/{id}`, and the body of `POST` / `PATCH /api/v2/sites`
 * (plan 2.1 site fields plus the Setup UX `unitCount`).
 */
export interface SiteV2View {
  id: string;
  name: string;
  /** IANA time zone */
  timezone: string;
  /** the tenant had no valid IANA timezone; `UTC` was used */
  timezoneFallback: boolean;
  /** start of the operational day, `HH:MM` */
  operationalDayStart: string;
  isDefault: boolean;
  /** active (not retired) units of the site; the default site also counts units without a site */
  unitCount: number;
  rowVersion: number;
  createdAt: string;
}

export function toSiteView(site: Site, unitCount: number): SiteV2View {
  return {
    id: site.id,
    name: site.name,
    timezone: site.timezone,
    timezoneFallback: site.timezoneFallback,
    operationalDayStart: normalizeTime(site.operationalDayStart),
    isDefault: site.isDefault,
    unitCount,
    rowVersion: site.rowVersion,
    createdAt: site.createdAt.toISOString(),
  };
}
