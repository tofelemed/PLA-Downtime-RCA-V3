import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { CalendarVersionView } from '@/api/v2/types/calendars';
import { FormField } from '../components/form-field';
import { RefusalNotice } from '../components/refusal-notice';
import { VersionStateBadge } from '../components/version-state-badge';
import { useCalendarEditor, type CalendarScope, type PreviewCandidate } from '../hooks/use-calendar-editor';
import { draftOf, type CalendarDraft } from '../model/calendar-draft';
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
  onNewFrom: (seed: CalendarDraft) => void;
  onPreview: (candidate: PreviewCandidate) => void;
}

/** CAL01 editor: IANA zone, operational day start, effective dates, shift templates, holidays, exclusions. */
export function CalendarEditor(props: CalendarEditorProps) {
  const { version, displayTimezone } = props;
  const editor = useCalendarEditor(version, props.seed, props.scope);
  const { draft, errors, readOnly } = editor;
  const set = <K extends keyof CalendarDraft>(key: K, value: CalendarDraft[K]) => editor.setDraft({ ...draft, [key]: value });
  const save = async () => {
    const saved = await editor.save();
    if (saved) props.onSaved(saved);
  };
  const preview = () => {
    const candidate = editor.candidate();
    if (candidate) props.onPreview(candidate);
  };
  return (
    <Card data-testid="calendar-editor" data-state={version?.state ?? 'new'}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {version ? `Calendar version ${version.version}` : 'New calendar version'}
          {version && <VersionStateBadge state={version.state} />}
        </CardTitle>
        {readOnly && (
          <p className="text-sm text-muted-foreground" data-testid="calendar-immutable">
            Published versions are immutable; changes are a new version.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <FormField id="calTimezone" label="Timezone (IANA)" error={errors.timezone}>
            <TimezoneInput id="calTimezone" value={draft.timezone} disabled={readOnly} onChange={(v) => set('timezone', v)} />
          </FormField>
          <FormField id="calDayStart" label="Operational day start" error={errors.operationalDayStart}>
            <Input id="calDayStart" value={draft.operationalDayStart} placeholder="HH:mm" disabled={readOnly} onChange={(e) => set('operationalDayStart', e.target.value)} />
          </FormField>
          <FormField id="calFrom" label="Effective from (operational date)" error={errors.effectiveFrom}>
            <Input id="calFrom" type="date" value={draft.effectiveFrom} disabled={readOnly} onChange={(e) => set('effectiveFrom', e.target.value)} />
          </FormField>
          <FormField id="calTo" label="Effective to (exclusive, optional)" error={errors.effectiveTo}>
            <Input id="calTo" type="date" value={draft.effectiveTo} disabled={readOnly} onChange={(e) => set('effectiveTo', e.target.value)} />
          </FormField>
        </div>
        <ShiftTemplatesEditor rows={draft.templates} errors={errors} readOnly={readOnly} onChange={(rows) => set('templates', rows)} />
        <HolidaysEditor rows={draft.holidays} errors={errors} readOnly={readOnly} onChange={(rows) => set('holidays', rows)} />
        <ExclusionsEditor rows={draft.exclusions} timezone={draft.timezone} errors={errors} readOnly={readOnly} onChange={(rows) => set('exclusions', rows)} />
        <RefusalNotice error={editor.saveError ?? editor.publishError} timezone={displayTimezone} />
        {editor.published && (
          <p className="text-sm" data-testid="calendar-published">
            Published: {editor.published.materialization.map((m) => `${m.insertedInstances} instances generated`).join(' · ') || 'no unit instances'}.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={preview} data-testid="calendar-preview-run">
            Preview
          </Button>
          {!readOnly && (
            <Button onClick={save} disabled={editor.saving || !editor.dirty} data-testid="calendar-save">
              Save draft
            </Button>
          )}
          {version?.state === 'draft' && (
            <Button onClick={editor.publishStored} disabled={editor.publishing || editor.dirty} data-testid="calendar-publish" title={editor.dirty ? 'Save the draft first' : undefined}>
              Publish
            </Button>
          )}
          {readOnly && version && (
            <Button variant="outline" onClick={() => props.onNewFrom({ ...draftOf(version), effectiveFrom: '' })} data-testid="calendar-new-from">
              New version from this
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
