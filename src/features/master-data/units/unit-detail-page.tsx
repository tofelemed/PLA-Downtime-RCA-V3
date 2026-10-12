import { useParams } from 'react-router-dom';
import { usePlantSelection } from '@/contexts/PlantSelectionContext';
import { DataState } from '@/features/ux-kit/data-state';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { Section } from '@/features/ux-kit/page-layout';
import type { MasterUnitView } from '../api/master-data-types';
import { UNITS } from '../api/record-resource';
import { useRecordDetail } from '../api/use-record-queries';
import { CustomAttributesSection } from '../components/custom-attributes-section';
import { LifecycleActions } from '../components/lifecycle-actions';
import { MasterDataLayout } from '../components/master-data-layout';
import { RecordStatusBadge } from '../components/record-status-badge';
import { SourceMappingsSection } from '../components/source-mappings-section';
import { useMasterDataWriter } from '../hooks/use-master-data-writer';
import { useRecordEditor } from '../hooks/use-record-editor';
import { changedFields } from '../model/changed-fields';
import { UnitAssetsSection } from './unit-assets-section';
import { UnitForm } from './unit-form';
import { unitBodyOf, unitDraftOf, validateUnit, type UnitBody, type UnitDraft } from './unit-form-model';

const BACK = { to: '/master-data/units', label: 'Production units' };

function UnitEditor({ unit }: { unit: MasterUnitView | null }) {
  const canWrite = useMasterDataWriter();
  const { selection } = usePlantSelection();
  const editor = useRecordEditor<UnitDraft, MasterUnitView, UnitBody, Partial<UnitBody>>({
    source: UNITS,
    record: unit,
    initial: unitDraftOf(unit),
    validate: validateUnit,
    toCreate: unitBodyOf,
    toChange: (draft, stored) => changedFields(unitBodyOf(draft), stored),
    kind: 'Unit',
    detailPath: (id) => `/master-data/units/${id}`,
  });
  const retired = unit?.retiredAt != null;
  return (
    <UnitForm
      draft={editor.draft}
      errors={editor.errors}
      onChange={editor.patch}
      onSave={() => void editor.save()}
      saving={editor.saving}
      isNew={unit === null}
      readOnly={!canWrite || retired}
      plantName={selection?.tenant?.name ?? 'The selected plant'}
    />
  );
}

/** `/master-data/units/new` and `/master-data/units/:unitId`: create or edit a production unit. */
export function UnitDetailPage() {
  const { unitId } = useParams<{ unitId: string }>();
  const isNew = !unitId;
  const canWrite = useMasterDataWriter();
  const { selection } = usePlantSelection();
  const query = useRecordDetail<MasterUnitView>(UNITS, unitId ?? null);
  const unit = query.data ?? null;
  if (isNew) {
    return (
      <MasterDataLayout title="Create production unit" back={BACK}>
        <UnitEditor unit={null} />
      </MasterDataLayout>
    );
  }
  if (!unit) {
    return (
      <MasterDataLayout title="Production unit" back={BACK}>
        {query.isError ? <FriendlyErrorAlert error={query.error} onRetry={() => void query.refetch()} /> : <DataState state="loading" />}
      </MasterDataLayout>
    );
  }
  const actions = canWrite ? (
    <LifecycleActions
      source={UNITS}
      id={unit.id}
      retired={unit.retiredAt !== null}
      kind="unit"
      name={unit.name}
      retireNote="Events, plans and profiles keep this unit; it can no longer be chosen for new records. A unit with active assets cannot be retired."
    />
  ) : undefined;
  return (
    <MasterDataLayout title={unit.name} description={<RecordStatusBadge retired={unit.retiredAt !== null} />} back={BACK} actions={actions}>
      <Section title="Details">
        <UnitEditor unit={unit} />
      </Section>
      <UnitAssetsSection unitId={unit.id} canAdd={canWrite && unit.retiredAt === null} />
      <CustomAttributesSection entityType="Unit" entityId={unit.id} organizationId={selection?.organization?.id} canWrite={canWrite} />
      <SourceMappingsSection targetId={unit.id} />
    </MasterDataLayout>
  );
}
