import type { FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { DataState } from '@/features/ux-kit/data-state';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { Section } from '@/features/ux-kit/page-layout';
import type { RcaTemplateView } from '../api/master-data-types';
import { RCA_TEMPLATES } from '../api/record-resource';
import { useRecordDetail } from '../api/use-record-queries';
import { FormActions } from '../components/form-actions';
import { LifecycleActions } from '../components/lifecycle-actions';
import { MasterDataLayout } from '../components/master-data-layout';
import { RecordStatusBadge } from '../components/record-status-badge';
import { TextField } from '../components/text-field';
import { useMasterDataWriter } from '../hooks/use-master-data-writer';
import { useRecordEditor } from '../hooks/use-record-editor';
import { ChecklistPicker } from './checklist-picker';
import { LogicTreeEditor } from './logic-tree-editor';
import { TemplateFacts } from './template-facts';
import { templateBodyOf, templateChangeOf, templateDraftOf, validateTemplate, type TemplateBody, type TemplateDraft } from './template-form-model';

const BACK = { to: '/master-data/rca/templates', label: 'RCA templates' };

function TemplateEditor({ template }: { template: RcaTemplateView | null }) {
  const canWrite = useMasterDataWriter();
  const readOnly = !canWrite || template?.isActive === false;
  const editor = useRecordEditor<TemplateDraft, RcaTemplateView, TemplateBody, Partial<TemplateBody>>({
    source: RCA_TEMPLATES,
    record: template,
    initial: templateDraftOf(template),
    validate: validateTemplate,
    toCreate: templateBodyOf,
    toChange: templateChangeOf,
    kind: 'RCA template',
    detailPath: (id) => `/master-data/rca/templates/${id}`,
    list: BACK,
  });
  const { draft, errors, patch } = editor;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void editor.save();
  };
  return (
    <form onSubmit={submit} className="space-y-6" noValidate aria-label={template ? 'Edit RCA template' : 'Create RCA template'}>
      {editor.alert}
      <Section title="Details">
        {readOnly && template ? <TemplateFacts template={template} /> : <TemplateFields editor={editor} />}
      </Section>
      <Section title="Logic tree" titleAside={<KpiInfo label="Logic tree" text="Possible causes, from the failure down to root causes." />}>
        <LogicTreeEditor tree={draft.logicTree} onChange={(logicTree) => patch({ logicTree })} editable={!readOnly} />
        {errors.logicTree && <p className="text-sm text-destructive">{errors.logicTree}</p>}
      </Section>
      {!readOnly && <FormActions isNew={template === null} saving={editor.saving} dirty={editor.dirty} cancelTo={BACK.to} />}
      {editor.dialog}
    </form>
  );
}

type TemplateEditorState = ReturnType<typeof useRecordEditor<TemplateDraft, RcaTemplateView, TemplateBody, Partial<TemplateBody>>>;

/** The editable details of a template (writers, active or new templates). */
function TemplateFields({ editor }: { editor: TemplateEditorState }) {
  const { draft, errors, patch } = editor;
  return (
    <>
      <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
        <TextField id="name" label="Name" value={draft.name} onChange={(name) => patch({ name })} error={errors.name} required />
        <TextField id="category" label="Category" value={draft.category} onChange={(category) => patch({ category })} error={errors.category} hint="e.g. Equipment failure" required />
      </div>
      <div className="max-w-2xl">
        <TextField id="description" label="Description" value={draft.description} onChange={(description) => patch({ description })} multiline />
      </div>
      <ChecklistPicker value={draft.checklistIds} onChange={(checklistIds) => patch({ checklistIds })} disabled={false} />
    </>
  );
}

/** `/master-data/rca/templates/new` and `/master-data/rca/templates/:templateId`. */
export function RcaTemplateDetailPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const canWrite = useMasterDataWriter();
  const query = useRecordDetail<RcaTemplateView>(RCA_TEMPLATES, templateId ?? null);
  const template = query.data ?? null;
  if (!templateId) {
    return (
      <MasterDataLayout title="Create RCA template" back={BACK}>
        <TemplateEditor template={null} />
      </MasterDataLayout>
    );
  }
  if (!template) {
    return (
      <MasterDataLayout title="RCA template" back={BACK}>
        {query.isError ? <FriendlyErrorAlert error={query.error} onRetry={() => void query.refetch()} /> : <DataState state="loading" />}
      </MasterDataLayout>
    );
  }
  const actions = canWrite ? (
    <LifecycleActions
      source={RCA_TEMPLATES}
      id={template.id}
      retired={!template.isActive}
      kind="template"
      name={template.name}
      retireNote="Investigations that used it keep it; new investigations can no longer start from it."
    />
  ) : undefined;
  return (
    <MasterDataLayout title={template.name} description={<RecordStatusBadge retired={!template.isActive} />} back={BACK} actions={actions}>
      <TemplateEditor template={template} />
    </MasterDataLayout>
  );
}
