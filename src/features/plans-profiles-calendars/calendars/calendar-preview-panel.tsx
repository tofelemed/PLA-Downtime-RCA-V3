import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useCalendarPreview } from '@/api/v2/queries/calendars';
import type { CalendarPreviewView } from '@/api/v2/types/calendars';
import { DateInput } from '@/features/ux-kit/date-inputs';
import { DurationText } from '@/features/ux-kit/duration-text';
import { Section } from '@/features/ux-kit/page-layout';
import { formatOperationalDate, useCalendarPreference } from '@/lib/dates';
import { StatusIcon } from '@/lib/icons';
import { FormField } from '../components/form-field';
import { NativeSelect, type Option } from '../components/native-select';
import { RefusalNotice } from '../components/refusal-notice';
import type { PreviewCandidate } from '../hooks/use-calendar-editor';
import { isDstWarning, warningText } from '../model/calendar-preview';
import { CalendarPreviewTable } from './calendar-preview-table';

export interface CalendarPreviewPanelProps {
  candidate: PreviewCandidate | null;
  /** increments when the editor asks for a preview (a user click — never on render) */
  request: number;
  unitOptions: Option[];
  defaultUnitId: string;
  timezone: string;
}

function PreviewResult({ view }: { view: CalendarPreviewView }) {
  const pref = useCalendarPreference();
  const dstWarnings = view.warnings.filter(isDstWarning);
  const Icon = StatusIcon.warning;
  return (
    <div className="space-y-2">
      <p className="text-sm" data-testid="preview-scheduled" data-seconds={view.scheduledSeconds}>
        Scheduled time ({view.timezone}): <DurationText seconds={view.scheduledSeconds} /> · {view.instances.length} shifts · compared with what is stored: {view.diff.added.length} added,{' '}
        {view.diff.removed.length} removed, {view.diff.changed.length} changed, {view.diff.unchangedCount} unchanged
      </p>
      {dstWarnings.length > 0 && (
        <ul className="space-y-1 rounded-md border border-amber-400 bg-amber-50 p-2 text-sm dark:bg-amber-950" data-testid="dst-warnings" role="status">
          {dstWarnings.map((warning) => (
            <li key={`${warning.code}-${warning.localDate}-${warning.shiftName}`} className="flex items-center gap-2" data-testid="dst-warning" data-code={warning.code}>
              <Icon className="h-4 w-4 text-amber-700" aria-hidden="true" />
              {formatOperationalDate(warning.localDate, pref)} {warning.shiftName ?? ''}: {warningText(warning)}
            </li>
          ))}
        </ul>
      )}
      <CalendarPreviewTable preview={view} />
    </div>
  );
}

/** Server preview for one unit and up to 62 operational dates: shifts, clock-change warnings, differences. */
export function CalendarPreviewPanel({ candidate, request, unitOptions, defaultUnitId, timezone }: CalendarPreviewPanelProps) {
  const [unitId, setUnitId] = useState(defaultUnitId);
  const [localFrom, setLocalFrom] = useState('');
  const [localTo, setLocalTo] = useState('');
  const preview = useCalendarPreview();
  const ready = Boolean(candidate && unitId && localFrom && localTo);
  const run = () => {
    if (candidate && ready) preview.submit({ unitId, localFrom, localTo, ...candidate }).catch(() => undefined);
  };
  useEffect(() => {
    if (request > 0) run();
    // a new editor request (click) runs the preview with the current inputs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);
  const title = candidate?.candidateVersionId ? 'Preview of the stored version' : candidate ? 'Preview of the unsaved edits' : 'Preview';
  return (
    <Section title={title}>
      <div className="space-y-3" data-testid="calendar-preview">
        <div className="grid items-end gap-2 sm:grid-cols-4">
          <FormField id="previewUnit" label="Unit">
            <NativeSelect id="previewUnit" value={unitId} options={unitOptions} placeholder="Choose a unit" onChange={setUnitId} />
          </FormField>
          <DateInput id="previewFrom" label="First operational date" value={localFrom} onChange={setLocalFrom} />
          <DateInput id="previewTo" label="Last operational date" value={localTo} onChange={setLocalTo} />
          <Button onClick={run} disabled={!ready || preview.isPending} data-testid="calendar-preview-submit">
            Run preview
          </Button>
        </div>
        {!candidate && <p className="text-sm text-muted-foreground">Choose “Preview” above to check this version or your unsaved edits.</p>}
        <RefusalNotice error={preview.error} timezone={timezone} />
        {preview.data && <PreviewResult view={preview.data} />}
      </div>
    </Section>
  );
}
