import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PRODUCTS } from '@/features/master-data/api/record-resource';
import { useRecordLookup } from '@/features/master-data/api/use-record-queries';
import type { MasterProductView } from '@/features/master-data/api/master-data-types';
import { FIELD_CLASS, SELECT_CLASS } from '@/features/pla-analytics/components/filter-classes';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { DateRangeInput } from '@/features/ux-kit/date-inputs';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import type { ReadinessFilters } from './readiness-model';

export interface ReadinessFilterFieldsProps {
  filters: ReadinessFilters;
  onChange: (filters: ReadinessFilters) => void;
  timezone: string;
}

type FieldProps = Pick<ReadinessFilterFieldsProps, 'filters' | 'onChange'>;

const MODE_INFO = 'Must match the production profile. Applied when you leave this field.';

function ProductField({ filters, onChange }: FieldProps) {
  const products = useRecordLookup<MasterProductView>(PRODUCTS, { status: 'active', sort: 'code' });
  const selectedUnavailable = filters.productId && !products.items.some((product) => product.id === filters.productId);
  return (
    <div className={FIELD_CLASS}>
      <Label htmlFor="readiness-product">Product grade</Label>
      <select
        id="readiness-product"
        className={`${SELECT_CLASS} w-full sm:w-72`}
        value={filters.productId}
        disabled={products.isLoading}
        onChange={(event) => onChange({ ...filters, productId: event.target.value })}
      >
        <option value="">Choose a product to check rates and output</option>
        {selectedUnavailable && <option value={filters.productId}>Previously selected product (unavailable)</option>}
        {products.items.map((product) => <option key={product.id} value={product.id}>{product.code} — {product.name}</option>)}
      </select>
      {products.isError && <FriendlyErrorAlert error={products.error} onRetry={() => void products.refetch()} />}
    </div>
  );
}

function ModeField({ filters, onChange }: FieldProps) {
  const [modeDraft, setModeDraft] = useState(filters.operatingMode);
  return (
    <div className={FIELD_CLASS}>
      <div className="flex items-center gap-1.5">
        <Label htmlFor="readiness-mode">Operating mode</Label>
        <KpiInfo label="Operating mode" text={MODE_INFO} />
      </div>
      <Input
        id="readiness-mode"
        className="h-9 w-full sm:w-40"
        value={modeDraft}
        maxLength={64}
        onChange={(event) => setModeDraft(event.target.value)}
        onBlur={() => onChange({ ...filters, operatingMode: modeDraft.trim() || 'normal' })}
      />
    </div>
  );
}

/**
 * Product, operating mode and window of the readiness checks: one bottom-aligned row of h-9 controls, the
 * window typed in the plant date format with the plant calendar beside each day (cleanup 25 Oct 2026).
 */
export function ReadinessFilterFields({ filters, onChange, timezone }: ReadinessFilterFieldsProps) {
  return (
    <div className="flex flex-wrap items-end gap-3" data-testid="readiness-filters">
      <ProductField filters={filters} onChange={onChange} />
      <ModeField filters={filters} onChange={onChange} />
      <DateRangeInput
        label="Readiness window (whole production days, maximum 31)"
        timeZone={timezone}
        value={filters.range}
        onChange={(range) => onChange({ ...filters, range })}
        toLabel="To"
        textEntry
        calendarPicker
        toolbar
      />
    </div>
  );
}
