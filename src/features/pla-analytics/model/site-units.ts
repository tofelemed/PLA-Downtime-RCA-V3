import type { SiteView } from '@/api/v2/types/flags';
import type { UnitView } from '@/api/v2/types/units';

type SiteRef = Pick<SiteView, 'id' | 'isDefault'>;
type UnitRef = Pick<UnitView, 'id' | 'siteId'>;

/** A unit without a site belongs to the plant's default site (backend `units.site_id`, null = default). */
export function siteOfUnit(unit: UnitRef, sites: readonly SiteRef[]): string | null {
  return unit.siteId ?? sites.find((site) => site.isDefault)?.id ?? null;
}

/** The units of a site, sorted (what the site filter selects; reports still receive named units). */
export function unitsOfSite(siteId: string, units: readonly UnitRef[], sites: readonly SiteRef[]): string[] {
  return units
    .filter((unit) => siteOfUnit(unit, sites) === siteId)
    .map((unit) => unit.id)
    .sort();
}

/** The site whose units are exactly the selection, if any ('' when no units or no site matches). */
export function siteOfSelection(selected: readonly string[], units: readonly UnitRef[], sites: readonly SiteRef[]): string {
  if (selected.length === 0) return '';
  const chosen = [...selected].sort().join(',');
  return sites.find((site) => unitsOfSite(site.id, units, sites).join(',') === chosen)?.id ?? '';
}
