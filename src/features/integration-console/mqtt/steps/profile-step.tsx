import { Input } from '@/components/ui/input';
import { Field } from '../../components/field';
import { NativeSelect } from '../../components/native-select';
import { FeedsEditor } from '../feeds/feeds-editor';
import type { FeedErrors } from '../model/feeds';
import { type IdentityStrategy, MQTT_PROFILE_KINDS, type MqttProfileKind, PROFILE_PRESETS } from '../model/mqtt-form';
import { IDENTITY_STRATEGY_OPTIONS, profileKindLabel } from '../model/profile-labels';
import { parseTopicTemplate } from '../model/topic-rules';
import type { StepProps } from './step-props';

export interface ProfileStepProps extends StepProps {
  feedErrors: FeedErrors;
}

const FEEDS_HINT = 'One connection carries the PLA topic (daily production) and the downtime topic (stops). Each feed reads the template paths unless you edit them.';

/**
 * Step 1 — payload profile. The default is "PLA and downtime feeds" (plans/MQTT_FEEDS.md): the feed
 * editor. The contract v1 kinds stay selectable; choosing one fills its preset (template, filters,
 * identity), whose topic filters land on the Basics step.
 */
export function ProfileStep({ form, errors, feedErrors, onChange }: ProfileStepProps) {
  const pick = (kind: MqttProfileKind) => {
    if (kind === 'feeds') return onChange({ profileKind: 'feeds', topics: '' });
    const preset = PROFILE_PRESETS[kind];
    onChange({ profileKind: kind, topicTemplate: preset.topicTemplate, topics: preset.topics, identityStrategy: preset.identityStrategy });
  };
  const hint = form.profileKind === 'feeds' ? FEEDS_HINT : PROFILE_PRESETS[form.profileKind].description;
  return (
    <div className="space-y-3">
      <Field id="mqtt-kind" label="Payload profile" error={errors.profileKind} hint={hint}>
        <NativeSelect id="mqtt-kind" testId="mqtt-kind" value={form.profileKind} options={MQTT_PROFILE_KINDS.map((kind) => ({ value: kind, label: profileKindLabel(kind, true) }))} onChange={(kind) => pick(kind as MqttProfileKind)} />
      </Field>
      {form.profileKind === 'feeds' ? (
        <>
          {errors.feeds && <p className="text-sm text-destructive" data-testid="field-error-mqtt-feeds">{errors.feeds}</p>}
          <FeedsEditor feeds={form.feeds} errors={feedErrors} onChange={(feeds) => onChange({ feeds })} />
        </>
      ) : (
        <ContractFields {...{ form, errors, onChange }} />
      )}
    </div>
  );
}

function ContractFields({ form, errors, onChange }: StepProps) {
  const parsed = parseTopicTemplate(form.topicTemplate.trim());
  return (
    <>
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
    </>
  );
}
