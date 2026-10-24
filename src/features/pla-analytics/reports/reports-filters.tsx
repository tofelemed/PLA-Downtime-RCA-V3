import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { MultiCheckSelect } from '@/features/event-hub/components/multi-check-select';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { CHOSEN_DATES, type AnalyticsScope } from '../model/analytics-scope';
import { PlantDaysInput } from '../components/plant-days-input';
import { FIELD_CLASS, SELECT_CLASS } from '../components/filter-classes';
import { REVISION_OPTIONS } from './revision-options';

export interface ReportsFiltersProps {
  scope: AnalyticsScope;
  /** `HH:mm`: the plant's production-day start */
  dayStart: string;
  onChange: (patch: Partial<AnalyticsScope>) => void;
  /** the report type and report dropdowns, placed between Units and the dates */
  picker?: ReactNode;
}

/**
 * The report top bar in owner order — Units, the report picker, From / To, Revision, each a sibling item of the bar (they wrap one by
 * one, every control h-9): the plant dates the periods start on (From / To, typed or picked in the plant
 * calendar), named units (sent when the list closes), and the revision — approved only, or approved else
 * the latest draft (provisional).
 */
export function ReportsFilters({ scope, dayStart, onChange, picker }: ReportsFiltersProps) {
  const env = useEventHubEnv();
  const setDates = (range: { from: string; to: string }) => onChange({ ...range, windowLabel: CHOSEN_DATES });
  return (
    <>
      {/* the button names itself ("Units: All"); the bar aligns every control on its bottom edge */}
      <div>
        <MultiCheckSelect
          label="Units"
          testId="report-units"
          options={env.units.map((unit) => ({ value: unit.id, label: unit.name }))}
          selected={scope.unitIds}
          onChange={(unitIds) => onChange({ unitIds: [...unitIds].sort() })}
          commitOnClose
        />
      </div>
      {picker}
      <PlantDaysInput
        label="Period dates"
        value={{ from: scope.from, to: scope.to }}
        timeZone={env.timezone}
        dayStart={dayStart}
        onChange={setDates}
        toLabel="To"
        calendarPicker
        toolbar
      />
      <div className={FIELD_CLASS}>
        <Label htmlFor="report-revision">Revision</Label>
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
    </>
  );
}
