import type { RcaDiagramNode } from '@/api/v2/types/rca';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';

export interface DiagramToolbarProps {
  eventCount: number;
  selected: RcaDiagramNode | undefined;
  onAdd: () => void;
  onConnect: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

/** Add, connect (the keyboard alternative to dragging, F-10), edit and delete events of the diagram. */
export function DiagramToolbar({ eventCount, selected, onAdd, onConnect, onEdit, onDelete }: DiagramToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={onAdd} data-testid="add-event">
        Add event
      </Button>
      <Button size="sm" variant="outline" disabled={eventCount < 2} onClick={onConnect} data-testid="add-connection">
        Add connection
      </Button>
      <Button size="sm" variant="outline" disabled={!selected} onClick={() => selected && onEdit(selected.id)}>
        Edit selected event
      </Button>
      <ConfirmDialog
        trigger={
          <Button size="sm" variant="outline" disabled={!selected}>
            Delete selected event
          </Button>
        }
        title={`Delete "${selected?.label ?? ''}"?`}
        description="The event and its connections are removed from the diagram when you save it."
        confirmLabel="Delete event"
        destructive
        onConfirm={() => selected && onDelete(selected.id)}
      />
    </div>
  );
}
