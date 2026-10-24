import { useMemo } from 'react';
import { useProducts } from '@/api/v2/queries/profiles';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { MultiCheckSelect } from '@/features/event-hub/components/multi-check-select';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { Label } from '@/components/ui/label';
import { DateInput } from '@/features/ux-kit/date-inputs';
import { FIELD_CLASS } from '../components/analytics-filters';
import { KpiInfo } from '../dashboard/kpi-info';
import type { CapacityGapFilters as Filters } from './capacity-gap-model';

export interface CapacityGapFiltersProps {
  unitIds: readonly string[];
  filters: Filters;
  onUnits: (unitIds: string[]) => void;
  onFilters: (patch: Partial<Filters>) => void;
}

/** Units, products and the "as of" plant date of the capacity gap report (all sent to the server), one bottom-aligned row, labels above. */
export function CapacityGapFilters({ unitIds, filters, onUnits, onFilters }: CapacityGapFiltersProps) {
  const env = useEventHubEnv();
  const products = useProducts();
  const productOptions = useMemo(
    () => flattenPages(products.data?.pages).map((product) => ({ value: product.id, label: product.name })),
    [products.data],
  );
  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3" role="group" aria-label="Capacity gap filters" data-testid="capacity-gap-filters">
      <div>
        <MultiCheckSelect
          label="Units"
          testId="capacity-filter-units"
          options={env.units.map((unit) => ({ value: unit.id, label: unit.name }))}
          selected={unitIds}
          onChange={(next) => onUnits([...next].sort())}
          commitOnClose
        />
      </div>
      <div>
        <MultiCheckSelect
          label="Products"
          testId="capacity-filter-products"
          options={productOptions}
          selected={filters.productIds}
          onChange={(next) => onFilters({ productIds: [...next].sort() })}
          commitOnClose
        />
      </div>
      <div className={`${FIELD_CLASS} w-44`}>
        <span className="flex items-center gap-1">
          <Label htmlFor="capacity-as-of">As of</Label>
          <KpiInfo label="As of" text="The plant date the approved rates are read at; leave it empty for now." />
        </span>
        <DateInput id="capacity-as-of" label="As of" hideLabel compact value={filters.asOf} onChange={(asOf) => onFilters({ asOf })} />
      </div>
    </div>
  );
}
