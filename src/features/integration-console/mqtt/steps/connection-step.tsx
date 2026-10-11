import { Input } from '@/components/ui/input';
import { Field } from '../../components/field';
import { NativeSelect } from '../../components/native-select';
import { isSecureBrokerUrl } from '../model/mqtt-validation';
import type { StepProps } from './step-props';
import { TlsFields } from './tls-fields';

export interface ConnectionStepProps extends StepProps {
  /** a password is stored already (edit): an empty field keeps it */
  hasSecret: boolean;
}

/**
 * Step 3 — protocol version, credentials (the password is write-only: never pre-filled, never echoed),
 * client id and the TLS trust block (only for mqtts://). Changing the broker, user or TLS settings of
 * a stored connection requires the password again (422 SECRET_REQUIRED).
 */
export function ConnectionStep({ form, errors, hasSecret, onChange }: ConnectionStepProps) {
  const secure = isSecureBrokerUrl(form.brokerUrl);
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="mqtt-protocol" label="Protocol version" error={errors.protocolVersion}>
          <NativeSelect
            id="mqtt-protocol"
            testId="mqtt-protocol"
            value={form.protocolVersion}
            options={[
              { value: '5', label: 'MQTT 5 (session expiry, reason codes)' },
              { value: '4', label: 'MQTT 3.1.1' },
            ]}
            onChange={(version) => onChange({ protocolVersion: version === '4' ? '4' : '5' })}
          />
        </Field>
        <Field id="mqtt-client-id" label="Client id (blank = derived)" error={errors.clientId} hint="Stable and unique per connection: proact-<connection id> when blank. A debugging tool reusing it evicts the subscriber.">
          <Input id="mqtt-client-id" autoComplete="off" value={form.clientId} onChange={(event) => onChange({ clientId: event.target.value })} />
        </Field>
        <Field id="mqtt-user" label="User name" error={errors.username}>
          <Input id="mqtt-user" autoComplete="off" value={form.username} onChange={(event) => onChange({ username: event.target.value })} />
        </Field>
        <Field
          id="mqtt-secret"
          label={hasSecret ? 'Replace password' : 'Password'}
          error={errors.secret}
          hint={hasSecret ? 'A password is stored (write-only). Leave blank to keep it.' : 'Stored encrypted on the server; never shown again.'}
        >
          <Input id="mqtt-secret" type="password" autoComplete="new-password" data-testid="mqtt-secret" value={form.secret} onChange={(event) => onChange({ secret: event.target.value })} />
        </Field>
      </div>
      {secure ? (
        <TlsFields form={form} errors={errors} onChange={onChange} />
      ) : (
        <p className="text-xs text-muted-foreground" data-testid="mqtt-tls-off">
          Plain mqtt:// broker: no TLS trust settings. Use mqtts:// for a plant broker.
        </p>
      )}
    </div>
  );
}
