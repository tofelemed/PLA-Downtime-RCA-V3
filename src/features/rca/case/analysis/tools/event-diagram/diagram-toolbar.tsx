import type { RcaDiagramNode } from '@/api/v2/types/rca';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { ActionIcon, UiIcon } from '@/lib/icons';

export interface DiagramToolbarProps {
  eventCount: number;
  selected: RcaDiagramNode | undefined;
  onAdd: () => void;
  onConnect: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

/** Add, connect (the keyboard alternative to dragging, F-10), edit and delete events of the diagram (h-9, icon + words). */
export function DiagramToolbar({ eventCount, selected, onAdd, onConnect, onEdit, onDelete }: DiagramToolbarProps) {
  return (
    <>
      <Button className="h-9" onClick={onAdd} data-testid="add-event">
        <ActionIcon.add aria-hidden="true" className="h-4 w-4" />
        Add event
      </Button>
      <Button variant="outline" className="h-9" disabled={eventCount < 2} onClick={onConnect} data-testid="add-connection">
        <UiIcon.next aria-hidden="true" className="h-4 w-4" />
        Add connection
      </Button>
      <Button variant="outline" className="h-9" disabled={!selected} onClick={() => selected && onEdit(selected.id)}>
        <ActionIcon.edit aria-hidden="true" className="h-4 w-4" />
        Edit selected event
      </Button>
      <ConfirmDialog
        trigger={
          <Button variant="outline" className="h-9" disabled={!selected}>
            <ActionIcon.delete aria-hidden="true" className="h-4 w-4" />
            Delete selected event
          </Button>
        }
        title={`Delete "${selected?.label ?? ''}"?`}
        description="The event and its connections are removed from the diagram when you save it."
        confirmLabel="Delete event"
        destructive
        onConfirm={() => selected && onDelete(selected.id)}
      />
    </>
  );
}
