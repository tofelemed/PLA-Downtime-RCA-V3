import { useState } from 'react';
import { useRcaLinks } from '@/api/v2/queries/rca-cases';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { IconButton } from '@/features/ux-kit/icon-button';
import { plural } from '@/features/ux-kit/format/plural';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { ActionIcon } from '@/lib/icons';
import { toggleEvidenceLink } from '../../../../model/logic-tree';
import { timelineOf, type TimelineEntry } from '../../../../model/timeline';
import { useRcaFormat } from '../../../../use-rca-format';
import { useCaseWorkspace } from '../../../case-context';
import { useCasePatch } from '../../../use-case-patch';
import { ToolCanvas } from '../tool-canvas';
import { addEvent, removeEvent, updateEvent } from '../event-diagram/diagram-model';
import { EventDialog, type EventFields } from '../event-diagram/event-dialog';
import { EvidenceLinkPopover } from '../evidence-link-popover';

type Editing = { mode: 'add' } | { mode: 'edit'; id: string } | null;

/** QA L5: "No evidence linked" / "1 evidence item" / "3 evidence items" (the count links to this entry). */
const evidenceCountText = (count: number, number: (value: number) => string): string =>
  count === 0 ? 'No evidence linked' : plural(count, 'evidence item', 'evidence items', number);

function EntryActions({ entry, onEdit }: { entry: TimelineEntry; onEdit: () => void }) {
  const { rca } = useCaseWorkspace();
  const patch = useCasePatch();
  return (
    <span className="flex items-center gap-1">
      <EvidenceLinkPopover
        targetId={entry.id}
        targetName={entry.title}
        evidence={rca.evidence}
        disabled={patch.isPending}
        onToggle={(evidenceId, linked) => void patch.save({ evidence: toggleEvidenceLink(rca.evidence, evidenceId, entry.id, linked) }).catch(() => null)}
      />
      {entry.source === 'diagram' && (
        <>
          <IconButton icon={ActionIcon.edit} label={`Edit ${entry.title}`} onClick={onEdit} />
          <ConfirmDialog
            trigger={<IconButton icon={ActionIcon.delete} label={`Delete ${entry.title}`} tooltip={false} />}
            title={`Delete "${entry.title}"?`}
            description="The event is removed from the timeline and the event diagram."
            confirmLabel="Delete event"
            destructive
            onConfirm={() => patch.save({ eventDiagram: removeEvent(rca.eventDiagram, entry.id) })}
          />
        </>
      )}
    </span>
  );
}

function TimelineRow({ entry, readOnly, onEdit }: { entry: TimelineEntry; readOnly: boolean; onEdit: () => void }) {
  const { dateTime } = useRcaFormat();
  const { number } = useNumberFormat();
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 rounded-md border bg-card p-3" data-testid="timeline-entry">
      <div className="min-w-0 space-y-1 text-sm">
        <p className="font-medium">
          <span className="tabular-nums text-muted-foreground">{entry.at ? dateTime(entry.at) : 'No time'}</span> · {entry.title}
        </p>
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary" className="whitespace-nowrap">{entry.type ?? 'Event'}</Badge>
          {entry.severity && <Badge variant="outline" className="whitespace-nowrap">{entry.severity}</Badge>}
          {entry.asset && <Badge variant="outline" className="whitespace-nowrap">{entry.asset}</Badge>}
          <Badge variant="outline" className="whitespace-nowrap">{evidenceCountText(entry.evidence, number)}</Badge>
        </div>
        {entry.description && <p className="max-w-[75ch] text-muted-foreground">{entry.description}</p>}
      </div>
      {!readOnly && <EntryActions entry={entry} onEdit={onEdit} />}
    </li>
  );
}

function TimelineList({ entries, readOnly, onEdit }: { entries: readonly TimelineEntry[]; readOnly: boolean; onEdit: (id: string) => void }) {
  if (entries.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {readOnly ? 'No events recorded.' : 'No events yet: add one here or on the event diagram, or link production events to the investigation.'}
      </p>
    );
  }
  return (
    <ol className="space-y-2">
      {entries.map((entry) => (
        <TimelineRow key={entry.id} entry={entry} readOnly={readOnly} onEdit={() => onEdit(entry.id)} />
      ))}
    </ol>
  );
}

function AddEventButton({ onClick }: { onClick: () => void }) {
  return (
    <Button className="h-9" onClick={onClick}>
      <ActionIcon.add aria-hidden="true" className="h-4 w-4" />
      Add event
    </Button>
  );
}

/** Event timeline: diagram events and the production events linked to the case, in time order. */
export function TimelineTool() {
  const { rca, readOnly } = useCaseWorkspace();
  const links = useRcaLinks(rca.id);
  const patch = useCasePatch();
  const [editing, setEditing] = useState<Editing>(null);
  const entries = timelineOf(rca.eventDiagram.nodes, links.data ?? [], rca.evidence);
  const save = async (fields: EventFields) => {
    const diagram = editing?.mode === 'edit' ? updateEvent(rca.eventDiagram, editing.id, fields) : { ...rca.eventDiagram, nodes: [...rca.eventDiagram.nodes, addEvent(rca.eventDiagram.nodes, fields)] };
    if (await patch.save({ eventDiagram: diagram }).catch(() => null)) setEditing(null);
  };
  return (
    <div className="space-y-3" data-testid="event-timeline">
      {patch.error ? <FriendlyErrorAlert error={patch.error} /> : null}
      <ToolCanvas label="Event timeline" toolbar={readOnly ? undefined : <AddEventButton onClick={() => setEditing({ mode: 'add' })} />}>
        <TimelineList entries={entries} readOnly={readOnly} onEdit={(id) => setEditing({ mode: 'edit', id })} />
      </ToolCanvas>
      {editing && (
        <EventDialog
          title={editing.mode === 'edit' ? 'Edit event' : 'Add event'}
          initial={editing.mode === 'edit' ? rca.eventDiagram.nodes.find((node) => node.id === editing.id) : undefined}
          onSave={(fields) => void save(fields)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
