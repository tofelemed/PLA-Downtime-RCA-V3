import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Field } from '../components/field';
import type { PiConnectionForm, PiFormErrors } from '../model/connection-form';

export interface PiConnectionFieldsProps {
  form: PiConnectionForm;
  errors: PiFormErrors;
  /** a credential is stored already (edit): an empty secret keeps it */
  hasSecret: boolean;
  onChange: (patch: Partial<PiConnectionForm>) => void;
}

/**
 * PI Web API settings. The password is write-only (PI02, §4.2): never pre-filled, never echoed, not
 * remembered by the browser; it is sent once and stored encrypted by reference on the server.
 */
export function PiConnectionFields({ form, errors, hasSecret, onChange }: PiConnectionFieldsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field id="pi-name" label="Name" error={errors.displayName}>
        <Input id="pi-name" value={form.displayName} onChange={(event) => onChange({ displayName: event.target.value })} />
      </Field>
      <Field id="pi-url" label="PI Web API URL" error={errors.piWebApiUrl} hint="e.g. https://pi-server/piwebapi">
        <Input id="pi-url" inputMode="url" value={form.piWebApiUrl} onChange={(event) => onChange({ piWebApiUrl: event.target.value })} />
      </Field>
      <Field id="pi-user" label="User name">
        <Input id="pi-user" autoComplete="off" value={form.username} onChange={(event) => onChange({ username: event.target.value })} />
      </Field>
      <Field
        id="pi-secret"
        label={hasSecret ? 'Replace password' : 'Password'}
        hint={hasSecret ? 'A password is stored (write-only). Leave empty to keep it.' : 'Stored encrypted on the server; never shown again.'}
      >
        <Input
          id="pi-secret"
          type="password"
          autoComplete="new-password"
          data-testid="pi-secret"
          value={form.secret}
          onChange={(event) => onChange({ secret: event.target.value })}
        />
      </Field>
      <Field id="pi-af" label="AF database path (optional)">
        <Input id="pi-af" value={form.afDatabasePath} onChange={(event) => onChange({ afDatabasePath: event.target.value })} />
      </Field>
      <div className="flex items-center gap-2 pt-6">
        <Checkbox id="pi-insecure" checked={form.allowInsecureTls} onCheckedChange={(checked) => onChange({ allowInsecureTls: checked === true })} />
        <Label htmlFor="pi-insecure" className="text-sm">
          Skip TLS certificate verification (audited; test systems only)
        </Label>
      </div>
    </div>
  );
}
