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
  toCodeFilters,
  VERIFICATION_STATES,
  type ArrayFilter,
  type EventFilterState,
} from '../model/event-filters';
import { useAssetOptions } from '../hooks/use-asset-options';
import { useEventHubEnv } from '../use-event-hub-env';
import { MultiCheckSelect, type CheckOption } from './multi-check-select';
import { FilterFlagToggle } from './filter-flag-toggle';
import { MinDurationSelect } from './min-duration-select';
import { OpenSelect } from './open-select';
import { WindowSelect } from './window-select';

export interface EventFiltersBarProps {
  filters: EventFilterState;
  onChange: (next: EventFilterState) => void;
  onReset: () => void;
}

const optionsOf = (values: readonly string[], labels: Readonly<Record<string, string>>): CheckOption[] =>
  values.map((value) => ({ value, label: labelOf(labels, value) }));

const SECONDARY: readonly ArrayFilter[] = ['eventTypes', 'scheduleClasses', 'assetIds', 'codingStates', 'verificationStates', 'rcaStates', 'sourceKinds', 'severities'];

/** E-7: supervisor verification of the coding (SME D13). */
const VERIFICATION_LABELS: Readonly<Record<(typeof VERIFICATION_STATES)[number], string>> = { verified: 'Verified', not_verified: 'Not verified' };

interface FilterSpec {
  field: ArrayFilter;
  label: string;
  testId: string;
  options: CheckOption[];
}

/**
 * Server filters of the list (§16.2), one bottom-aligned row: units, kind, reason, window (+ custom range),
 * ongoing / ended and search up front, then More filters / To code / Reset; event family, schedule class, asset, coding / verification (E-7) / RCA / physical state, source,
 * severity and minimum duration (E-1) under "More filters" (with possible duplicate stops, DT-04). AND between filters, OR within one; ticks are sent when a list closes.
 */
export function EventFiltersBar({ filters, onChange, onReset }: EventFiltersBarProps) {
  const env = useEventHubEnv();
  const assets = useAssetOptions(filters.unitIds);
  const flags = [filters.possibleDuplicate, filters.possibleRepeat, filters.minDurationSeconds !== null].filter(Boolean).length;
  const moreActive = SECONDARY.filter((field) => filters[field].length > 0).length + flags;
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
    { field: 'verificationStates', label: 'Verification', testId: 'filter-verification', options: optionsOf(VERIFICATION_STATES, VERIFICATION_LABELS) },
    { field: 'rcaStates', label: 'Investigation', testId: 'filter-rca-states', options: optionsOf(RCA_STATES, EVENT_RCA_STATE_LABELS) },
    { field: 'physicalStates', label: 'State', testId: 'filter-physical-states', options: optionsOf(PHYSICAL_STATES, PHYSICAL_STATE_LABELS) },
    { field: 'sourceKinds', label: 'Origin', testId: 'filter-source-kinds', options: optionsOf(SOURCE_KINDS, SOURCE_KIND_LABELS) },
    { field: 'severities', label: 'Severity', testId: 'filter-severities', options: optionsOf(SEVERITIES, SEVERITY_LABELS) },
  ];
  const select = (spec: FilterSpec) => (
    <MultiCheckSelect key={spec.field} commitOnClose label={spec.label} testId={spec.testId} options={spec.options} selected={filters[spec.field]} onChange={(v) => set(spec.field, v)} />
  );
  return (
    <div className="space-y-3" role="search" aria-label="Event filters">
      <div className="flex flex-wrap items-end gap-x-2 gap-y-3">
        {primary.map(select)}
        <WindowSelect
          unitIds={filters.unitIds}
          label={filters.windowLabel}
          bounds={{ from: filters.from, to: filters.to }}
          onChange={(w) => onChange({ ...filters, from: w.from, to: w.to, windowLabel: w.label, relativeWindow: w.relative ?? null })}
        />
        <OpenSelect value={filters.isOpen} onChange={(value) => set('isOpen', value)} />
        <DebouncedSearchInput label="Search description or source id" placeholder="Search events" value={filters.q} onChange={(q) => set('q', q)} className="w-44 [&_input]:h-9" />
        <Button variant="outline" size="sm" aria-expanded={showMore} onClick={() => setShowMore((open) => !open)} data-testid="more-filters">
          More filters{moreActive > 0 ? ` (${moreActive})` : ''}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onChange(toCodeFilters(filters))} data-testid="filter-to-code" title="Stops in this window that still need a reason">
          To code
        </Button>
        <Button variant="ghost" size="sm" onClick={onReset}>Reset filters</Button>
      </div>
      {showMore && (
        <div className="flex flex-wrap items-end gap-x-3 gap-y-3" data-testid="more-filter-row">
          {secondary.map(select)}
          <MinDurationSelect value={filters.minDurationSeconds} onChange={(value) => set('minDurationSeconds', value)} />
          <FilterFlagToggle
            id="filter-possible-duplicates"
            label="Possible duplicate stops only"
            title="Stops that overlap another stop of the same asset (or of the unit when neither has an asset)"
            checked={filters.possibleDuplicate}
            onChange={(value) => set('possibleDuplicate', value)}
          />
          <FilterFlagToggle
            id="filter-possible-repeats"
            label="Possible repeat stops only"
            title="Stops that began within 2 minutes after a stop of the same asset and reason ended (one incident?)"
            checked={filters.possibleRepeat}
            onChange={(value) => set('possibleRepeat', value)}
          />
        </div>
      )}
    </div>
  );
}
