import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ReadOnlyField } from '@/features/master-data/components/read-only-field';
import { FormField } from '../shared/form-field';

/** Shown under a read-only code on the edit pages (DECISIONS 2026-10-19). */
export const CODE_IMMUTABLE_HINT = 'Codes can’t change after creation (referenced by history and integrations).';

/** IANA zones the browser knows (`Intl.supportedValuesOf`, ES2022; the lib target here is older). */
const supportedValuesOf = (Intl as unknown as { supportedValuesOf?: (key: 'timeZone') => string[] }).supportedValuesOf;
const ZONES: readonly string[] = supportedValuesOf ? supportedValuesOf('timeZone') : ['UTC'];

export interface HierarchyFieldValues {
  code: string;
  name: string;
  description: string;
  timezone: string;
}

export type HierarchyFieldErrors = Partial<Record<keyof HierarchyFieldValues | 'organizationId', string>>;

export interface HierarchyFieldsProps {
  values: HierarchyFieldValues;
  errors: HierarchyFieldErrors;
  set: (patch: Partial<HierarchyFieldValues>) => void;
  /** plants have a time zone */
  plant: boolean;
  /** edit pages: the code is shown, never changed */
  codeReadOnly?: boolean;
  /** why the time zone cannot change (field disabled); null / undefined = editable */
  timezoneLockedReason?: string | null;
  disabled?: boolean;
  /** read-only users see the values as text under their labels */
  asText?: boolean;
}

/** The values as text, for users who cannot change this record. */
function HierarchyValues({ values, plant }: Pick<HierarchyFieldsProps, 'values' | 'plant'>) {
  return (
    <>
      <ReadOnlyField label="Code" value={values.code} />
      <ReadOnlyField label="Name" value={values.name} />
      {plant && <ReadOnlyField label="Time zone" value={values.timezone} />}
      <div className="sm:col-span-2">
        <ReadOnlyField label="Description" value={values.description} multiline />
      </div>
    </>
  );
}

/** Code, name, time zone (plants) and description of an organization or plant: create and edit pages. */
export function HierarchyFields(props: HierarchyFieldsProps) {
  return props.asText ? <HierarchyValues values={props.values} plant={props.plant} /> : <EditableHierarchyFields {...props} />;
}

function EditableHierarchyFields({ values, errors, set, plant, codeReadOnly, timezoneLockedReason, disabled }: HierarchyFieldsProps) {
  const ids = { code: useId(), name: useId(), description: useId(), zone: useId() };
  const zoneLocked = Boolean(timezoneLockedReason);
  return (
    <>
      <FormField htmlFor={ids.code} label="Code" hint={codeReadOnly ? CODE_IMMUTABLE_HINT : 'Short and unique, e.g. HDPE-1.'} error={errors.code} required={!codeReadOnly}>
        <Input id={ids.code} value={values.code} readOnly={codeReadOnly} disabled={disabled} className={codeReadOnly ? 'bg-muted' : undefined} onChange={(e) => set({ code: e.target.value })} />
      </FormField>
      <FormField htmlFor={ids.name} label="Name" error={errors.name} required>
        <Input id={ids.name} value={values.name} maxLength={255} disabled={disabled} onChange={(e) => set({ name: e.target.value })} />
      </FormField>
      {plant && (
        <FormField
          htmlFor={ids.zone}
          label="Time zone"
          hint={timezoneLockedReason || 'Times of this plant are shown in this zone.'}
          error={errors.timezone}
          required={!zoneLocked}
        >
          <Input
            id={ids.zone}
            list={`${ids.zone}-zones`}
            value={values.timezone}
            placeholder="e.g. Asia/Tehran"
            disabled={disabled || zoneLocked}
            onChange={(e) => set({ timezone: e.target.value })}
          />
          <datalist id={`${ids.zone}-zones`}>{ZONES.map((zone) => <option key={zone} value={zone} />)}</datalist>
        </FormField>
      )}
      <div className="sm:col-span-2">
        <FormField htmlFor={ids.description} label="Description" error={errors.description}>
          <Textarea id={ids.description} rows={3} maxLength={2000} value={values.description} disabled={disabled} onChange={(e) => set({ description: e.target.value })} />
        </FormField>
      </div>
    </>
  );
}
