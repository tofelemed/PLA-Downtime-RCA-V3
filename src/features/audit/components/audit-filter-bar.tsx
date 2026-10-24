import { Label } from '@/components/ui/label';
import { FilterSelect, type FilterOption } from '@/features/admin/shared/filter-select';
import { FIELD_CLASS } from '@/features/pla-analytics/components/filter-classes';
import { DateRangeInput } from '@/features/ux-kit/date-inputs';
import { DebouncedSearchInput } from '@/features/ux-kit/debounced-search-input';
import type { AuditUrlFilters } from '../model/audit-filters';

export interface AuditFilterBarProps {
  values: AuditUrlFilters;
  timezone: string;
  /** the Entries view: search, action and record filters before the dates; the Work summary view has dates only */
  entries: boolean;
  actions: readonly FilterOption[];
  entities: readonly FilterOption[];
  onChange: (patch: Partial<AuditUrlFilters>) => void;
}

/** One bottom-aligned row (labels above, h-9): search, action, record type, then the period From / To. */
export function AuditFilterBar({ values, timezone, entries, actions, entities, onChange }: AuditFilterBarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3" data-testid="audit-filters">
      {entries && (
        <>
          <div className={`${FIELD_CLASS} w-full sm:w-72`}>
            <Label htmlFor="audit-search">Search</Label>
            <DebouncedSearchInput id="audit-search" label="Search actions, records and details" className="max-w-none [&_input]:h-9" value={values.q} onChange={(q) => onChange({ q })} />
          </div>
          <div className={FIELD_CLASS}>
            <Label htmlFor="audit-action">Action</Label>
            <FilterSelect id="audit-action" label="Action filter" className="h-9" value={values.action} options={actions} onChange={(action) => onChange({ action })} />
          </div>
          <div className={FIELD_CLASS}>
            <Label htmlFor="audit-entity">Record</Label>
            <FilterSelect id="audit-entity" label="Record type filter" className="h-9" value={values.entity} options={entities} onChange={(entity) => onChange({ entity })} />
          </div>
        </>
      )}
      <div className="contents [&_input]:w-28">
        <DateRangeInput
          label="Period"
          toLabel="To"
          calendarPicker
          textEntry
          toolbar
          value={{ from: values.from || null, to: values.to || null }}
          timeZone={timezone}
          onChange={(range) => {
            if (range.from && range.to) onChange({ from: range.from, to: range.to });
          }}
        />
      </div>
    </div>
  );
}
