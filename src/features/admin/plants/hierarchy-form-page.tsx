import { useId, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCreateOrganization, useCreatePlant, useOrganizations } from '@/api/v2/queries/administration-config';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { Page, PageHeader, Section } from '@/features/ux-kit/page-layout';
import { StatusIcon } from '@/lib/icons';
import { FormField } from '../shared/form-field';
import { PageGate } from '../shared/page-gate';
import { useCommandFeedback } from '../shared/use-command-feedback';
import { HierarchyEditForm } from './hierarchy-edit-form';
import { HierarchyFields, type HierarchyFieldErrors, type HierarchyFieldValues } from './hierarchy-fields';
import { HIERARCHY_FIELD_VOCABULARY } from './hierarchy-field-vocabulary';

const BACK = { to: '/admin?tab=plants', label: 'Admin panel' };
const CODE = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

type Kind = 'organization' | 'plant';

interface Values extends HierarchyFieldValues {
  organizationId: string;
}

function validate(values: Values, plant: boolean): HierarchyFieldErrors {
  const errors: HierarchyFieldErrors = {};
  if (!CODE.test(values.code)) errors.code = 'Use letters, digits, “-”, “_” or “.”, starting with a letter or digit.';
  if (!values.name.trim()) errors.name = 'Enter a name.';
  if (plant && !values.organizationId) errors.organizationId = 'Choose the organization.';
  if (plant && !values.timezone) errors.timezone = 'Choose the plant’s time zone.';
  return errors;
}

/** `/admin/organizations/new` and `/admin/plants/new` (was the "Create" dialog of the Admin panel). */
export function HierarchyFormPage({ kind }: { kind: Kind }) {
  const { canUseAdminPanel, isSuperAdmin, roles } = useCapabilities();
  const allowed = canUseAdminPanel && (isSuperAdmin || (kind === 'plant' && roles.includes('OrgAdmin')));
  return (
    <PageGate title={kind === 'plant' ? 'Add plant' : 'Add organization'} allowed={allowed} deniedText="Only a super administrator (or the organization’s administrator, for plants) can do this.">
      <HierarchyForm kind={kind} />
    </PageGate>
  );
}

function HierarchyForm({ kind }: { kind: Kind }) {
  const plant = kind === 'plant';
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const orgId = useId();
  const [values, setValues] = useState<Values>({ code: '', name: '', description: '', organizationId: params.get('organizationId') ?? '', timezone: '' });
  const [errors, setErrors] = useState<HierarchyFieldErrors>({});
  const organizations = useOrganizations();
  const writable = useMemo(() => (organizations.data?.items ?? []).filter((org) => org.canAddPlants), [organizations.data]);
  const createOrg = useCreateOrganization();
  const createPlant = useCreatePlant();
  const feedback = useCommandFeedback(HIERARCHY_FIELD_VOCABULARY);
  const busy = createOrg.isPending || createPlant.isPending;
  const set = (patch: Partial<Values>) => setValues((current) => ({ ...current, ...patch }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validate(values, plant);
    setErrors(found);
    if (Object.keys(found).length) return;
    const base = { code: values.code, name: values.name.trim(), ...(values.description.trim() ? { description: values.description.trim() } : {}) };
    try {
      if (plant) await feedback(() => createPlant.submit({ ...base, organizationId: values.organizationId, timezone: values.timezone }), 'Plant created');
      else await feedback(() => createOrg.submit(base), 'Organization created');
      navigate(BACK.to);
    } catch {
      // the toast explains the refusal
    }
  };
  return (
    <Page>
      <PageHeader title={plant ? 'Add plant' : 'Add organization'} back={BACK} description={plant ? 'A plant is a site with its own users, units and data.' : undefined} />
      <Section title="Details">
        <form onSubmit={submit} className="grid max-w-2xl gap-4 sm:grid-cols-2" noValidate>
          {plant && (
            <FormField htmlFor={orgId} label="Organization" error={errors.organizationId} required>
              <Select value={values.organizationId} onValueChange={(organizationId) => set({ organizationId })}>
                <SelectTrigger id={orgId}><SelectValue placeholder="Choose the organization" /></SelectTrigger>
                <SelectContent>{writable.map((org) => <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
          )}
          <HierarchyFields values={values} errors={errors} set={set} plant={plant} />
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={busy} aria-busy={busy || undefined}>
              {busy && <StatusIcon.loading aria-hidden="true" className="animate-spin" />}
              {plant ? 'Create plant' : 'Create organization'}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(BACK.to)} disabled={busy}>Cancel</Button>
          </div>
        </form>
      </Section>
    </Page>
  );
}

/** Route element of `/admin/organizations/new`. */
export const OrganizationNewPage = () => <HierarchyFormPage kind="organization" />;
/** Route element of `/admin/plants/new`. */
export const PlantNewPage = () => <HierarchyFormPage kind="plant" />;

/** Route element of `/admin/organizations/:organizationId/edit`. */
export function OrganizationEditPage() {
  const { organizationId = '' } = useParams();
  return <HierarchyEditForm kind="organization" id={organizationId} />;
}

/** Route element of `/admin/plants/:plantId/edit`. */
export function PlantEditPage() {
  const { plantId = '' } = useParams();
  return <HierarchyEditForm kind="plant" id={plantId} />;
}
