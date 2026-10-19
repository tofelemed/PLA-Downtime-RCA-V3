import type { ConnectionView } from '@/api/v2/types/integrations';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { ConsoleRefusal } from '../components/console-refusal';
import { useProfileDraft } from './hooks/use-profile-draft';
import { profileServerFieldErrors } from './model/profile-field-errors';
import { identityStrategyLabel } from './model/profile-labels';
import { ProfileFieldsEditor } from './profile-fields-editor';
import { ProfileSaveBar } from './profile-save-bar';
import { ProfileSection } from './profile-section';
import { ProfileSettingsFields } from './profile-settings-fields';
import { ValueMapEditor } from './value-map-editor';

/** One retained profile draft and merge-patch save, presented in four task-focused groups. */
export function ProfileEditor({ connection }: { connection: ConnectionView }) {
  const { canWriteIntegration } = useCapabilities();
  const { number } = useNumberFormat();
  const editor = useProfileDraft(connection);
  const { draft } = editor;
  const errors = { ...profileServerFieldErrors(editor.failed), ...editor.errors };
  return (
    <section aria-label="Payload profile" className="min-w-0 space-y-4" data-testid="profile-editor" data-kind={draft.kind} data-dirty={editor.patch !== null}>
      <h2 className="sr-only">Payload profile settings</h2>
      <ProfileSaveBar editor={editor} canWrite={canWriteIntegration} />
      <ConsoleRefusal error={editor.failed} />
      <ProfileSection name="identity" title="Identity and schema" summary={`Schema ${draft.schemaVersion || 'not specified'} · ${identityStrategyLabel(draft.identityStrategy)}`} defaultOpen errors={[errors.topicTemplate, errors.schemaVersion, errors.identityStrategy]} failure={editor.failed}>
        <ProfileSettingsFields group="identity" editor={editor} errors={errors} />
      </ProfileSection>
      <ProfileSection name="time" title="Time and quality" summary={`${draft.timeUnit || 'auto'} timestamps · ${draft.qualityProtocol || 'No quality protocol declared'}`} errors={[errors.timeUnit, errors.maxFutureSkewSeconds, errors.maxPastSeconds, errors.onStale, errors.qualityProtocol]} failure={editor.failed}>
        <ProfileSettingsFields group="time" editor={editor} errors={errors} />
      </ProfileSection>
      <ProfileSection name="fields" title="Field overrides" summary={`${number(draft.fields.length)} ${draft.fields.length === 1 ? 'override' : 'overrides'} · source JSON paths`} errors={[errors.fields]} failure={editor.failed}>
        <ProfileFieldsEditor kind={draft.kind} rows={draft.fields} error={errors.fields} onChange={(rows) => editor.setRows('fields', rows)} />
      </ProfileSection>
      <ProfileSection name="maps" title="Value maps" summary={`${number(draft.stateMap.length)} state mappings · ${number(draft.reasonMap.length)} reason mappings`} errors={[errors.stateMap, errors.reasonMap, errors.reasonUnmapped]} failure={editor.failed}>
        <ProfileSettingsFields group="reason" editor={editor} errors={errors} />
        <ValueMapEditor kind="state" rows={draft.stateMap} error={errors.stateMap} onChange={(rows) => editor.setRows('stateMap', rows)} />
        <ValueMapEditor kind="reason" rows={draft.reasonMap} error={errors.reasonMap} keepUnmapped={draft.reasonUnmapped === 'keep'} onChange={(rows) => editor.setRows('reasonMap', rows)} />
      </ProfileSection>
      {editor.patch && <details className="min-w-0 rounded-md border p-3">
        <summary className="cursor-pointer text-xs">Technical details: pending profile changes</summary>
        <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted p-2 text-xs" tabIndex={0} aria-label="Pending profile merge patch" data-testid="profile-patch">{JSON.stringify(editor.patch, null, 2)}</pre>
      </details>}
    </section>
  );
}
