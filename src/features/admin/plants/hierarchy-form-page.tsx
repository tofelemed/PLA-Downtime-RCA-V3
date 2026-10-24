import { useId, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useOrganizations } from '@/api/v2/queries/administration-config';
import type { CreateOrganizationInput, CreatePlantInput } from '@/api/v2/types/administration';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { pageNameOf } from '@/features/auth/navigation-items';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { Page, PageHeader, Section } from '@/features/ux-kit/page-layout';
import { WEEK_START_CHOICES } from '@/features/settings/week-start-choices';
import { StatusIcon } from '@/lib/icons';
import { FormField } from '../shared/form-field';
import { PageGate } from '../shared/page-gate';
import { HierarchyEditForm } from './hierarchy-edit-form';
import { HierarchyFields, type HierarchyFieldErrors, type HierarchyFieldValues } from './hierarchy-fields';
import { PLANTS_PAGE } from './plants-page-path';
import { SwitchPlantDialog } from './switch-plant-dialog';
import { hierarchyFieldErrorsOf, useHierarchyCreate } from './use-hierarchy-create';

const BACK = { to: PLANTS_PAGE, label: pageNameOf(PLANTS_PAGE) };
const CODE = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
/** the server picks the week start: Saturday for Iranian plants (Asia/Tehran), Monday otherwise */
const AUTO_WEEK = 'auto';

type Kind = 'organization' | 'plant';

interface Values extends HierarchyFieldValues {
  organizationId: string;
  weekStart: string;
}

function validate(values: Values, plant: boolean): HierarchyFieldErrors {
  const errors: HierarchyFieldErrors = {};
  if (!CODE.test(values.code)) errors.code = 'Use letters, digits, “-”, “_” or “.”, starting with a letter or digit.';
  if (!values.name.trim()) errors.name = 'Enter a name.';
  if (plant && !values.organizationId) errors.organizationId = 'Choose the organization.';
  if (plant && !values.timezone) errors.timezone = 'Choose the plant’s time zone.';
  return errors;
}

/** An empty form; "Add plant" on an organization row preselects it (`?organizationId=`). */
function initialValues(organizationId: string | null): Values {
  return { code: '', name: '', description: '', organizationId: organizationId ?? '', timezone: '', weekStart: AUTO_WEEK };
}

function organizationBodyOf(values: Values): CreateOrganizationInput {
  const description = values.description.trim();
  return { code: values.code, name: values.name.trim(), ...(description ? { description } : {}) };
}

/** The week start is left out on "Automatic": the server picks it from the time zone. */
function plantBodyOf(values: Values): CreatePlantInput {
  const weekStart = values.weekStart === AUTO_WEEK ? {} : { weekStart: values.weekStart };
  return { ...organizationBodyOf(values), organizationId: values.organizationId, timezone: values.timezone, ...weekStart };
}

/** `/setup/plants/organizations/new` and `/setup/plants/new` (was the "Create" dialog of the Admin panel). */
export function HierarchyFormPage({ kind }: { kind: Kind }) {
  const { canManagePlants, isSuperAdmin } = useCapabilities();
  const allowed = kind === 'plant' ? canManagePlants : isSuperAdmin;
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
  const weekId = useId();
  const [values, setValues] = useState<Values>(() => initialValues(params.get('organizationId')));
  const [errors, setErrors] = useState<HierarchyFieldErrors>({});
  const organizations = useOrganizations();
  const writable = useMemo(() => (organizations.data?.items ?? []).filter((org) => org.canAddPlants), [organizations.data]);
  const addAnother = () => {
    setValues((current) => ({ ...initialValues(current.organizationId || null), weekStart: current.weekStart }));
    setErrors({});
  };
  const create = useHierarchyCreate(organizations.data?.items ?? [], addAnother);
  const busy = create.busy;
  const set = (patch: Partial<Values>) => setValues((current) => ({ ...current, ...patch }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validate(values, plant);
    setErrors(found);
    if (Object.keys(found).length) return;
    try {
      if (plant) await create.plant(plantBodyOf(values));
      else await create.organization(organizationBodyOf(values));
    } catch (error) {
      // the alert above the form explains the refusal; the refused fields are marked here
      setErrors(hierarchyFieldErrorsOf(error));
    }
  };
  return (
    <Page>
      <PageHeader title={plant ? 'Add plant' : 'Add organization'} back={BACK} />
      <Section title="Details">
        <div className="max-w-2xl space-y-4">
          {create.alert}
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
            {plant && (
              <FormField htmlFor={orgId} label="Organization" error={errors.organizationId} required>
                <Select value={values.organizationId} onValueChange={(organizationId) => set({ organizationId })}>
                  <SelectTrigger id={orgId}><SelectValue placeholder="Choose the organization" /></SelectTrigger>
                  <SelectContent>{writable.map((org) => <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>)}</SelectContent>
                </Select>
              </FormField>
            )}
            <HierarchyFields values={values} errors={errors} set={set} plant={plant} />
            {plant && (
              <FormField htmlFor={weekId} label="First day of the week" hint="Weekly trends and reports group the days from it; it can be changed later in Plant settings.">
                <Select value={values.weekStart} onValueChange={(weekStart) => set({ weekStart })}>
                  <SelectTrigger id={weekId}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={AUTO_WEEK}>Automatic (Saturday for Asia/Tehran, otherwise Monday)</SelectItem>
                    {WEEK_START_CHOICES.map((choice) => <SelectItem key={choice.value} value={choice.value}>{choice.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
            )}
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={busy} aria-busy={busy || undefined}>
                {busy && <StatusIcon.loading aria-hidden="true" className="animate-spin" />}
                {plant ? 'Create plant' : 'Create organization'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(BACK.to)} disabled={busy}>Cancel</Button>
            </div>
          </form>
        </div>
      </Section>
      <SwitchPlantDialog created={create.created} onClose={create.finish} onAddAnother={addAnother} />
      {create.dialog}
    </Page>
  );
}

/** Route element of `/setup/plants/organizations/new`. */
export const OrganizationNewPage = () => <HierarchyFormPage kind="organization" />;
/** Route element of `/setup/plants/new`. */
export const PlantNewPage = () => <HierarchyFormPage kind="plant" />;

/** Route element of `/setup/plants/organizations/:organizationId/edit`. */
export function OrganizationEditPage() {
  const { organizationId = '' } = useParams();
  return <HierarchyEditForm kind="organization" id={organizationId} />;
}

/** Route element of `/setup/plants/:plantId/edit`. */
export function PlantEditPage() {
  const { plantId = '' } = useParams();
  return <HierarchyEditForm kind="plant" id={plantId} />;
}
