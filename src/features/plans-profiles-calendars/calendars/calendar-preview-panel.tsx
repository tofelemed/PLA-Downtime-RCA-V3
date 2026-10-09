import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useCalendarPreview } from '@/api/v2/queries/calendars';
import { DurationText } from '@/features/ux-kit/duration-text';
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

/** `POST /calendars/preview` for one unit and operational dates (≤ 62 days): instances, DST warnings, diff. */
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
  const view = preview.data;
  const dstWarnings = view?.warnings.filter(isDstWarning) ?? [];
  return (
    <Card data-testid="calendar-preview">
      <CardHeader>
        <CardTitle className="text-base">Preview {candidate?.candidateVersionId ? '(stored version)' : candidate ? '(unsaved edits)' : ''}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-4">
          <FormField id="previewUnit" label="Unit">
            <NativeSelect id="previewUnit" value={unitId} options={unitOptions} placeholder="Choose a unit" onChange={setUnitId} />
          </FormField>
          <FormField id="previewFrom" label="First operational date">
            <Input id="previewFrom" type="date" value={localFrom} onChange={(e) => setLocalFrom(e.target.value)} />
          </FormField>
          <FormField id="previewTo" label="Last operational date">
            <Input id="previewTo" type="date" value={localTo} onChange={(e) => setLocalTo(e.target.value)} />
          </FormField>
          <div className="flex items-end">
            <Button onClick={run} disabled={!ready || preview.isPending} data-testid="calendar-preview-submit">
              Run preview
            </Button>
          </div>
        </div>
        {!candidate && <p className="text-sm text-muted-foreground">Choose “Preview” on a calendar version or on unsaved edits.</p>}
        <RefusalNotice error={preview.error} timezone={timezone} />
        {view && (
          <div className="space-y-2">
            <p className="text-sm" data-testid="preview-scheduled" data-seconds={view.scheduledSeconds}>
              Scheduled time ({view.timezone}): <DurationText seconds={view.scheduledSeconds} /> · {view.instances.length} instances · diff vs stored: +{view.diff.added.length} / −
              {view.diff.removed.length} / changed {view.diff.changed.length} / unchanged {view.diff.unchangedCount}
            </p>
            {dstWarnings.length > 0 && (
              <ul className="space-y-1 rounded-md border border-amber-400 bg-amber-50 p-2 text-sm dark:bg-amber-950" data-testid="dst-warnings" role="status">
                {dstWarnings.map((warning) => (
                  <li key={`${warning.code}-${warning.localDate}-${warning.shiftName}`} className="flex items-center gap-2" data-testid="dst-warning" data-code={warning.code}>
                    <AlertTriangle className="h-4 w-4 text-amber-700" aria-hidden />
                    {warning.localDate} {warning.shiftName ?? ''}: {warningText(warning)}
                  </li>
                ))}
              </ul>
            )}
            <CalendarPreviewTable preview={view} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
