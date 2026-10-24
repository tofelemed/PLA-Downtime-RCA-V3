import { useState } from 'react';
import { useCreateShiftNote } from '@/api/v2/queries/shift-handover';
import type { ShiftInstanceView, ShiftNoteView } from '@/api/v2/types/ops-reports';
import { Button } from '@/components/ui/button';
import { ReportCard } from '@/features/pla-analytics/components/report-card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { InlineError } from '@/features/ux-kit/errors/inline-error';
import { formatDateTime, useCalendarPreference } from '@/lib/dates';

const MAX = 2000;

export interface ShiftNotesCardProps {
  localDate: string;
  shiftName: string;
  instances: readonly ShiftInstanceView[];
  notes: readonly ShiftNoteView[];
  timeZone: string;
}

type NoteFormProps = Pick<ShiftNotesCardProps, 'localDate' | 'shiftName' | 'instances'>;

function NoteForm({ localDate, shiftName, instances }: NoteFormProps) {
  const create = useCreateShiftNote();
  const [unitId, setUnitId] = useState(instances[0]?.unitId ?? '');
  const [body, setBody] = useState('');
  const chosen = instances.some((i) => i.unitId === unitId) ? unitId : (instances[0]?.unitId ?? '');
  const save = async () => {
    await create.submit({ unitId: chosen, localDate, shiftName, body });
    setBody('');
  };
  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    save().catch(() => undefined);
  };
  return (
    <form className="space-y-2" onSubmit={onSubmit} data-testid="shift-note-form">
      {instances.length > 1 && (
        <select aria-label="Unit" className="h-9 rounded-md border bg-background px-2 text-sm" value={chosen} onChange={(e) => setUnitId(e.target.value)}>
          {instances.map((i) => (
            <option key={i.unitId} value={i.unitId}>
              {i.unitName ?? i.unitId}
            </option>
          ))}
        </select>
      )}
      <Label htmlFor="shift-note-body">Note for the next shift</Label>
      <Textarea id="shift-note-body" maxLength={MAX} value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={create.isPending || !chosen || body.trim().length === 0}>
          Add note
        </Button>
        {create.isError && <InlineError error={create.error} title="Could not save the note" />}
      </div>
    </form>
  );
}

/** Handover notes of the shift (R2): append-only; roles that record events can add one. */
export function ShiftNotesCard(props: ShiftNotesCardProps) {
  const { canWriteEvents } = useCapabilities();
  const pref = useCalendarPreference();
  const units = new Map(props.instances.map((i) => [i.unitId, i.unitName]));
  return (
    <ReportCard title="Handover notes" testId="shift-notes">
      {props.notes.length === 0 && <p className="text-sm text-muted-foreground">No notes for this shift yet.</p>}
      <ul className="space-y-2">
        {props.notes.map((note) => (
          <li key={note.id} className="rounded-md border p-2 text-sm" data-testid="shift-note">
            <p className="whitespace-pre-wrap">{note.body}</p>
            <p className="text-xs text-muted-foreground">
              {note.authorName ?? 'Unknown author'} · {units.get(note.unitId) ?? ''} · {formatDateTime(note.createdAt, { timeZone: props.timeZone, ...pref })}
            </p>
          </li>
        ))}
      </ul>
      {canWriteEvents && props.instances.length > 0 && <NoteForm localDate={props.localDate} shiftName={props.shiftName} instances={props.instances} />}
    </ReportCard>
  );
}
