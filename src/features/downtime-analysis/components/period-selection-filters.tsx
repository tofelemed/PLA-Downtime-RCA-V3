import { useCalendarVersions, useCrews } from '@/api/v2/queries/calendars';
import { useProducts } from '@/api/v2/queries/profiles';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { MultiCheckSelect } from '@/features/event-hub/components/multi-check-select';
import type { DowntimeFilters } from '../model/downtime-filters';

export interface PeriodSelectionFiltersProps {
  filters: DowntimeFilters;
  onChange: (patch: Partial<DowntimeFilters>) => void;
}

const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label);

/** Shift labels of the published calendars (the names periods carry), each once. */
function useShiftOptions() {
  const versions = flattenPages(useCalendarVersions({}).data?.pages);
  const names = new Set(versions.filter((v) => v.state === 'published').flatMap((v) => v.shiftTemplates.map((shift) => shift.name)));
  return [...names].map((name) => ({ value: name, label: name })).sort(byLabel);
}

/**
 * Product, shift and crew filters of the Downtime page: the server keeps only the periods that ran one of
 * the products, or of the chosen shifts or crews, for the summary and every breakdown.
 */
export function PeriodSelectionFilters({ filters, onChange }: PeriodSelectionFiltersProps) {
  const products = flattenPages(useProducts().data?.pages).map((p) => ({ value: p.id, label: `${p.code} ${p.name}` }));
  const crews = flattenPages(useCrews().data?.pages).map((c) => ({ value: c.id, label: c.name }));
  const shifts = useShiftOptions();
  return (
    <>
      <MultiCheckSelect
        label="Products"
        testId="filter-products"
        options={products.sort(byLabel)}
        selected={filters.productIds}
        onChange={(productIds) => onChange({ productIds: [...productIds].sort() })}
        commitOnClose
      />
      <MultiCheckSelect label="Shifts" testId="filter-shifts" options={shifts} selected={filters.shiftNames} onChange={(shiftNames) => onChange({ shiftNames: [...shiftNames].sort() })} commitOnClose />
      <MultiCheckSelect
        label="Crews"
        testId="filter-crews"
        options={crews.sort(byLabel)}
        selected={filters.crewIds}
        onChange={(crewIds) => onChange({ crewIds: [...crewIds].sort() })}
        commitOnClose
      />
    </>
  );
}
