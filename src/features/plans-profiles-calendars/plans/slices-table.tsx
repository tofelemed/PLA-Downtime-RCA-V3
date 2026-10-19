import type { PlanSliceView, PlanVersionView } from '@/api/v2/types/plans';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { labelOf, SLICE_STREAM_LABELS } from '@/features/ux-kit/labels';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { Quantity } from '@/features/ux-kit/quantity';
import type { PlanningRefs } from '../hooks/use-planning-refs';

const muted = (text: string) => <span className="text-xs text-muted-foreground">{text}</span>;

/**
 * The version's product slices (campaigns) with their active interval, weight and target. An empty weight
 * says whether weights apply (explicit-weight distribution only); an empty slice target says the header
 * target applies (QA planning: no bare "—").
 */
export function SlicesTable({ version, refs, uom = null }: { version: PlanVersionView; refs: PlanningRefs; uom?: string | null }) {
  const weighted = version.distribution === 'explicit_weights';
  const columns: DataTableColumn<PlanSliceView>[] = [
    { id: 'position', header: '#', align: 'right', width: '3rem', cell: (slice) => slice.position + 1 },
    { id: 'product', header: 'Product', cell: (slice) => refs.productName(slice.productId) },
    {
      id: 'active',
      header: 'Active',
      nowrap: true,
      cell: (slice) => (
        <span className="text-xs">
          <PlantTime iso={slice.activeFrom} tz={refs.timezone} withDate /> → <PlantTime iso={slice.activeTo} tz={refs.timezone} withDate />
        </span>
      ),
    },
    { id: 'weight', header: 'Weight', align: 'right', cell: (slice) => (slice.weight ? <Quantity value={slice.weight} uom={null} /> : muted(weighted ? 'No weight' : 'Not used')) },
    { id: 'target', header: 'Slice target', align: 'right', cell: (slice) => (slice.target ? <Quantity value={slice.target} uom={uom} /> : muted(version.basis === 'quantity' ? 'Header target' : 'Not used')) },
    { id: 'stream', header: 'Products run', cell: (slice) => labelOf(SLICE_STREAM_LABELS, slice.stream) },
  ];
  return (
    <div data-testid="plan-slices">
      <DataTable caption="Product slices" columns={columns} rows={version.slices ?? []} getRowKey={(slice) => slice.id} density="compact" empty={{ text: 'No product slices.' }} />
    </div>
  );
}
