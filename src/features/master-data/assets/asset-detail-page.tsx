import { useParams, useSearchParams } from 'react-router-dom';
import { usePlantSelection } from '@/contexts/PlantSelectionContext';
import { DataState } from '@/features/ux-kit/data-state';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { Section } from '@/features/ux-kit/page-layout';
import type { MasterAssetView } from '../api/master-data-types';
import { ASSETS } from '../api/record-resource';
import { useRecordDetail } from '../api/use-record-queries';
import { CustomAttributesSection } from '../components/custom-attributes-section';
import { LifecycleActions } from '../components/lifecycle-actions';
import { MasterDataLayout } from '../components/master-data-layout';
import { RecordStatusBadge } from '../components/record-status-badge';
import { SourceMappingsSection } from '../components/source-mappings-section';
import { useMasterDataWriter } from '../hooks/use-master-data-writer';
import { useRecordEditor } from '../hooks/use-record-editor';
import { changedFields } from '../model/changed-fields';
import { AssetForm } from './asset-form';
import { assetBodyOf, assetDraftOf, validateAsset, type AssetBody, type AssetDraft } from './asset-form-model';

const BACK = { to: '/master-data/assets', label: 'Assets' };

function AssetEditor({ asset, unitId }: { asset: MasterAssetView | null; unitId?: string }) {
  const canWrite = useMasterDataWriter();
  const editor = useRecordEditor<AssetDraft, MasterAssetView, AssetBody, Partial<AssetBody>>({
    source: ASSETS,
    record: asset,
    initial: assetDraftOf(asset, unitId),
    validate: validateAsset,
    toCreate: assetBodyOf,
    toChange: (draft, stored) => changedFields(assetBodyOf(draft), stored),
    kind: 'Asset',
    detailPath: (id) => `/master-data/assets/${id}`,
  });
  return (
    <AssetForm
      draft={editor.draft}
      errors={editor.errors}
      onChange={editor.patch}
      onSave={() => void editor.save()}
      saving={editor.saving}
      isNew={asset === null}
      readOnly={!canWrite || asset?.retiredAt != null}
    />
  );
}

/** `/master-data/assets/new` (optionally `?unitId=`) and `/master-data/assets/:assetId`. */
export function AssetDetailPage() {
  const { assetId } = useParams<{ assetId: string }>();
  const [params] = useSearchParams();
  const canWrite = useMasterDataWriter();
  const { selection } = usePlantSelection();
  const query = useRecordDetail<MasterAssetView>(ASSETS, assetId ?? null);
  const asset = query.data ?? null;
  if (!assetId) {
    return (
      <MasterDataLayout title="Create asset" back={BACK}>
        <AssetEditor asset={null} unitId={params.get('unitId') ?? ''} />
      </MasterDataLayout>
    );
  }
  if (!asset) {
    return (
      <MasterDataLayout title="Asset" back={BACK}>
        {query.isError ? <FriendlyErrorAlert error={query.error} onRetry={() => void query.refetch()} /> : <DataState state="loading" />}
      </MasterDataLayout>
    );
  }
  const actions = canWrite ? (
    <LifecycleActions
      source={ASSETS}
      id={asset.id}
      retired={asset.retiredAt !== null}
      kind="asset"
      name={asset.name}
      retireNote="Events and RCA cases keep this asset; it can no longer be chosen for new records."
    />
  ) : undefined;
  return (
    <MasterDataLayout title={asset.name} description={<RecordStatusBadge retired={asset.retiredAt !== null} />} back={BACK} actions={actions}>
      <Section title="Details">
        <AssetEditor asset={asset} />
      </Section>
      <CustomAttributesSection entityType="Asset" entityId={asset.id} organizationId={selection?.organization?.id} canWrite={canWrite} />
      <SourceMappingsSection targetId={asset.id} />
    </MasterDataLayout>
  );
}
