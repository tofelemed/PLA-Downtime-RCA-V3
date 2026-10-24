import { useState, type FormEvent } from 'react';
import { hasUnsavedChanges, useUnsavedChangesGuard } from '@/features/ux-kit/use-unsaved-changes-guard';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAttributeDefinition, useCreateAttribute, useDeleteAttribute, useUpdateAttribute } from '@/api/v2/queries/administration-config';
import { ATTRIBUTE_ENTITY_TYPES, type AttributeDefinitionView, type AttributeEntityType } from '@/api/v2/types/administration';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { ATTRIBUTE_SCOPE_LABELS, labelOf } from '@/features/ux-kit/labels';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { ActionIcon, StatusIcon } from '@/lib/icons';
import { AdminCard } from '../shared/admin-card';
import { PageGate } from '../shared/page-gate';
import { useCommandFeedback } from '../shared/use-command-feedback';
import { AttributeMainFields, AttributeRuleFields, type AttributeFieldsProps } from './attribute-fields';
import { AttributeReadOnly } from './attribute-read-only';
import { attributeFormOf, type AttributeFormValues, emptyAttributeForm, toAttributeInput, validateAttributeForm } from './attribute-form-model';

const BACK = { to: '/admin?tab=attributes', label: 'Admin panel' };
const backForLevel = (level: string) => ({ ...BACK, to: `${BACK.to}&level=${encodeURIComponent(level)}` });
/** Types with rules of their own (text length / pattern, number limits, choices). */
const RULED_TYPES: ReadonlySet<string> = new Set(['string', 'number', 'select']);

/** `/admin/attributes/new?level=Unit` and `/admin/attributes/:attributeId` (was the 13-field dialog). */
export function AttributeFormPage() {
  const { canUseAdminPanel, canManageMasterData } = useCapabilities();
  const { attributeId } = useParams();
  return (
    <PageGate title="Custom attribute" allowed={canUseAdminPanel || canManageMasterData} deniedText="You don't have permission to manage custom attributes.">
      {attributeId ? <EditAttribute id={attributeId} /> : <NewAttribute />}
    </PageGate>
  );
}

function NewAttribute() {
  const [params] = useSearchParams();
  const level = params.get('level');
  const entityType: AttributeEntityType = (ATTRIBUTE_ENTITY_TYPES as readonly string[]).includes(level ?? '') ? (level as AttributeEntityType) : 'Unit';
  const create = useCreateAttribute();
  return <AttributeEditor mode="create" initial={emptyAttributeForm(entityType)} save={(values) => create.submit(toAttributeInput(values, 'create'))} />;
}

function EditAttribute({ id }: { id: string }) {
  const definition = useAttributeDefinition(id);
  const update = useUpdateAttribute();
  if (!definition.data) {
    return (
      <Page>
        <PageHeader title="Custom attribute" back={BACK} />
        <DataState state={dataStateOf(definition)} error={definition.error} onRetry={() => void definition.refetch()} />
      </Page>
    );
  }
  const view = definition.data;
  return (
    <AttributeEditor
      key={view.updatedAt}
      mode="edit"
      view={view}
      initial={attributeFormOf(view)}
      save={(values) => update.submit({ id, body: toAttributeInput(values, 'edit') })}
    />
  );
}

interface EditorProps {
  mode: 'create' | 'edit';
  view?: AttributeDefinitionView;
  initial: AttributeFormValues;
  save: (values: AttributeFormValues) => Promise<unknown>;
}

function AttributeEditor({ mode, view, initial, save }: EditorProps) {
  const navigate = useNavigate();
  const back = backForLevel(initial.entityType);
  const { canManageMasterData } = useCapabilities();
  const feedback = useCommandFeedback();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<ReturnType<typeof validateAttributeForm>>({});
  const [busy, setBusy] = useState(false);
  const readOnly = !canManageMasterData || (view !== undefined && !view.editable);
  const set = (patch: Partial<AttributeFormValues>) => setValues((current) => ({ ...current, ...patch }));
  useUnsavedChangesGuard(hasUnsavedChanges(values, initial, [readOnly, busy]));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validateAttributeForm(values, mode);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await feedback(() => save(values), mode === 'create' ? 'Attribute created' : 'Attribute saved');
      navigate(`/admin?tab=attributes&level=${encodeURIComponent(values.entityType)}`);
    } catch {
      setBusy(false);
    }
  };
  const fieldProps = { values, errors, mode, readOnly, set };
  return (
    <Page>
      <AttributeHeader view={view} back={back} mayDelete={canManageMasterData} />
      {readOnly ? (
        <AdminCard title="Field">
          <AttributeReadOnly values={values} />
        </AdminCard>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <AttributeCards fieldProps={fieldProps} />
          <FormButtons busy={busy} submitLabel={mode === 'create' ? 'Create attribute' : 'Save changes'} onCancel={() => navigate(back.to)} />
        </form>
      )}
    </Page>
  );
}

/** Title (name, or "Add custom attribute"), where it applies, Delete, and why a shared attribute is read-only. */
function AttributeHeader({ view, back, mayDelete }: { view?: AttributeDefinitionView; back: { to: string; label: string }; mayDelete: boolean }) {
  if (!view) return <PageHeader title="Add custom attribute" back={back} />;
  return (
    <>
      <PageHeader
        title={view.displayName}
        back={back}
        description={`Applies to: ${labelOf(ATTRIBUTE_SCOPE_LABELS, view.scope)}`}
        actions={view.editable && mayDelete && <DeleteAttribute view={view} />}
      />
      {!view.editable && <p className="text-sm text-muted-foreground">This attribute is shared with other plants; only a super administrator can change it.</p>}
    </>
  );
}

function FormButtons({ busy, submitLabel, onCancel }: { busy: boolean; submitLabel: string; onCancel: () => void }) {
  return (
    <div className="flex gap-2">
      <Button type="button" variant="outline" className="h-9" onClick={onCancel} disabled={busy}>Cancel</Button>
      <Button type="submit" className="h-9" disabled={busy} aria-busy={busy || undefined}>
        {busy && <StatusIcon.loading aria-hidden="true" className="animate-spin" />}
        {submitLabel}
      </Button>
    </div>
  );
}

/** The editable form: the field card, and the rules card for types that have rules. */
function AttributeCards({ fieldProps }: { fieldProps: AttributeFieldsProps }) {
  return (
    <>
      <AdminCard title="Field">
        <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
          <AttributeMainFields {...fieldProps} />
        </div>
      </AdminCard>
      {RULED_TYPES.has(fieldProps.values.dataType) && (
        <AdminCard title="Rules" info="What a value must look like.">
          <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
            <AttributeRuleFields {...fieldProps} />
          </div>
        </AdminCard>
      )}
    </>
  );
}

function DeleteAttribute({ view }: { view: AttributeDefinitionView }) {
  const navigate = useNavigate();
  const remove = useDeleteAttribute();
  const feedback = useCommandFeedback();
  return (
    <ConfirmDialog
      trigger={<Button variant="destructive" className="h-9"><ActionIcon.delete aria-hidden="true" />Delete attribute</Button>}
      title={`Delete ${view.displayName}?`}
      description="Every value entered for this attribute is deleted too. This cannot be undone; switch it off (not in use) to keep the values."
      confirmLabel="Delete attribute"
      destructive
      onConfirm={async () => {
        await feedback(() => remove.submit(view.id), 'Attribute deleted');
        navigate(backForLevel(view.entityType).to);
      }}
    />
  );
}
