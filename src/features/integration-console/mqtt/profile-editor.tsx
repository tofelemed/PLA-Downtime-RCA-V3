import type { ConnectionView } from '@/api/v2/types/integrations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { ConsoleRefusal } from '../components/console-refusal';
import { Field } from '../components/field';
import { NativeSelect } from '../components/native-select';
import { useProfileDraft } from './hooks/use-profile-draft';
import { IDENTITY_STRATEGIES, QUALITY_PROTOCOLS, TIME_UNITS } from './model/mqtt-form';
import type { ProfileDraft } from './model/profile-draft';
import { ProfileFieldsEditor } from './profile-fields-editor';
import { ValueMapEditor } from './value-map-editor';

/**
 * Payload profile editor (plan 1.8 step 5): topic template, field overrides, time and quality
 * settings, value maps with live classification. Saved as a JSON merge patch of `payloadProfile`
 * only, so the transport block (topics, broker) is never touched; the server re-validates the merged
 * profile and restarts the subscription at the new config version.
 */
export function ProfileEditor({ connection }: { connection: ConnectionView }) {
  const { canWriteIntegration } = useCapabilities();
  const editor = useProfileDraft(connection);
  const { draft, errors } = editor;
  const blocked = Object.keys(errors).length > 0;
  const select = <K extends 'identityStrategy' | 'timeUnit' | 'onStale' | 'qualityProtocol' | 'reasonUnmapped'>(key: K, value: string) =>
    editor.change({ [key]: value } as Partial<ProfileDraft>);
  return (
    <section aria-label="Payload profile" className="space-y-4" data-testid="profile-editor" data-kind={draft.kind} data-dirty={editor.patch !== null}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="pp-template" label={`Topic template (${draft.kind})`} error={errors.topicTemplate}>
          <Input id="pp-template" value={draft.topicTemplate} onChange={(event) => editor.change({ topicTemplate: event.target.value })} />
        </Field>
        <Field id="pp-schema" label="Schema version">
          <Input id="pp-schema" value={draft.schemaVersion} onChange={(event) => editor.change({ schemaVersion: event.target.value })} />
        </Field>
        <Field id="pp-identity" label="Identity strategy">
          <NativeSelect id="pp-identity" value={draft.identityStrategy} placeholder="seq_boot (default)" options={IDENTITY_STRATEGIES.map((value) => ({ value, label: value }))} onChange={(value) => select('identityStrategy', value)} />
        </Field>
        <Field id="pp-time-unit" label="Timestamp unit">
          <NativeSelect id="pp-time-unit" value={draft.timeUnit} placeholder="auto (default)" options={TIME_UNITS.map((value) => ({ value, label: value }))} onChange={(value) => select('timeUnit', value)} />
        </Field>
        <Field id="pp-future" label="Max future skew (s)" error={errors.maxFutureSkewSeconds}>
          <Input id="pp-future" inputMode="numeric" value={draft.maxFutureSkewSeconds} onChange={(event) => editor.change({ maxFutureSkewSeconds: event.target.value })} />
        </Field>
        <Field id="pp-past" label="Max age (s)" error={errors.maxPastSeconds}>
          <Input id="pp-past" inputMode="numeric" value={draft.maxPastSeconds} onChange={(event) => editor.change({ maxPastSeconds: event.target.value })} />
        </Field>
        <Field id="pp-stale" label="On stale timestamp">
          <NativeSelect id="pp-stale" value={draft.onStale} placeholder="Profile default" options={[{ value: 'reject', label: 'Reject (quarantine)' }, { value: 'flag', label: 'Flag quality.degraded' }]} onChange={(value) => select('onStale', value)} />
        </Field>
        <Field id="pp-quality" label="Quality protocol">
          <NativeSelect id="pp-quality" value={draft.qualityProtocol} placeholder="None declared" options={QUALITY_PROTOCOLS.map((value) => ({ value, label: value }))} onChange={(value) => select('qualityProtocol', value)} />
        </Field>
        <Field id="pp-reason-unmapped" label="Unmapped reason token" hint="reject = quarantined unmapped_value; keep = event created uncoded with the raw token.">
          <NativeSelect id="pp-reason-unmapped" testId="pp-reason-unmapped" value={draft.reasonUnmapped} placeholder="reject (default)" options={[{ value: 'reject', label: 'Reject' }, { value: 'keep', label: 'Keep the raw token' }]} onChange={(value) => select('reasonUnmapped', value)} />
        </Field>
      </div>
      <ProfileFieldsEditor kind={draft.kind} rows={draft.fields} error={errors.fields} onChange={(rows) => editor.setRows('fields', rows)} />
      <ValueMapEditor kind="state" rows={draft.stateMap} error={errors.stateMap} onChange={(rows) => editor.setRows('stateMap', rows)} />
      <ValueMapEditor kind="reason" rows={draft.reasonMap} error={errors.reasonMap} keepUnmapped={draft.reasonUnmapped === 'keep'} onChange={(rows) => editor.setRows('reasonMap', rows)} />
      <ConsoleRefusal error={editor.failed} />
      <div className="flex flex-wrap items-center gap-2">
        {canWriteIntegration && (
          <Button size="sm" onClick={() => void editor.save()} disabled={editor.patch === null || blocked || editor.isPending} data-testid="profile-save">
            Save profile (merge patch)
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={editor.reset} disabled={editor.patch === null} data-testid="profile-reset">
          Discard changes
        </Button>
        {editor.savedAt && (
          <span role="status" className="text-xs text-muted-foreground" data-testid="profile-saved">
            Saved; the subscription restarts at config v{connection.configVersion} within 10 s.
          </span>
        )}
      </div>
      {editor.patch && (
        <details>
          <summary className="cursor-pointer text-xs">Patch to send (payloadProfilePatch)</summary>
          <pre className="max-h-48 overflow-auto rounded bg-muted p-2 text-xs" data-testid="profile-patch">{JSON.stringify(editor.patch, null, 2)}</pre>
        </details>
      )}
    </section>
  );
}
