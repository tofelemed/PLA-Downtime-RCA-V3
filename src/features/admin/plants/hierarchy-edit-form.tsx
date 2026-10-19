import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useOrganization, usePlant, useUpdateOrganization, useUpdatePlant } from '@/api/v2/queries/administration-config';
import type { OrganizationView, PlantDetailView } from '@/api/v2/types/administration';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Page, PageHeader, Section } from '@/features/ux-kit/page-layout';
import { StatusIcon } from '@/lib/icons';
import { PageGate } from '../shared/page-gate';
import { HierarchyFields } from './hierarchy-fields';
import { useHierarchyEditSync, type SavedHierarchyRecord } from './use-hierarchy-edit-sync';
import { useHierarchyEditor, type EditableRecord, type HierarchyEditorOptions } from './use-hierarchy-editor';

type Kind = 'organization' | 'plant';

/** Back link: the plant hierarchy when the edit started there (`?from=hierarchy`), else the Admin panel. */
function useBackTarget() {
  const [params] = useSearchParams();
  return params.get('from') === 'hierarchy'
    ? { to: '/master-data/hierarchy', label: 'Plant hierarchy' }
    : { to: '/admin?tab=plants', label: 'Admin panel' };
}

/** `/admin/organizations/:id/edit` and `/admin/plants/:id/edit`: name, description and (plants) time zone. */
export function HierarchyEditForm({ kind, id }: { kind: Kind; id: string }) {
  const { canUseAdminPanel, isSuperAdmin, roles } = useCapabilities();
  const allowed = canUseAdminPanel && (isSuperAdmin || roles.includes('OrgAdmin'));
  return (
    <PageGate title={kind === 'plant' ? 'Edit plant' : 'Edit organization'} allowed={allowed} deniedText="Only a super administrator or the organization’s administrator can edit this.">
      {kind === 'plant' ? <PlantEditor id={id} /> : <OrganizationEditor id={id} />}
    </PageGate>
  );
}

interface LoadedProps<T extends EditableRecord> {
  kind: Kind;
  query: { data: T | undefined; isLoading: boolean; isError: boolean; error: unknown; refetch: () => Promise<{ data?: T }> };
  save: (rowVersion: number, body: Parameters<HierarchyEditorOptions['save']>[1]) => Promise<T>;
  toSaved: (view: T) => SavedHierarchyRecord;
}

function Loaded<T extends EditableRecord>({ kind, query, save, toSaved }: LoadedProps<T>) {
  const back = useBackTarget();
  if (!query.data) {
    return (
      <Page>
        <PageHeader title={kind === 'plant' ? 'Edit plant' : 'Edit organization'} back={back} />
        <DataState state={dataStateOf(query)} error={query.error} onRetry={() => void query.refetch()} />
      </Page>
    );
  }
  const reload = async () => (await query.refetch()).data;
  return <HierarchyEditor kind={kind} record={query.data} reload={reload} save={save} toSaved={(view) => toSaved(view as T)} />;
}

function OrganizationEditor({ id }: { id: string }) {
  const query = useOrganization(id);
  const update = useUpdateOrganization();
  return (
    <Loaded<OrganizationView>
      kind="organization"
      query={query}
      save={(rowVersion, { name, description }) => update.submit({ id, rowVersion, body: { name, description } })}
      toSaved={(view) => ({ kind: 'organization', view })}
    />
  );
}

function PlantEditor({ id }: { id: string }) {
  const query = usePlant(id);
  const update = useUpdatePlant();
  return (
    <Loaded<PlantDetailView>
      kind="plant"
      query={query}
      save={(rowVersion, body) => update.submit({ id, rowVersion, body })}
      toSaved={(view) => ({ kind: 'plant', view })}
    />
  );
}

function lockReasonOf(plant: boolean, base: EditableRecord): string | null {
  if (!plant || base.timezoneEditable) return null;
  return base.timezoneLockedReason ?? 'Only the organization’s administrator can change the time zone.';
}

/** After a 412: the latest version is loaded, the user's text kept. */
function ConflictAlert({ kind, latest }: { kind: Kind; latest: EditableRecord }) {
  return (
    <Alert data-testid="hierarchy-conflict">
      <AlertTitle>Someone else saved this {kind} while you were editing</AlertTitle>
      <AlertDescription>
        The latest version is loaded (name “{latest.name}”{latest.description ? `, description “${latest.description}”` : ''}). Your changes are kept below; review them and
        save again.
      </AlertDescription>
    </Alert>
  );
}

function FormButtons({ busy, onCancel }: { busy: boolean; onCancel: () => void }) {
  return (
    <div className="flex gap-2 sm:col-span-2">
      <Button type="submit" disabled={busy} aria-busy={busy || undefined}>
        {busy && <StatusIcon.loading aria-hidden="true" className="animate-spin" />}
        Save changes
      </Button>
      <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
    </div>
  );
}

interface EditorProps {
  kind: Kind;
  record: EditableRecord;
  reload: () => Promise<EditableRecord | undefined>;
  save: HierarchyEditorOptions['save'];
  toSaved: (view: EditableRecord) => SavedHierarchyRecord;
}

function HierarchyEditor({ kind, record, reload, save, toSaved }: EditorProps) {
  const plant = kind === 'plant';
  const back = useBackTarget();
  const navigate = useNavigate();
  const sync = useHierarchyEditSync();
  const editor = useHierarchyEditor({
    record,
    reload,
    save,
    successText: plant ? 'Plant saved' : 'Organization saved',
    onSaved: async (saved) => {
      if (saved) await sync(toSaved(saved));
      navigate(back.to);
    },
  });
  const { base } = editor;
  return (
    <Page>
      <PageHeader title={`Edit ${base.name}`} back={back} description={plant ? 'Plant' : 'Organization'} />
      {editor.conflict && <ConflictAlert kind={kind} latest={base} />}
      {editor.readOnly && <p className="text-sm text-muted-foreground">Only a super administrator or the organization’s administrator can change this {kind}.</p>}
      <Section title="Details">
        <form onSubmit={editor.submit} className="grid max-w-2xl gap-4 sm:grid-cols-2" noValidate>
          <HierarchyFields
            values={editor.values}
            errors={editor.errors}
            set={editor.set}
            plant={plant}
            codeReadOnly
            timezoneLockedReason={lockReasonOf(plant, base)}
            disabled={editor.readOnly || editor.busy}
          />
          {!editor.readOnly && <FormButtons busy={editor.busy} onCancel={() => navigate(back.to)} />}
        </form>
      </Section>
      {plant && (
        <p className="text-sm text-muted-foreground">
          Units and assets of a plant are edited in <Link className="underline" to="/master-data/units">Master data → Units</Link> and{' '}
          <Link className="underline" to="/master-data/assets">Assets</Link>; they act on the selected plant.
        </p>
      )}
    </Page>
  );
}
