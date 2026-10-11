import { Input } from '@/components/ui/input';
import { Field } from '../../components/field';
import { NativeSelect } from '../../components/native-select';
import { IDENTITY_STRATEGIES, PROFILE_KINDS, PROFILE_PRESETS, type ProfileKind } from '../model/mqtt-form';
import { parseTopicTemplate } from '../model/topic-rules';
import type { StepProps } from './step-props';

const IDENTITY_LABELS: Record<(typeof IDENTITY_STRATEGIES)[number], string> = {
  seq_boot: 'boot_id + seq (delivery identity; samples, state, availability)',
  event_id: 'event_id + revision (events)',
  payload_hash: 'payload hash + event time (no ids from the source)',
};

/**
 * Step 1 — payload profile: which decoder reads the messages, the topic template whose captures
 * identify the equipment, and the identity strategy. Choosing a kind fills the contract v1 preset
 * (template, filters, identity); the preset's topic filters land on the Basics step.
 */
export function ProfileStep({ form, errors, onChange }: StepProps) {
  const parsed = parseTopicTemplate(form.topicTemplate.trim());
  const pick = (kind: ProfileKind) => {
    const preset = PROFILE_PRESETS[kind];
    onChange({ profileKind: kind, topicTemplate: preset.topicTemplate, topics: preset.topics, identityStrategy: preset.identityStrategy });
  };
  return (
    <div className="space-y-3">
      <Field id="mqtt-kind" label="Payload profile" error={errors.profileKind} hint={PROFILE_PRESETS[form.profileKind].description}>
        <NativeSelect
          id="mqtt-kind"
          testId="mqtt-kind"
          value={form.profileKind}
          options={PROFILE_KINDS.map((kind) => ({ value: kind, label: PROFILE_PRESETS[kind].label }))}
          onChange={(kind) => pick(kind as ProfileKind)}
        />
      </Field>
      <Field
        id="mqtt-template"
        label="Topic template"
        error={errors.topicTemplate}
        hint={typeof parsed === 'string' ? 'Literal levels and {capture} levels; {unit} or {machine} names the equipment.' : `Captures: ${parsed.captures.join(', ') || 'none'} · matches filter ${parsed.filter}`}
      >
        <Input id="mqtt-template" value={form.topicTemplate} onChange={(event) => onChange({ topicTemplate: event.target.value })} />
      </Field>
      <Field id="mqtt-identity" label="Identity strategy" error={errors.identityStrategy} hint="How a redelivered or retained message is recognised as the same observation (never a second effect).">
        <NativeSelect
          id="mqtt-identity"
          testId="mqtt-identity"
          value={form.identityStrategy}
          options={IDENTITY_STRATEGIES.map((strategy) => ({ value: strategy, label: IDENTITY_LABELS[strategy] }))}
          onChange={(strategy) => onChange({ identityStrategy: strategy as (typeof IDENTITY_STRATEGIES)[number] })}
        />
      </Field>
      <p className="text-xs text-muted-foreground">Field overrides and value maps are edited on the connection's Payload profile tab once it exists.</p>
    </div>
  );
}
