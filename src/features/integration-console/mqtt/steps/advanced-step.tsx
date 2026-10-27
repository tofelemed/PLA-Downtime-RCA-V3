import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Field } from '../../components/field';
import { NativeSelect } from '../../components/native-select';
import { QUALITY_PROTOCOLS, TIME_UNITS, type MqttConnectionForm } from '../model/mqtt-form';
import type { StepProps } from './step-props';

type NumberField = 'sessionExpirySeconds' | 'keepaliveSeconds' | 'connectTimeoutSeconds' | 'reconnectMinSeconds' | 'reconnectMaxSeconds' | 'maxMessageBytes' | 'maxFutureSkewSeconds' | 'maxPastSeconds';

const SESSION: ReadonlyArray<[NumberField, string, string]> = [
  ['sessionExpirySeconds', 'Session expiry (s)', 'How long the broker queues while disconnected (MQTT 5); sizes the outage window.'],
  ['keepaliveSeconds', 'Keep-alive (s)', ''],
  ['connectTimeoutSeconds', 'Connect timeout (s)', ''],
  ['reconnectMinSeconds', 'Reconnect backoff min (s)', ''],
  ['reconnectMaxSeconds', 'Reconnect backoff max (s)', 'Exponential between min and max.'],
  ['maxMessageBytes', 'Max message size (bytes)', 'Larger payloads are quarantined as too_large.'],
];
const TIME: ReadonlyArray<[NumberField, string, string]> = [
  ['maxFutureSkewSeconds', 'Max future skew (s)', 'Timestamps further ahead are rejected (future_timestamp).'],
  ['maxPastSeconds', 'Max age (s)', 'Older timestamps are rejected or flagged (stale_timestamp) per "on stale".'],
];

/** Step 4 — session and QoS settings of the transport, and the time / quality rules of the profile. */
export function AdvancedStep({ form, errors, onChange }: StepProps) {
  const number = ([field, label, hint]: [NumberField, string, string]) => (
    <Field key={field} id={`mqtt-${field}`} label={label} error={errors[field]} hint={hint || undefined}>
      <Input id={`mqtt-${field}`} inputMode="numeric" value={form[field]} onChange={(event) => onChange({ [field]: event.target.value } as Partial<MqttConnectionForm>)} />
    </Field>
  );
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="mqtt-qos" label="QoS" error={errors.qos} hint="1 recommended: QoS 0 is never queued by the broker.">
          <NativeSelect
            id="mqtt-qos"
            testId="mqtt-qos"
            value={form.qos}
            options={[
              { value: '0', label: '0 — at most once' },
              { value: '1', label: '1 — at least once (persist before ack)' },
              { value: '2', label: '2 — exactly once' },
            ]}
            onChange={(qos) => onChange({ qos: qos as MqttConnectionForm['qos'] })}
          />
        </Field>
        <div className="flex items-center gap-2 pt-6">
          <Checkbox id="mqtt-clean-start" checked={form.cleanStart} onCheckedChange={(checked) => onChange({ cleanStart: checked === true })} />
          <Label htmlFor="mqtt-clean-start" className="text-sm">
            Clean start (drop the broker session on connect; loses queued messages)
          </Label>
        </div>
        {SESSION.map(number)}
      </div>
      {form.profileKind !== 'feeds' && <div className="grid gap-3 sm:grid-cols-2">
        <Field id="mqtt-schema" label="Schema version" error={errors.schemaVersion}>
          <Input id="mqtt-schema" value={form.schemaVersion} onChange={(event) => onChange({ schemaVersion: event.target.value })} />
        </Field>
        <Field id="mqtt-time-unit" label="Timestamp unit" error={errors.timeUnit}>
          <NativeSelect id="mqtt-time-unit" value={form.timeUnit} options={TIME_UNITS.map((unit) => ({ value: unit, label: unit }))} onChange={(unit) => onChange({ timeUnit: unit as MqttConnectionForm['timeUnit'] })} />
        </Field>
        {TIME.map(number)}
        <Field id="mqtt-on-stale" label="On stale timestamp" error={errors.onStale}>
          <NativeSelect
            id="mqtt-on-stale"
            value={form.onStale}
            placeholder="Profile default"
            options={[
              { value: 'reject', label: 'Reject (quarantine)' },
              { value: 'flag', label: 'Flag quality.degraded (samples)' },
            ]}
            onChange={(value) => onChange({ onStale: value as MqttConnectionForm['onStale'] })}
          />
        </Field>
        <Field id="mqtt-quality" label="Quality protocol" error={errors.qualityProtocol}>
          <NativeSelect
            id="mqtt-quality"
            value={form.qualityProtocol}
            placeholder="None declared"
            options={QUALITY_PROTOCOLS.map((protocol) => ({ value: protocol, label: protocol }))}
            onChange={(value) => onChange({ qualityProtocol: value as MqttConnectionForm['qualityProtocol'] })}
          />
        </Field>
      </div>}
    </div>
  );
}
