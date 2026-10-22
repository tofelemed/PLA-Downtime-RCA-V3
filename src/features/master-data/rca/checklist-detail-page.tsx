import type { FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataState } from '@/features/ux-kit/data-state';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { Section } from '@/features/ux-kit/page-layout';
import type { VerificationChecklistView } from '../api/master-data-types';
import { VERIFICATION_CHECKLISTS } from '../api/record-resource';
import { useRecordDetail } from '../api/use-record-queries';
import { FormActions } from '../components/form-actions';
import { LifecycleActions } from '../components/lifecycle-actions';
import { MasterDataLayout } from '../components/master-data-layout';
import { RecordStatusBadge } from '../components/record-status-badge';
import { TextField } from '../components/text-field';
import { useMasterDataWriter } from '../hooks/use-master-data-writer';
import { useRecordEditor } from '../hooks/use-record-editor';
import { requiredText, textOrNull } from '../model/field-errors';
import { ChecklistItemsEditor } from './checklist-items-editor';

const BACK = { to: '/master-data/rca/checklists', label: 'Verification checklists' };
const DEFAULT_COLOR = '#3B82F6';

interface ChecklistDraft {
  code: string;
  name: string;
  description: string;
  color: string;
  items: string[];
}

interface ChecklistBody {
  code: string;
  name: string;
  description: string | null;
  color: string;
  items: string[];
}

const draftOf = (checklist: VerificationChecklistView | null): ChecklistDraft => ({
  code: checklist?.code ?? '',
  name: checklist?.name ?? '',
  description: checklist?.description ?? '',
  color: checklist?.color ?? DEFAULT_COLOR,
  items: checklist?.items ?? [],
});

const bodyOf = (draft: ChecklistDraft): ChecklistBody => ({
  code: draft.code.trim(),
  name: draft.name.trim(),
  description: textOrNull(draft.description),
  color: draft.color.toUpperCase(),
  items: draft.items,
});

function ChecklistEditor({ checklist }: { checklist: VerificationChecklistView | null }) {
  const canWrite = useMasterDataWriter();
  const readOnly = !canWrite || checklist?.isActive === false;
  const editor = useRecordEditor<ChecklistDraft, VerificationChecklistView, ChecklistBody, ChecklistBody>({
    source: VERIFICATION_CHECKLISTS,
    record: checklist,
    initial: draftOf(checklist),
    validate: (draft) => ({ code: requiredText(draft.code, 'Code'), name: requiredText(draft.name, 'Name') }),
    toCreate: bodyOf,
    toChange: bodyOf,
    kind: 'Checklist',
    detailPath: (id) => `/master-data/rca/checklists/${id}`,
    list: BACK,
  });
  const { draft, errors, patch } = editor;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void editor.save();
  };
  return (
    <form onSubmit={submit} className="max-w-2xl space-y-4" noValidate aria-label={checklist ? 'Edit checklist' : 'Create checklist'}>
      {editor.alert}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="name" label="Name" value={draft.name} onChange={(name) => patch({ name })} error={errors.name} required disabled={readOnly} />
        <TextField id="code" label="Code" value={draft.code} onChange={(code) => patch({ code })} error={errors.code} hint="Unique, e.g. VC-BEARING." required disabled={readOnly} />
      </div>
      <TextField id="description" label="Description" value={draft.description} onChange={(description) => patch({ description })} multiline disabled={readOnly} />
      <div className="space-y-1.5">
        <Label htmlFor="color">Badge colour</Label>
        <Input id="color" type="color" className="h-9 w-20 p-1" value={draft.color} onChange={(event) => patch({ color: event.target.value })} disabled={readOnly} />
      </div>
      <ChecklistItemsEditor items={draft.items} onChange={(items) => patch({ items })} disabled={readOnly} />
      {!readOnly && <FormActions isNew={checklist === null} saving={editor.saving} dirty={editor.dirty} cancelTo={BACK.to} />}
      {editor.dialog}
    </form>
  );
}

/** `/master-data/rca/checklists/new` and `/master-data/rca/checklists/:checklistId`. */
export function ChecklistDetailPage() {
  const { checklistId } = useParams<{ checklistId: string }>();
  const canWrite = useMasterDataWriter();
  const query = useRecordDetail<VerificationChecklistView>(VERIFICATION_CHECKLISTS, checklistId ?? null);
  const checklist = query.data ?? null;
  if (!checklistId) {
    return (
      <MasterDataLayout title="Create verification checklist" back={BACK}>
        <ChecklistEditor checklist={null} />
      </MasterDataLayout>
    );
  }
  if (!checklist) {
    return (
      <MasterDataLayout title="Verification checklist" back={BACK}>
        {query.isError ? <FriendlyErrorAlert error={query.error} onRetry={() => void query.refetch()} /> : <DataState state="loading" />}
      </MasterDataLayout>
    );
  }
  const actions = canWrite ? (
    <LifecycleActions source={VERIFICATION_CHECKLISTS} id={checklist.id} retired={!checklist.isActive} kind="checklist" name={checklist.name} retireNote="Templates keep naming it; it can no longer be added to a template." />
  ) : undefined;
  return (
    <MasterDataLayout title={checklist.name} description={<RecordStatusBadge retired={!checklist.isActive} />} back={BACK} actions={actions}>
      <Section title="Details">
        <ChecklistEditor checklist={checklist} />
      </Section>
    </MasterDataLayout>
  );
}
