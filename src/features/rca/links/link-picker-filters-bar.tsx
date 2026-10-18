import { useAllCodes } from '@/api/v2/queries/reference-data';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { Label } from '@/components/ui/label';
import { DateInput } from '@/features/ux-kit/date-inputs';
import { DebouncedSearchInput } from '@/features/ux-kit/debounced-search-input';
import { ReasonCodePicker } from '@/features/ux-kit/reason-code-picker/reason-code-picker';
import type { LinkPickerFilters } from '../model/link-picker';
import { useUnitNames } from '../use-unit-names';

export interface LinkPickerFiltersBarProps {
  /** prefix of the control ids (one bar per picker) */
  idPrefix: string;
  value: LinkPickerFilters;
  onChange: (next: LinkPickerFilters) => void;
  searchLabel: string;
  /** a reason the window cannot be searched (shown under the dates) */
  windowError?: string | null;
}

/** Unit, reason, plant-day window and text search of a link picker (the server filters). */
export function LinkPickerFiltersBar({ idPrefix, value, onChange, searchLabel, windowError }: LinkPickerFiltersBarProps) {
  const { units } = useUnitNames();
  const codes = useAllCodes('reason-codes', { includeRetired: true });
  const set = (patch: Partial<LinkPickerFilters>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" data-testid={`${idPrefix}-filters`}>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-unit`}>Unit</Label>
        <select id={`${idPrefix}-unit`} className="h-10 w-full rounded border bg-background px-2 text-sm" value={value.unitId} onChange={(e) => set({ unitId: e.target.value })}>
          <option value="">All units</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name}
            </option>
          ))}
        </select>
      </div>
      <ReasonCodePicker
        id={`${idPrefix}-reason`}
        label="Reason"
        codes={flattenPages(codes.data?.pages)}
        value={value.reasonCodeId}
        emptyLabel="Any reason"
        onChange={(reasonCodeId) => set({ reasonCodeId })}
      />
      <DateInput id={`${idPrefix}-from`} label="From" value={value.fromDay} onChange={(fromDay) => set({ fromDay })} error={windowError} />
      <DateInput id={`${idPrefix}-to`} label="To" value={value.toDay} onChange={(toDay) => set({ toDay })} />
      <div className="space-y-1">
        <p className="text-sm font-medium" aria-hidden="true">
          Search
        </p>
        <DebouncedSearchInput label={searchLabel} placeholder="Search" value={value.q} onChange={(q) => set({ q })} />
      </div>
    </div>
  );
}
