import { Input } from '@/components/ui/input';
import { Field } from '../../components/field';
import { NativeSelect } from '../../components/native-select';
import { type IdentityStrategy, PROFILE_KINDS, PROFILE_PRESETS, type ProfileKind } from '../model/mqtt-form';
import { IDENTITY_STRATEGY_OPTIONS } from '../model/profile-labels';
import { parseTopicTemplate } from '../model/topic-rules';
import type { StepProps } from './step-props';

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
          options={IDENTITY_STRATEGY_OPTIONS}
          onChange={(strategy) => onChange({ identityStrategy: strategy as IdentityStrategy })}
        />
      </Field>
      <p className="text-xs text-muted-foreground">Field overrides and value maps are edited on the connection's Payload profile tab once it exists.</p>
    </div>
  );
}
