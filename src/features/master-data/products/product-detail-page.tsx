import { useParams } from 'react-router-dom';
import { DataState } from '@/features/ux-kit/data-state';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { Section } from '@/features/ux-kit/page-layout';
import type { MasterProductView } from '../api/master-data-types';
import { PRODUCTS } from '../api/record-resource';
import { useRecordDetail } from '../api/use-record-queries';
import { LifecycleActions } from '../components/lifecycle-actions';
import { MasterDataLayout } from '../components/master-data-layout';
import { RecordStatusBadge } from '../components/record-status-badge';
import { useMasterDataWriter } from '../hooks/use-master-data-writer';
import { useRecordEditor } from '../hooks/use-record-editor';
import { changedFields } from '../model/changed-fields';
import { ProductForm } from './product-form';
import {
  productChangeOf,
  productCreateOf,
  productDraftOf,
  validateProduct,
  type ProductChangeBody,
  type ProductCreateBody,
  type ProductDraft,
} from './product-form-model';

const BACK = { to: '/master-data/products', label: 'Products' };

function ProductEditor({ product }: { product: MasterProductView | null }) {
  const canWrite = useMasterDataWriter();
  const editor = useRecordEditor<ProductDraft, MasterProductView, ProductCreateBody, Partial<ProductChangeBody>>({
    source: PRODUCTS,
    record: product,
    initial: productDraftOf(product),
    validate: validateProduct,
    toCreate: productCreateOf,
    toChange: (draft, stored) => changedFields(productChangeOf(draft), stored),
    kind: 'Product',
    detailPath: (id) => `/master-data/products/${id}`,
    list: BACK,
  });
  return (
    <div className="space-y-4">
      {editor.alert}
      <ProductForm
        draft={editor.draft}
        errors={editor.errors}
        onChange={editor.patch}
        onSave={() => void editor.save()}
        saving={editor.saving}
        dirty={editor.dirty}
        isNew={product === null}
        readOnly={!canWrite || product?.isActive === false}
      />
      {editor.dialog}
    </div>
  );
}

/** `/master-data/products/new` and `/master-data/products/:productId`. */
export function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const canWrite = useMasterDataWriter();
  const query = useRecordDetail<MasterProductView>(PRODUCTS, productId ?? null);
  const product = query.data ?? null;
  if (!productId) {
    return (
      <MasterDataLayout title="Create product" back={BACK}>
        <ProductEditor product={null} />
      </MasterDataLayout>
    );
  }
  if (!product) {
    return (
      <MasterDataLayout title="Product" back={BACK}>
        {query.isError ? <FriendlyErrorAlert error={query.error} onRetry={() => void query.refetch()} /> : <DataState state="loading" />}
      </MasterDataLayout>
    );
  }
  const shared = product.availability === 'organization';
  const actions = canWrite ? (
    <LifecycleActions
      source={PRODUCTS}
      id={product.id}
      retired={!product.isActive}
      kind="product"
      name={product.name}
      retireNote={`Profiles, plans and periods keep this product; it can no longer be chosen for new records${shared ? ' in any plant of the organization' : ''}.`}
    />
  ) : undefined;
  return (
    <MasterDataLayout title={product.name} description={<RecordStatusBadge retired={!product.isActive} />} back={BACK} actions={actions}>
      <Section title="Details" description={shared ? 'Changes apply to every plant of the organization.' : undefined}>
        <ProductEditor product={product} />
      </Section>
    </MasterDataLayout>
  );
}
