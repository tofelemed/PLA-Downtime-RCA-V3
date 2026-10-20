import { useMemo } from 'react';
import { useProducts } from '@/api/v2/queries/profiles';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { MultiCheckSelect } from '@/features/event-hub/components/multi-check-select';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { DateInput } from '@/features/ux-kit/date-inputs';
import type { CapacityGapFilters as Filters } from './capacity-gap-model';

export interface CapacityGapFiltersProps {
  unitIds: readonly string[];
  filters: Filters;
  onUnits: (unitIds: string[]) => void;
  onFilters: (patch: Partial<Filters>) => void;
}

/** Units, products and the "as of" plant date of the capacity gap report (all sent to the server). */
export function CapacityGapFilters({ unitIds, filters, onUnits, onFilters }: CapacityGapFiltersProps) {
  const env = useEventHubEnv();
  const products = useProducts();
  const productOptions = useMemo(
    () => flattenPages(products.data?.pages).map((product) => ({ value: product.id, label: product.name })),
    [products.data],
  );
  return (
    <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Capacity gap filters" data-testid="capacity-gap-filters">
      <MultiCheckSelect
        label="Units"
        testId="capacity-filter-units"
        options={env.units.map((unit) => ({ value: unit.id, label: unit.name }))}
        selected={unitIds}
        onChange={(next) => onUnits([...next].sort())}
        commitOnClose
      />
      <MultiCheckSelect
        label="Products"
        testId="capacity-filter-products"
        options={productOptions}
        selected={filters.productIds}
        onChange={(next) => onFilters({ productIds: [...next].sort() })}
        commitOnClose
      />
      <div className="w-44">
        <DateInput label="As of (plant date, empty = now)" value={filters.asOf} onChange={(asOf) => onFilters({ asOf })} />
      </div>
    </div>
  );
}
