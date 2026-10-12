import { useEffect, useId, useState } from 'react';
import { useDashboardConfig, useResetDashboardConfig, useSaveDashboardConfig } from '@/api/v2/queries/administration-config';
import type { DashboardSettings } from '@/api/v2/types/administration';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Section } from '@/features/ux-kit/page-layout';
import { FilterSelect } from '../shared/filter-select';
import { FormField } from '../shared/form-field';
import { usePlantDates } from '../shared/use-plant-dates';
import { useCommandFeedback } from '../shared/use-command-feedback';
import { DASHBOARD_GROUP_KEYS, DASHBOARD_GROUPS, type DashboardGroup, type FieldSpec } from './dashboard-fields';

type SectionValues = Record<string, number | string | boolean | string[]>;
const GROUP_OPTIONS = DASHBOARD_GROUP_KEYS.map((key) => ({ value: key, label: DASHBOARD_GROUPS[key].label }));

function SettingField({ spec, value, disabled, onChange }: { spec: FieldSpec; value: SectionValues[string] | undefined; disabled: boolean; onChange: (value: SectionValues[string]) => void }) {
  const id = useId();
  if (spec.kind === 'boolean') {
    return (
      <div className="flex items-center gap-2">
        <Switch id={id} checked={value === true} disabled={disabled} onCheckedChange={onChange} />
        <Label htmlFor={id}>{spec.label}</Label>
      </div>
    );
  }
  if (spec.kind === 'choice') {
    return (
      <FormField htmlFor={id} label={spec.label}>
        <Select value={String(value ?? '')} disabled={disabled} onValueChange={onChange}>
          <SelectTrigger id={id}><SelectValue /></SelectTrigger>
          <SelectContent>{spec.options.map(([option, label]) => <SelectItem key={option} value={option}>{label}</SelectItem>)}</SelectContent>
        </Select>
      </FormField>
    );
  }
  if (spec.kind === 'list') {
    const lines = Array.isArray(value) ? value.join('\n') : '';
    return (
      <FormField htmlFor={id} label={spec.label} hint={spec.hint}>
        <Textarea id={id} rows={4} value={lines} disabled={disabled} onChange={(e) => onChange(e.target.value.split('\n').map((line) => line.trim()).filter(Boolean))} />
      </FormField>
    );
  }
  const numeric = spec.kind === 'number';
  return (
    <FormField htmlFor={id} label={numeric && spec.unit ? `${spec.label} (${spec.unit})` : spec.label}>
      <Input id={id} type={numeric ? 'number' : 'text'} step={numeric ? spec.step ?? 1 : undefined} value={String(value ?? '')} disabled={disabled}
        onChange={(e) => onChange(numeric ? Number(e.target.value) : e.target.value)} />
    </FormField>
  );
}

/** Targets, thresholds and display options of the plan dashboard; one group at a time (no tab overflow). */
export function DashboardConfigSection() {
  const config = useDashboardConfig();
  const { canAdministerTenant } = useCapabilities();
  const dates = usePlantDates();
  const save = useSaveDashboardConfig();
  const reset = useResetDashboardConfig();
  const feedback = useCommandFeedback();
  const [group, setGroup] = useState<DashboardGroup>('oee');
  const [draft, setDraft] = useState<DashboardSettings | null>(null);
  useEffect(() => setDraft(config.data?.settings ?? null), [config.data]);
  if (!config.data || !draft) return <DataState state={dataStateOf(config)} error={config.error} onRetry={() => void config.refetch()} />;
  const spec = DASHBOARD_GROUPS[group];
  const values = draft[group] as SectionValues;
  const setValue = (key: string, value: SectionValues[string]) => setDraft({ ...draft, [group]: { ...values, [key]: value } });
  const status = config.data.isStored
    ? `Saved ${dates.dateTime(config.data.updatedAt)}${config.data.updatedByName ? ` by ${config.data.updatedByName}` : ''}.`
    : 'Using the default settings.';
  return (
    <Section title="Dashboard settings" description={`Targets, thresholds and display options of the production plan dashboard. ${status}`}
      actions={canAdministerTenant && (
        <>
          <ConfirmDialog trigger={<Button variant="outline" disabled={!config.data.isStored}>Reset to defaults</Button>} title="Reset the dashboard settings?"
            description="Every group goes back to the default values." confirmLabel="Reset to defaults" destructive onConfirm={() => feedback(() => reset.submit(undefined), 'Defaults restored')} />
          <Button onClick={() => void feedback(() => save.submit(draft), 'Dashboard settings saved').catch(() => undefined)} disabled={save.isPending}>Save changes</Button>
        </>
      )}>
      <FilterSelect label="Settings group" value={group} options={GROUP_OPTIONS} onChange={(next) => setGroup(next as DashboardGroup)} />
      <p className="text-sm text-muted-foreground">{spec.description}</p>
      <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
        {spec.fields.map((field) => (
          <SettingField key={`${group}.${field.key}`} spec={field} value={values[field.key]} disabled={!canAdministerTenant} onChange={(value) => setValue(field.key, value)} />
        ))}
      </div>
    </Section>
  );
}
