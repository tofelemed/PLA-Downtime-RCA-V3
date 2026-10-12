import { useId, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCreateOrganization, useCreatePlant, useOrganizations } from '@/api/v2/queries/administration-config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { Page, PageHeader, Section } from '@/features/ux-kit/page-layout';
import { StatusIcon } from '@/lib/icons';
import { FormField } from '../shared/form-field';
import { PageGate } from '../shared/page-gate';
import { useCommandFeedback } from '../shared/use-command-feedback';

const BACK = { to: '/admin?tab=plants', label: 'Admin panel' };
const CODE = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

interface Values {
  code: string;
  name: string;
  description: string;
  organizationId: string;
  timezone: string;
}

function validate(values: Values, plant: boolean): Partial<Record<keyof Values, string>> {
  const errors: Partial<Record<keyof Values, string>> = {};
  if (!CODE.test(values.code)) errors.code = 'Use letters, digits, “-”, “_” or “.”, starting with a letter or digit.';
  if (!values.name.trim()) errors.name = 'Enter a name.';
  if (plant && !values.organizationId) errors.organizationId = 'Choose the organization.';
  if (plant && !values.timezone) errors.timezone = 'Choose the plant’s time zone.';
  return errors;
}

/** IANA zones the browser knows (`Intl.supportedValuesOf`, ES2022; the lib target here is older). */
const supportedValuesOf = (Intl as unknown as { supportedValuesOf?: (key: 'timeZone') => string[] }).supportedValuesOf;
const ZONES: readonly string[] = supportedValuesOf ? supportedValuesOf('timeZone') : ['UTC'];

/** `/admin/organizations/new` and `/admin/plants/new` (was the "Create" dialog of the Admin panel). */
export function HierarchyFormPage({ kind }: { kind: 'organization' | 'plant' }) {
  const { canUseAdminPanel, isSuperAdmin, roles } = useCapabilities();
  const allowed = canUseAdminPanel && (isSuperAdmin || (kind === 'plant' && roles.includes('OrgAdmin')));
  return (
    <PageGate title={kind === 'plant' ? 'Add plant' : 'Add organization'} allowed={allowed} deniedText="Only a super administrator (or the organization’s administrator, for plants) can do this.">
      <HierarchyForm kind={kind} />
    </PageGate>
  );
}

function HierarchyForm({ kind }: { kind: 'organization' | 'plant' }) {
  const plant = kind === 'plant';
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const ids = { code: useId(), name: useId(), description: useId(), org: useId(), zone: useId() };
  const [values, setValues] = useState<Values>({ code: '', name: '', description: '', organizationId: params.get('organizationId') ?? '', timezone: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const organizations = useOrganizations();
  const writable = useMemo(() => (organizations.data?.items ?? []).filter((org) => org.canAddPlants), [organizations.data]);
  const createOrg = useCreateOrganization();
  const createPlant = useCreatePlant();
  const feedback = useCommandFeedback();
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
            <FormField htmlFor={ids.org} label="Organization" error={errors.organizationId} required>
              <Select value={values.organizationId} onValueChange={(organizationId) => set({ organizationId })}>
                <SelectTrigger id={ids.org}><SelectValue placeholder="Choose the organization" /></SelectTrigger>
                <SelectContent>{writable.map((org) => <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
          )}
          <FormField htmlFor={ids.code} label="Code" hint="Short and unique, e.g. HDPE-1." error={errors.code} required>
            <Input id={ids.code} value={values.code} onChange={(e) => set({ code: e.target.value })} />
          </FormField>
          <FormField htmlFor={ids.name} label="Name" error={errors.name} required>
            <Input id={ids.name} value={values.name} onChange={(e) => set({ name: e.target.value })} />
          </FormField>
          {plant && (
            <FormField htmlFor={ids.zone} label="Time zone" hint="Times of this plant are shown in this zone." error={errors.timezone} required>
              <Input id={ids.zone} list={`${ids.zone}-zones`} value={values.timezone} placeholder="e.g. Asia/Tehran" onChange={(e) => set({ timezone: e.target.value })} />
              <datalist id={`${ids.zone}-zones`}>{ZONES.map((zone) => <option key={zone} value={zone} />)}</datalist>
            </FormField>
          )}
          <div className="sm:col-span-2">
            <FormField htmlFor={ids.description} label="Description">
              <Textarea id={ids.description} rows={3} value={values.description} onChange={(e) => set({ description: e.target.value })} />
            </FormField>
          </div>
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
