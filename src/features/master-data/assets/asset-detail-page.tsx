import { useParams, useSearchParams } from 'react-router-dom';
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
import { useRecordBack } from '../hooks/use-record-back';
import { useRecordEditor } from '../hooks/use-record-editor';
import type { RecordListLink } from '../hooks/record-save-result';
import { changedFields } from '../model/changed-fields';
import { AssetForm } from './asset-form';
import { assetBodyOf, assetDraftOf, validateAsset, type AssetBody, type AssetDraft } from './asset-form-model';

const LIST = { to: '/master-data/assets', label: 'Assets' };
/** opened from a unit's asset list or the plant hierarchy: Back and Cancel return there */
const ORIGINS = [
  { prefix: '/master-data/units', label: 'Production unit' },
  { prefix: '/master-data/hierarchy', label: 'Plant hierarchy' },
];

function AssetEditor({ asset, unitId, back }: { asset: MasterAssetView | null; unitId?: string; back: RecordListLink }) {
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
    list: back,
  });
  return (
    <div className="space-y-4">
      {editor.alert}
      <AssetForm
        draft={editor.draft}
        errors={editor.errors}
        onChange={editor.patch}
        onSave={() => void editor.save()}
        saving={editor.saving}
        dirty={editor.dirty}
        isNew={asset === null}
        readOnly={!canWrite || asset?.retiredAt != null}
        cancelTo={back.to}
      />
      {editor.dialog}
    </div>
  );
}

/**
 * `/master-data/assets/new` (optionally `?unitId=`) and `/master-data/assets/:assetId`; `?back=` names the unit or
 * hierarchy page it was opened from.
 */
export function AssetDetailPage() {
  const { assetId } = useParams<{ assetId: string }>();
  const [params] = useSearchParams();
  const canWrite = useMasterDataWriter();
  const query = useRecordDetail<MasterAssetView>(ASSETS, assetId ?? null);
  const asset = query.data ?? null;
  const back = useRecordBack(LIST, ORIGINS);
  if (!assetId) {
    return (
      <MasterDataLayout title="Create asset" back={back}>
        <AssetEditor asset={null} unitId={params.get('unitId') ?? ''} back={back} />
      </MasterDataLayout>
    );
  }
  if (!asset) {
    return (
      <MasterDataLayout title="Asset" back={back}>
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
      retireNote="Events and investigations keep this asset; it can no longer be chosen for new records."
    />
  ) : undefined;
  return (
    <MasterDataLayout title={asset.name} description={<RecordStatusBadge retired={asset.retiredAt !== null} />} back={back} actions={actions}>
      <Section title="Details">
        <AssetEditor asset={asset} back={back} />
      </Section>
      <CustomAttributesSection entityType="Asset" entityId={asset.id} canWrite={canWrite} />
      <SourceMappingsSection targetId={asset.id} />
    </MasterDataLayout>
  );
}
