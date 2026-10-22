import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CalendarPublishView, CalendarVersionView } from '@/api/v2/types/calendars';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DateInput } from '@/features/ux-kit/date-inputs';
import { Section } from '@/features/ux-kit/page-layout';
import { useUnsavedChangesGuard } from '@/features/ux-kit/use-unsaved-changes-guard';
import { FormField } from '../components/form-field';
import { SaveRefusalAlert } from '../components/save-refusal-alert';
import { VersionStateBadge } from '@/features/ux-kit/version-state-badge';
import { useCalendarEditor, type CalendarScope, type PreviewCandidate } from '../hooks/use-calendar-editor';
import type { CalendarDraft } from '../model/calendar-draft';
import { ExclusionsEditor } from './exclusions-editor';
import { HolidaysEditor } from './holidays-editor';
import { ShiftTemplatesEditor } from './shift-templates-editor';
import { TimezoneInput } from './timezone-input';

export interface CalendarEditorProps {
  version: CalendarVersionView | null;
  seed: CalendarDraft;
  scope: CalendarScope;
  displayTimezone: string;
  onSaved: (version: CalendarVersionView) => void;
  /** a stored draft was published (the page shows the result dialog) */
  onPublished?: (result: CalendarPublishView) => void;
  /** "New version from this" on a published version */
  onNewFrom: (version: CalendarVersionView) => void;
  onPreview: (candidate: PreviewCandidate) => void;
}

type Editor = ReturnType<typeof useCalendarEditor>;

const CALENDAR_LIST = '/setup/calendars';

function BasicsFields({ editor, readOnly }: { editor: Editor; readOnly: boolean }) {
  const { draft, errors } = editor;
  const set = <K extends keyof CalendarDraft>(key: K, value: CalendarDraft[K]) => editor.setDraft({ ...draft, [key]: value });
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <FormField id="calTimezone" label="Time zone" error={errors.timezone} required={!readOnly}>
        <TimezoneInput id="calTimezone" value={draft.timezone} disabled={readOnly} onChange={(v) => set('timezone', v)} />
      </FormField>
      <FormField id="calDayStart" label="Operational day starts at" error={errors.operationalDayStart} required={!readOnly}>
        <Input id="calDayStart" value={draft.operationalDayStart} placeholder="06:00" disabled={readOnly} onChange={(e) => set('operationalDayStart', e.target.value)} />
      </FormField>
      <DateInput id="calFrom" label="Effective from (operational date)" value={draft.effectiveFrom} disabled={readOnly} required={!readOnly} error={errors.effectiveFrom} onChange={(v) => set('effectiveFrom', v)} />
      <DateInput id="calTo" label="Effective to (exclusive, optional)" value={draft.effectiveTo} disabled={readOnly} error={errors.effectiveTo} onChange={(v) => set('effectiveTo', v)} />
    </div>
  );
}

function EditorButtons({ editor, version, readOnly, props }: { editor: Editor; version: CalendarVersionView | null; readOnly: boolean; props: CalendarEditorProps }) {
  const { canWriteCalendars } = useCapabilities();
  const save = async () => {
    const saved = await editor.save();
    if (saved) props.onSaved(saved);
  };
  const publish = async () => {
    const result = await editor.publishStored();
    if (result) props.onPublished?.(result);
  };
  const preview = () => {
    const candidate = editor.candidate();
    if (candidate) props.onPreview(candidate);
  };
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={preview} data-testid="calendar-preview-run">
        Preview
      </Button>
      {!readOnly && (
        <Button onClick={save} disabled={editor.saving || !editor.dirty} data-testid="calendar-save">
          Save draft
        </Button>
      )}
      {version?.state === 'draft' && canWriteCalendars && (
        <Button onClick={() => void publish()} disabled={editor.publishing || editor.dirty} data-testid="calendar-publish" title={editor.dirty ? 'Save the draft first' : undefined}>
          Publish
        </Button>
      )}
      {editor.readOnly && canWriteCalendars && version && (
        <Button variant="outline" onClick={() => props.onNewFrom(version)} data-testid="calendar-new-from">
          New version from this
        </Button>
      )}
      <Button asChild variant="outline">
        <Link to={CALENDAR_LIST} data-testid="calendar-cancel">
          {readOnly ? 'Back to calendars' : 'Cancel'}
        </Link>
      </Button>
    </div>
  );
}

/**
 * Calendar editor: time zone, operational day start, effective dates, shift templates, holidays, exclusions.
 * Save ends in a toast and a clean editor; a refused save or publish is the red alert at the top.
 */
export function CalendarEditor(props: CalendarEditorProps) {
  const { version, displayTimezone } = props;
  const editor = useCalendarEditor(version, props.seed, props.scope);
  const { canWriteCalendars } = useCapabilities();
  const { draft, errors } = editor;
  /** published versions are immutable; users who are not calendar writers only view and preview */
  const readOnly = editor.readOnly || !canWriteCalendars;
  useUnsavedChangesGuard(editor.edited && canWriteCalendars);
  const set = <K extends keyof CalendarDraft>(key: K, value: CalendarDraft[K]) => editor.setDraft({ ...draft, [key]: value });
  return (
    <div className="space-y-6" data-testid="calendar-editor" data-state={version?.state ?? 'new'}>
      <SaveRefusalAlert error={editor.failure} timezone={displayTimezone} />
      <Section title="Calendar" actions={version ? <VersionStateBadge state={version.state} /> : undefined}>
        <div className="space-y-3">
          {editor.readOnly && (
            <p className="text-sm text-muted-foreground" data-testid="calendar-immutable">
              Published versions cannot be changed; changes are a new version.
            </p>
          )}
          {!editor.readOnly && !canWriteCalendars && (
            <p className="text-sm text-muted-foreground" data-testid="calendar-view-only">
              Your roles in this plant do not include calendar editing: you can view and preview this version.
            </p>
          )}
          <BasicsFields editor={editor} readOnly={readOnly} />
        </div>
      </Section>
      <Section title="Shifts">
        <ShiftTemplatesEditor rows={draft.templates} errors={errors} readOnly={readOnly} onChange={(rows) => set('templates', rows)} />
      </Section>
      <Section title="Holidays and exclusions" collapsible>
        <div className="space-y-4">
          <HolidaysEditor rows={draft.holidays} errors={errors} readOnly={readOnly} onChange={(rows) => set('holidays', rows)} />
          <ExclusionsEditor rows={draft.exclusions} timezone={draft.timezone} errors={errors} readOnly={readOnly} onChange={(rows) => set('exclusions', rows)} />
        </div>
      </Section>
      <EditorButtons editor={editor} version={version} readOnly={readOnly} props={props} />
    </div>
  );
}
