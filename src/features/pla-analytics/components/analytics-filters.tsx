import type { ReactNode } from 'react';
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
  /** what the page shows (its mode, grouping or basis selects), placed between Units and the window */
  picker?: ReactNode;
}

export const SELECT_CLASS = 'h-9 rounded-md border border-input bg-background px-2 text-sm';
/** A labelled filter control: its label stacked above it. */
export const FIELD_CLASS = 'flex flex-col gap-1.5';

/**
 * Scope filters of the PLA analysis pages (server-side), one bottom-aligned row in the owner's order: site
 * (selects its units) and units (sent when the list closes), what the page shows, the window (presets and
 * plant dates in one control), then the ledger and the revision. Every control h-9, labels above.
 */
export function AnalyticsFilters({ scope, onChange, showLedger = true, showApproved = true, picker }: AnalyticsFiltersProps) {
  const env = useEventHubEnv();
  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3" role="group" aria-label="Analytics scope" data-testid="analytics-filters">
      <SiteFilter unitIds={scope.unitIds} onChange={(unitIds) => onChange({ unitIds })} />
      {/* the button names itself ("Units: All") */}
      <div>
        <MultiCheckSelect
          label="Units"
          testId="filter-units"
          options={env.units.map((unit) => ({ value: unit.id, label: unit.name }))}
          selected={scope.unitIds}
          onChange={(unitIds) => onChange({ unitIds: [...unitIds].sort() })}
          commitOnClose
        />
      </div>
      {picker}
      <WindowRangeControl scope={scope} timeZone={env.timezone} onChange={onChange} />
      <LedgerApprovedToggles ledger={scope.ledger} approvedOnly={scope.approvedOnly} showLedger={showLedger} showApproved={showApproved} onChange={onChange} />
    </div>
  );
}
