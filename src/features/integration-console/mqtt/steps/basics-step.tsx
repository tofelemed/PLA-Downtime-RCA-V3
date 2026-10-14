import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '../../components/field';
import { topicList } from '../model/mqtt-form';
import type { StepProps } from './step-props';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

/** Step 2 — name, broker URL (egress allowlist applies server-side) and the topic filter allowlist. */
export function BasicsStep({ form, errors, onChange }: StepProps) {
  const { number } = useNumberFormat();
  return (
    <div className="space-y-3">
      <Field id="mqtt-name" label="Name" error={errors.displayName}>
        <Input id="mqtt-name" value={form.displayName} onChange={(event) => onChange({ displayName: event.target.value })} />
      </Field>
      <Field id="mqtt-broker" label="Broker URL" error={errors.brokerUrl} hint="mqtt://host[:port] or mqtts://host[:port]; the broker must be on the server's egress allowlist.">
        <Input id="mqtt-broker" inputMode="url" placeholder="mqtts://broker.plant.local:8883" value={form.brokerUrl} onChange={(event) => onChange({ brokerUrl: event.target.value })} />
      </Field>
      <Field
        id="mqtt-topics"
        label="Topic filters (one per line)"
        error={errors.topics}
        hint={`${number(topicList(form).length)} filter(s). + matches one level, # the rest (last level only); at most ${number(64)}. A second connection overlapping these filters on the same broker is refused (duplicate feed).`}
      >
        <Textarea id="mqtt-topics" rows={4} className="font-mono text-xs" value={form.topics} onChange={(event) => onChange({ topics: event.target.value })} />
      </Field>
      <Field id="mqtt-availability" label="Availability topic (optional)" error={errors.availabilityTopic} hint="Retained ONLINE / OFFLINE plus the gateway's Last Will; OFFLINE marks the source unavailable, never a stop.">
        <Input id="mqtt-availability" placeholder="proact/v1/+/gateway/availability" value={form.availabilityTopic} onChange={(event) => onChange({ availabilityTopic: event.target.value })} />
      </Field>
    </div>
  );
}
