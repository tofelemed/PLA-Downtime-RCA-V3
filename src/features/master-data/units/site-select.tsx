import { useSiteList } from '@/api/v2/queries/sites';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/** The default-site choice: sends `siteId: null` (radix selects take no empty value). */
const DEFAULT = '__default__';

export interface SiteSelectProps {
  /** the unit's site; '' = the plant's default site */
  value: string;
  onChange: (siteId: string) => void;
  disabled?: boolean;
}

/**
 * Site of a production unit among the sites of the selected plant (`GET /v2/sites`). The default site is the
 * first choice and is stored as "no site" (null); a unit already saved on the default site by id keeps it until
 * another choice is made.
 */
export function SiteSelect({ value, onChange, disabled }: SiteSelectProps) {
  const sites = useSiteList();
  const defaultSite = sites.items.find((site) => site.isDefault);
  const others = sites.items.filter((site) => !site.isDefault);
  const current = !value || value === defaultSite?.id ? DEFAULT : value;
  return (
    <div className="space-y-1.5">
      <Label htmlFor="siteId">Site</Label>
      <Select value={current} onValueChange={(next) => onChange(next === DEFAULT ? '' : next)} disabled={disabled}>
        <SelectTrigger id="siteId" aria-describedby="siteId-hint">
          <SelectValue placeholder={sites.isLoading ? 'Loading sites…' : 'Default site'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT}>{defaultSite ? `${defaultSite.name} (default)` : 'Default site'}</SelectItem>
          {others.map((site) => (
            <SelectItem key={site.id} value={site.id}>
              {site.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p id="siteId-hint" className="text-xs text-muted-foreground">
        The site sets the unit’s time zone and production day start. Sites are managed under Setup › Organizations &amp; plants.
      </p>
    </div>
  );
}
