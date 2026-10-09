import { Button } from '@/components/ui/button';
import {
  CODING_STATES,
  PHYSICAL_STATES,
  PHYSICAL_TYPES,
  RCA_STATES,
  SCHEDULE_CLASSES,
  type EventFilterState,
  type OpenFilter,
} from '../model/event-filters';
import { humanize } from '../model/event-states';
import { useEventHubEnv } from '../use-event-hub-env';
import { MultiCheckSelect, type CheckOption } from './multi-check-select';
import { WindowSelect } from './window-select';

export interface EventFiltersBarProps {
  filters: EventFilterState;
  onChange: (next: EventFilterState) => void;
  onReset: () => void;
}

const enumOptions = (values: readonly string[]): CheckOption[] =>
  values.map((value) => ({ value, label: humanize(value) }));

/**
 * Combined server filters (§16.2): units, reasons, physical type, schedule class and the three state
 * dimensions, running/ended and the window. AND between filters, OR within one (API semantics).
 */
export function EventFiltersBar({ filters, onChange, onReset }: EventFiltersBarProps) {
  const env = useEventHubEnv();
  const set = <K extends keyof EventFilterState>(key: K, value: EventFilterState[K]) =>
    onChange({ ...filters, [key]: value });
  const unitOptions = env.units.map((unit) => ({ value: unit.id, label: unit.name }));
  const reasonOptions = [...env.reasonCodes]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((code) => ({ value: code.id, label: `${code.code} · ${code.name}`, level: Math.max(0, code.level - 1) }));
  const singleUnit = filters.unitIds.length === 1 ? filters.unitIds[0] : null;

  return (
    <div className="flex flex-wrap items-center gap-2" role="search" aria-label="Event filters">
      <MultiCheckSelect label="Units" testId="filter-units" options={unitOptions} selected={filters.unitIds} onChange={(v) => set('unitIds', v)} />
      <WindowSelect
        unitId={singleUnit}
        label={filters.windowLabel}
        onChange={(window) => onChange({ ...filters, from: window.from, to: window.to, windowLabel: window.label })}
      />
      <MultiCheckSelect label="Type" testId="filter-physical-types" options={enumOptions(PHYSICAL_TYPES)} selected={filters.physicalTypes} onChange={(v) => set('physicalTypes', v)} />
      <MultiCheckSelect label="Schedule" testId="filter-schedule-classes" options={enumOptions(SCHEDULE_CLASSES)} selected={filters.scheduleClasses} onChange={(v) => set('scheduleClasses', v)} />
      <MultiCheckSelect label="Reason" testId="filter-reasons" options={reasonOptions} selected={filters.reasonIds} onChange={(v) => set('reasonIds', v)} />
      <MultiCheckSelect label="Coding" testId="filter-coding-states" options={enumOptions(CODING_STATES)} selected={filters.codingStates} onChange={(v) => set('codingStates', v)} />
      <MultiCheckSelect label="RCA" testId="filter-rca-states" options={enumOptions(RCA_STATES)} selected={filters.rcaStates} onChange={(v) => set('rcaStates', v)} />
      <MultiCheckSelect label="State" testId="filter-physical-states" options={enumOptions(PHYSICAL_STATES)} selected={filters.physicalStates} onChange={(v) => set('physicalStates', v)} />
      <select
        aria-label="Running or ended"
        data-testid="filter-open"
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        value={filters.isOpen}
        onChange={(event) => set('isOpen', event.target.value as OpenFilter)}
      >
        <option value="any">Running and ended</option>
        <option value="open">Running only</option>
        <option value="closed">Ended only</option>
      </select>
      <Button variant="ghost" size="sm" onClick={onReset}>
        Reset filters
      </Button>
    </div>
  );
}
