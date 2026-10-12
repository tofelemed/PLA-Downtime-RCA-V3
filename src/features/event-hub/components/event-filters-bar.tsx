import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DebouncedSearchInput } from '@/features/ux-kit/debounced-search-input';
import { EVENT_TYPE_LABELS, SEVERITY_LABELS } from '@/features/ux-kit/labels/event-hub-labels';
import {
  CODING_STATE_LABELS,
  EVENT_RCA_STATE_LABELS,
  labelOf,
  PHYSICAL_STATE_LABELS,
  PHYSICAL_TYPE_LABELS,
  SCHEDULE_CLASS_LABELS,
  SOURCE_KIND_LABELS,
} from '@/features/ux-kit/labels';
import {
  CODING_STATES,
  EVENT_TYPES,
  PHYSICAL_STATES,
  PHYSICAL_TYPES,
  RCA_STATES,
  SCHEDULE_CLASSES,
  SEVERITIES,
  SOURCE_KINDS,
  type ArrayFilter,
  type EventFilterState,
  type OpenFilter,
} from '../model/event-filters';
import { useAssetOptions } from '../hooks/use-asset-options';
import { useEventHubEnv } from '../use-event-hub-env';
import { MultiCheckSelect, type CheckOption } from './multi-check-select';
import { WindowSelect } from './window-select';

export interface EventFiltersBarProps {
  filters: EventFilterState;
  onChange: (next: EventFilterState) => void;
  onReset: () => void;
}

const optionsOf = (values: readonly string[], labels: Readonly<Record<string, string>>): CheckOption[] =>
  values.map((value) => ({ value, label: labelOf(labels, value) }));

const SECONDARY: readonly ArrayFilter[] = ['eventTypes', 'scheduleClasses', 'assetIds', 'codingStates', 'rcaStates', 'sourceKinds', 'severities'];

interface FilterSpec {
  field: ArrayFilter;
  label: string;
  testId: string;
  options: CheckOption[];
}

/**
 * Server filters of the list (§16.2): search, units, window, kind, reason and running / ended up
 * front; event family, schedule class, asset, coding / RCA / physical state, source and severity under
 * "More filters". AND between filters, OR within one; ticks are sent when a list closes.
 */
export function EventFiltersBar({ filters, onChange, onReset }: EventFiltersBarProps) {
  const env = useEventHubEnv();
  const assets = useAssetOptions(filters.unitIds);
  const moreActive = SECONDARY.filter((field) => filters[field].length > 0).length;
  const [showMore, setShowMore] = useState(moreActive > 0);
  const set = <K extends keyof EventFilterState>(key: K, value: EventFilterState[K]) => onChange({ ...filters, [key]: value });
  const reasonOptions = [...env.reasonCodes]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((code) => ({ value: code.id, label: `${code.code} · ${code.name}`, level: Math.max(0, code.level - 1) }));
  const primary: FilterSpec[] = [
    { field: 'unitIds', label: 'Units', testId: 'filter-units', options: env.units.map((unit) => ({ value: unit.id, label: unit.name })) },
    { field: 'physicalTypes', label: 'Type', testId: 'filter-physical-types', options: optionsOf(PHYSICAL_TYPES, PHYSICAL_TYPE_LABELS) },
    { field: 'reasonIds', label: 'Reason', testId: 'filter-reasons', options: reasonOptions },
  ];
  const secondary: FilterSpec[] = [
    { field: 'eventTypes', label: 'Event family', testId: 'filter-event-types', options: optionsOf(EVENT_TYPES, EVENT_TYPE_LABELS) },
    { field: 'scheduleClasses', label: 'Schedule', testId: 'filter-schedule-classes', options: optionsOf(SCHEDULE_CLASSES, SCHEDULE_CLASS_LABELS) },
    { field: 'assetIds', label: 'Asset', testId: 'filter-assets', options: assets },
    { field: 'codingStates', label: 'Coding', testId: 'filter-coding-states', options: optionsOf(CODING_STATES, CODING_STATE_LABELS) },
    { field: 'rcaStates', label: 'RCA', testId: 'filter-rca-states', options: optionsOf(RCA_STATES, EVENT_RCA_STATE_LABELS) },
    { field: 'physicalStates', label: 'State', testId: 'filter-physical-states', options: optionsOf(PHYSICAL_STATES, PHYSICAL_STATE_LABELS) },
    { field: 'sourceKinds', label: 'Origin', testId: 'filter-source-kinds', options: optionsOf(SOURCE_KINDS, SOURCE_KIND_LABELS) },
    { field: 'severities', label: 'Severity', testId: 'filter-severities', options: optionsOf(SEVERITIES, SEVERITY_LABELS) },
  ];
  const select = (spec: FilterSpec) => (
    <MultiCheckSelect key={spec.field} commitOnClose label={spec.label} testId={spec.testId} options={spec.options} selected={filters[spec.field]} onChange={(v) => set(spec.field, v)} />
  );
  return (
    <div className="space-y-2" role="search" aria-label="Event filters">
      <div className="flex flex-wrap items-center gap-2">
        <DebouncedSearchInput label="Search description or source id" placeholder="Search events" value={filters.q} onChange={(q) => set('q', q)} className="w-56" />
        {select(primary[0])}
        <WindowSelect unitId={filters.unitIds.length === 1 ? filters.unitIds[0] : null} label={filters.windowLabel} onChange={(w) => onChange({ ...filters, from: w.from, to: w.to, windowLabel: w.label })} />
        {primary.slice(1).map(select)}
        <OpenSelect value={filters.isOpen} onChange={(value) => set('isOpen', value)} />
        <Button variant="outline" size="sm" aria-expanded={showMore} onClick={() => setShowMore((open) => !open)} data-testid="more-filters">
          More filters{moreActive > 0 ? ` (${moreActive})` : ''}
        </Button>
        <Button variant="ghost" size="sm" onClick={onReset}>Reset filters</Button>
      </div>
      {showMore && <div className="flex flex-wrap items-center gap-2" data-testid="more-filter-row">{secondary.map(select)}</div>}
    </div>
  );
}

function OpenSelect({ value, onChange }: { value: OpenFilter; onChange: (value: OpenFilter) => void }) {
  return (
    <select
      aria-label="Running or ended"
      data-testid="filter-open"
      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
      value={value}
      onChange={(event) => onChange(event.target.value as OpenFilter)}
    >
      <option value="any">Running and ended</option>
      <option value="open">Running only</option>
      <option value="closed">Ended only</option>
    </select>
  );
}
