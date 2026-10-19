import { Input } from '@/components/ui/input';
import { Field } from '../components/field';
import type { ProfileEditor } from './hooks/use-profile-draft';
import { QUALITY_PROTOCOLS, TIME_UNITS } from './model/mqtt-form';
import { DEFAULT_IDENTITY_LABEL, IDENTITY_STRATEGY_OPTIONS, profileKindLabel } from './model/profile-labels';
import type { ProfileDraft } from './model/profile-draft';
import type { ProfileFieldErrors } from './model/profile-field-errors';

interface SettingsProps {
  group: 'identity' | 'time' | 'reason';
  editor: Pick<ProfileEditor, 'draft' | 'change'>;
  errors: ProfileFieldErrors;
}

type TextKey = 'topicTemplate' | 'schemaVersion' | 'maxFutureSkewSeconds' | 'maxPastSeconds';
type SelectKey = 'identityStrategy' | 'timeUnit' | 'onStale' | 'qualityProtocol' | 'reasonUnmapped';
const optionsOf = (values: readonly string[]) => values.map((value) => ({ value, label: value }));

export function ProfileSettingsFields({ group, editor, errors }: SettingsProps) {
  const { draft, change } = editor;
  const input = (key: TextKey, id: string, label: string, numeric = false) => (
    <Field key={key} id={id} label={label} error={errors[key]}>
      <Input id={id} value={draft[key]} inputMode={numeric ? 'numeric' : undefined} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${id}-error` : undefined} onChange={(event) => change({ [key]: event.target.value })} />
    </Field>
  );
  const select = (key: SelectKey, id: string, label: string, settings: Pick<SelectProps, 'placeholder' | 'options'>) => (
    <ProfileSelect key={key} id={id} label={label} value={draft[key]} error={errors[key]} {...settings} onChange={(value) => change({ [key]: value } as Partial<ProfileDraft>)} />
  );
  if (group === 'reason') return select('reasonUnmapped', 'pp-reason-unmapped', 'Unmapped reason token', { placeholder: 'reject (default)', options: [{ value: 'reject', label: 'Reject (quarantine)' }, { value: 'keep', label: 'Keep the raw token' }] });
  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      {group === 'identity' ? <>
        {input('topicTemplate', 'pp-template', `Topic template (${profileKindLabel(draft.kind)})`)}
        {input('schemaVersion', 'pp-schema', 'Schema version')}
        {select('identityStrategy', 'pp-identity', 'Identity strategy', { placeholder: DEFAULT_IDENTITY_LABEL, options: IDENTITY_STRATEGY_OPTIONS })}
      </> : <>
        {select('timeUnit', 'pp-time-unit', 'Timestamp unit', { placeholder: 'auto (default)', options: optionsOf(TIME_UNITS) })}
        {input('maxFutureSkewSeconds', 'pp-future', 'Max future skew (s)', true)}
        {input('maxPastSeconds', 'pp-past', 'Max age (s)', true)}
        {select('onStale', 'pp-stale', 'On stale timestamp', { placeholder: 'Profile default', options: [{ value: 'reject', label: 'Reject (quarantine)' }, { value: 'flag', label: 'Flag quality.degraded' }] })}
        {select('qualityProtocol', 'pp-quality', 'Quality protocol', { placeholder: 'None declared', options: optionsOf(QUALITY_PROTOCOLS) })}
      </>}
    </div>
  );
}

interface SelectProps {
  id: string; label: string; value: string; error?: string; placeholder: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}

function ProfileSelect({ id, label, value, error, placeholder, options, onChange }: SelectProps) {
  return (
    <Field id={id} label={label} error={error} hint={id === 'pp-reason-unmapped' ? 'Reject quarantines unmapped values. Keep creates an uncoded event with the raw token.' : undefined}>
      <select id={id} data-testid={id} value={value} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => onChange(event.target.value)} className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm">
        <option value="">{placeholder}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </Field>
  );
}
