import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { PRODUCT_AVAILABILITY_LABELS } from '@/features/ux-kit/labels';
import { ActionIcon } from '@/lib/icons';
import type { MasterProductView } from '../api/master-data-types';
import { PRODUCTS } from '../api/record-resource';
import { usePrefetchRecord, useRecordPage } from '../api/use-record-queries';
import { ListToolbar } from '../components/list-toolbar';
import { MasterDataLayout } from '../components/master-data-layout';
import { RecordListCard } from '../components/record-list-card';
import { RecordLink } from '../components/record-link';
import { RecordStatusBadge } from '../components/record-status-badge';
import { listQueryOf, useListFilters } from '../hooks/use-list-filters';
import { useMasterDataWriter } from '../hooks/use-master-data-writer';

/** Status only when the list mixes active and retired products (otherwise it repeats the filter on every row). */
function useColumns(showStatus: boolean): DataTableColumn<MasterProductView>[] {
  const prefetch = usePrefetchRecord(PRODUCTS);
  return [
    { id: 'code', header: 'Code', cell: (product) => product.code, nowrap: true },
    {
      id: 'name',
      header: 'Name',
      cell: (product) => (
        <RecordLink to={`/master-data/products/${product.id}`} onPrefetch={() => prefetch(product.id)}>
          {product.name}
        </RecordLink>
      ),
    },
    { id: 'uom', header: 'Unit of measure', cell: (product) => product.uom ?? '—', nowrap: true },
    {
      id: 'availability',
      header: 'Available to',
      cell: (product) => <Badge variant="outline" className="whitespace-nowrap">{PRODUCT_AVAILABILITY_LABELS[product.availability]}</Badge>,
    },
    ...(showStatus ? [{ id: 'status', header: 'Status', nowrap: true, cell: (product: MasterProductView) => <RecordStatusBadge retired={!product.isActive} /> }] : []),
  ];
}

const PRODUCTS_INFO = "Products belong to the organization and are shared by its plants, unless kept to one plant. Production profiles and plans use the plant's own products.";

/** `/master-data/products`: products shared by the organization plus those kept to this plant. */
export function ProductsPage() {
  const navigate = useNavigate();
  const { filters, update } = useListFilters();
  const canWrite = useMasterDataWriter();
  const products = useRecordPage<MasterProductView>(PRODUCTS, { ...listQueryOf(filters), includeOrganization: true });
  const columns = useColumns(filters.status === 'all');
  const addProduct = canWrite ? (
    <Button asChild>
      <Link to="/master-data/products/new">
        <ActionIcon.add aria-hidden="true" className="mr-2 h-4 w-4" />
        Add product
      </Link>
    </Button>
  ) : undefined;
  return (
    <MasterDataLayout title="Products" actions={addProduct}>
      <RecordListCard title="Products" info={PRODUCTS_INFO} testId="products-card">
        <ListToolbar filters={filters} onChange={update} searchLabel="Search products" compact />
        <DataTable
          caption="Products"
          columns={columns}
          rows={products.rows}
          getRowKey={(product) => product.id}
          onRowClick={(product) => navigate(`/master-data/products/${product.id}`)}
          rowsHaveLink
          pager={products.pager}
          status={products.status}
          empty={{ title: 'No products', text: filters.q ? 'No product matches the search.' : 'No product with this status yet.' }}
        />
      </RecordListCard>
    </MasterDataLayout>
  );
}
