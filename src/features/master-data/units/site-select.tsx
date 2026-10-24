import { useSiteList } from '@/api/v2/queries/sites';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { ReadOnlyField } from '../components/read-only-field';

/** The default-site choice: sends `siteId: null` (radix selects take no empty value). */
const DEFAULT = '__default__';

const SITE_INFO = 'The site sets the unit’s time zone and production day start. Sites are managed under Setup › Organizations & plants.';

export interface SiteSelectProps {
  /** the unit's site; '' = the plant's default site */
  value: string;
  onChange: (siteId: string) => void;
  disabled?: boolean;
  /** read-only users see the site's name as text */
  asText?: boolean;
}

/**
 * Site of a production unit among the sites of the selected plant (`GET /v2/sites`). The default site is the
 * first choice and is stored as "no site" (null); a unit already saved on the default site by id keeps it until
 * another choice is made. What a site sets is behind the ⓘ next to the label.
 */
export function SiteSelect({ value, onChange, disabled, asText }: SiteSelectProps) {
  const sites = useSiteList();
  const defaultSite = sites.items.find((site) => site.isDefault);
  const others = sites.items.filter((site) => !site.isDefault);
  const current = !value || value === defaultSite?.id ? DEFAULT : value;
  const defaultLabel = defaultSite ? `${defaultSite.name} (default)` : 'Default site';
  if (asText) return <ReadOnlyField label="Site" value={current === DEFAULT ? defaultLabel : others.find((site) => site.id === value)?.name ?? ''} />;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor="siteId">Site</Label>
        <KpiInfo label="Site" text={SITE_INFO} />
      </div>
      <Select value={current} onValueChange={(next) => onChange(next === DEFAULT ? '' : next)} disabled={disabled}>
        <SelectTrigger id="siteId">
          <SelectValue placeholder={sites.isLoading ? 'Loading sites…' : 'Default site'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT}>{defaultLabel}</SelectItem>
          {others.map((site) => (
            <SelectItem key={site.id} value={site.id}>
              {site.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
