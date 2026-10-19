import { Label } from '@/components/ui/label';
import { MultiCheckSelect } from '@/features/event-hub/components/multi-check-select';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { CHOSEN_DATES, type AnalyticsScope } from '../model/analytics-scope';
import { PlantDaysInput } from '../components/plant-days-input';
import { SELECT_CLASS } from '../components/analytics-filters';
import { REVISION_OPTIONS } from './revision-options';

export interface ReportsFiltersProps {
  scope: AnalyticsScope;
  /** `HH:mm`: the plant's production-day start */
  dayStart: string;
  onChange: (patch: Partial<AnalyticsScope>) => void;
}

/**
 * Report filters (plan 3.6 step 4): named units (sent when the list closes), the plant dates the periods
 * start on (not when rows were created; Persian or Gregorian per the plant setting), and the revision
 * selector — approved only, or approved else the latest draft (provisional).
 */
export function ReportsFilters({ scope, dayStart, onChange }: ReportsFiltersProps) {
  const env = useEventHubEnv();
  const setDates = (range: { from: string; to: string }) => onChange({ ...range, windowLabel: CHOSEN_DATES });
  return (
    <div className="flex flex-wrap items-end gap-4" role="group" aria-label="Report filters" data-testid="reports-filters">
      <MultiCheckSelect
        label="Units"
        testId="report-units"
        options={env.units.map((unit) => ({ value: unit.id, label: unit.name }))}
        selected={scope.unitIds}
        onChange={(unitIds) => onChange({ unitIds: [...unitIds].sort() })}
        commitOnClose
      />
      <PlantDaysInput label="Period dates" value={{ from: scope.from, to: scope.to }} timeZone={env.timezone} dayStart={dayStart} onChange={setDates} />
      <div className="space-y-1">
        <Label htmlFor="report-revision">Revisions</Label>
        <select
          id="report-revision"
          data-testid="report-revision"
          className={SELECT_CLASS}
          value={scope.approvedOnly ? 'approved' : 'shown'}
          onChange={(e) => onChange({ approvedOnly: e.target.value === 'approved' })}
        >
          <option value="approved">{REVISION_OPTIONS.approved}</option>
          <option value="shown">{REVISION_OPTIONS.shown}</option>
        </select>
      </div>
    </div>
  );
}
