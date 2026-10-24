import { useSites } from '@/api/v2/queries/reference-data';
import { Label } from '@/components/ui/label';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { siteOfSelection, unitsOfSite } from '../model/site-units';
import { FIELD_CLASS, SELECT_CLASS } from './filter-classes';


/**
 * Site filter of PLA analytics: choosing a site selects its units (the reports keep receiving named
 * units, so the server scope and the shared URL stay the unit list). Hidden for a single-site plant.
 */
export function SiteFilter({ unitIds, onChange }: { unitIds: readonly string[]; onChange: (unitIds: string[]) => void }) {
  const env = useEventHubEnv();
  const sites = useSites().data?.items ?? [];
  if (sites.length < 2) return null;
  const current = siteOfSelection(unitIds, env.units, sites);
  const choose = (siteId: string) => onChange(siteId ? unitsOfSite(siteId, env.units, sites) : []);
  return (
    <div className={FIELD_CLASS}>
      <Label htmlFor="pla-site">Site</Label>
      <select id="pla-site" data-testid="pla-site" className={SELECT_CLASS} value={current} onChange={(event) => choose(event.target.value)}>
        <option value="">{unitIds.length > 0 && !current ? 'Chosen units' : 'All sites'}</option>
        {sites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.name}
          </option>
        ))}
      </select>
    </div>
  );
}
