import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PRODUCTS } from '@/features/master-data/api/record-resource';
import { useRecordLookup } from '@/features/master-data/api/use-record-queries';
import type { MasterProductView } from '@/features/master-data/api/master-data-types';
import { DateRangeInput } from '@/features/ux-kit/date-inputs';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import type { ReadinessFilters } from './readiness-model';

export function ReadinessFilterFields({ filters, onChange, timezone }: { filters: ReadinessFilters; onChange: (filters: ReadinessFilters) => void; timezone: string }) {
  const [modeDraft, setModeDraft] = useState(filters.operatingMode);
  const products = useRecordLookup<MasterProductView>(PRODUCTS, { status: 'active', sort: 'code' });
  const selectedUnavailable = filters.productId && !products.items.some((product) => product.id === filters.productId);
  return <>
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-1"><Label htmlFor="readiness-product">Product grade</Label>
        <select id="readiness-product" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={filters.productId} disabled={products.isLoading} onChange={(event) => onChange({ ...filters, productId: event.target.value })}>
          <option value="">Choose a product to check rates and output</option>
          {selectedUnavailable && <option value={filters.productId}>Previously selected product (unavailable)</option>}
          {products.items.map((product) => <option key={product.id} value={product.id}>{product.code} — {product.name}</option>)}
        </select>
        {products.isError && <FriendlyErrorAlert error={products.error} onRetry={() => void products.refetch()} />}
      </div>
      <div className="space-y-1"><Label htmlFor="readiness-mode">Operating mode</Label>
        <Input id="readiness-mode" value={modeDraft} maxLength={64} onChange={(event) => setModeDraft(event.target.value)} onBlur={() => onChange({ ...filters, operatingMode: modeDraft.trim() || 'normal' })} />
        <p className="text-xs text-muted-foreground">Must match the production profile. Applied when you leave this field.</p>
      </div>
    </div>
    <DateRangeInput label="Readiness window (maximum 31 days)" mode="datetime" timeZone={timezone} value={filters.range} onChange={(range) => onChange({ ...filters, range })} />
  </>;
}
