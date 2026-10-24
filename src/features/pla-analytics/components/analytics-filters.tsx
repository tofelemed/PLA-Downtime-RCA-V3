import { MultiCheckSelect } from '@/features/event-hub/components/multi-check-select';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import type { AnalyticsScope } from '../model/analytics-scope';
import { LedgerApprovedToggles } from './ledger-approved-toggles';
import { SiteFilter } from './site-filter';
import { WindowRangeControl } from './window-range-control';

export interface AnalyticsFiltersProps {
  showLedger?: boolean;
  showApproved?: boolean;
  scope: AnalyticsScope;
  onChange: (patch: Partial<AnalyticsScope>) => void;
}

export const SELECT_CLASS = 'h-9 rounded-md border border-input bg-background px-2 text-sm';
/** A labelled filter control: its label stacked above it. */
export const FIELD_CLASS = 'flex flex-col gap-1.5';

/**
 * Scope filters shared by every view (server-side), in one row: site (selects its units), units (sent when
 * the list closes), the window (presets and plant dates in one control), ledger and approved only.
 */
export function AnalyticsFilters({ scope, onChange, showLedger = true, showApproved = true }: AnalyticsFiltersProps) {
  const env = useEventHubEnv();
  return (
    <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Analytics scope" data-testid="analytics-filters">
      <SiteFilter unitIds={scope.unitIds} onChange={(unitIds) => onChange({ unitIds })} />
      <MultiCheckSelect
        label="Units"
        testId="filter-units"
        options={env.units.map((unit) => ({ value: unit.id, label: unit.name }))}
        selected={scope.unitIds}
        onChange={(unitIds) => onChange({ unitIds: [...unitIds].sort() })}
        commitOnClose
      />
      <WindowRangeControl scope={scope} timeZone={env.timezone} onChange={onChange} />
      <LedgerApprovedToggles ledger={scope.ledger} approvedOnly={scope.approvedOnly} showLedger={showLedger} showApproved={showApproved} onChange={onChange} />
    </div>
  );
}
