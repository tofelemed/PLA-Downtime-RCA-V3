import { useCallback, useState } from 'react';
import { addEdge, useEdgesState, useNodesState, type Connection } from 'reactflow';
import type { RcaEventDiagram } from '@/api/v2/types/rca';
import { useUnsavedChangesGuard } from '@/features/ux-kit/use-unsaved-changes-guard';
import { IconButton } from '@/features/ux-kit/icon-button';
import { ActionIcon } from '@/lib/icons';
import { useCaseWorkspace } from '../../../case-context';
import { ToolCanvas } from '../tool-canvas';
import { ToolConflict } from '../tool-conflict';
import { SaveBar } from '../tool-record';
import { ConnectionDialog } from './connection-dialog';
import { DiagramCanvas, SeverityLegend } from './diagram-canvas';
import { DiagramToolbar } from './diagram-toolbar';
import { addConnection, addEvent, fromFlow, noConnectionsText, removeEvent, toFlowEdges, toFlowNodes, updateEvent, type EventNodeData } from './diagram-model';
import { EventDialog, type EventFields } from './event-dialog';
import { useDiagramSession } from './use-diagram-session';

type Editing = { mode: 'add' } | { mode: 'edit'; id: string } | { mode: 'connect' } | null;

function Connections({ diagram, readOnly, onRemove }: { diagram: RcaEventDiagram; readOnly: boolean; onRemove: (id: string) => void }) {
  const label = (id: string) => diagram.nodes.find((node) => node.id === id)?.label ?? 'Removed event';
  if (diagram.edges.length === 0) return <p className="text-sm text-muted-foreground" data-testid="diagram-no-connections">{noConnectionsText(readOnly)}</p>;
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold text-heading">Connections</h3>
      <ul className="divide-y rounded-md border text-sm" aria-label="Connections">
        {diagram.edges.map((edge) => (
          <li key={edge.id} className="flex min-h-9 items-center justify-between gap-2 px-3 py-1">
            <span>
              {label(edge.source)} → {label(edge.target)}
            </span>
            {!readOnly && <IconButton icon={ActionIcon.remove} label={`Remove connection ${label(edge.source)} to ${label(edge.target)}`} onClick={() => onRemove(edge.id)} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The canvas state of the diagram and the edits applied to it (whole diagrams, connections, events). */
function useDiagramState() {
  const { rca } = useCaseWorkspace();
  const [nodes, setNodes, onNodesChange] = useNodesState<EventNodeData>(toFlowNodes(rca.eventDiagram.nodes));
  const [edges, setEdges, onEdgesChange] = useEdgesState(toFlowEdges(rca.eventDiagram.edges));
  const apply = useCallback(
    (next: RcaEventDiagram) => {
      setNodes(toFlowNodes(next.nodes));
      setEdges(toFlowEdges(next.edges));
    },
    [setNodes, setEdges],
  );
  const connect = (connection: Connection) => setEdges((current) => addEdge({ ...connection, id: `edge-${connection.source}-${connection.target}`, animated: true }, current));
  const removeEdge = (id: string) => setEdges((current) => current.filter((edge) => edge.id !== id));
  return { nodes, edges, onNodesChange, onEdgesChange, apply, connect, removeEdge, diagram: fromFlow(nodes, edges) };
}

/** The event and connection dialogs of the toolbar; each applies its change to the canvas (saved with "Save diagram"). */
function EditDialogs({ editing, diagram, apply, onClose }: { editing: Editing; diagram: RcaEventDiagram; apply: (next: RcaEventDiagram) => void; onClose: () => void }) {
  if (!editing) return null;
  if (editing.mode === 'connect') {
    return (
      <ConnectionDialog
        diagram={diagram}
        onAdd={(source, target) => {
          apply(addConnection(diagram, source, target));
          onClose();
        }}
        onClose={onClose}
      />
    );
  }
  const saveEvent = (fields: EventFields) => {
    apply(editing.mode === 'edit' ? updateEvent(diagram, editing.id, fields) : { ...diagram, nodes: [...diagram.nodes, addEvent(diagram.nodes, fields)] });
    onClose();
  };
  const initial = editing.mode === 'edit' ? diagram.nodes.find((node) => node.id === editing.id) : undefined;
  return <EventDialog title={editing.mode === 'edit' ? 'Edit event' : 'Add event'} initial={initial} onSave={saveEvent} onClose={onClose} />;
}

/**
 * Event diagram: events before the failure on a canvas, connected cause → effect; saved with the case
 * with If-Match = the version it was opened with (a concurrent save offers "Reload latest").
 */
export function EventDiagramTool() {
  const { readOnly } = useCaseWorkspace();
  const state = useDiagramState();
  const { diagram, apply } = state;
  const [editing, setEditing] = useState<Editing>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const session = useDiagramSession(diagram, apply);
  useUnsavedChangesGuard(session.dirty);
  const toolbar = readOnly ? undefined : (
    <DiagramToolbar
      eventCount={diagram.nodes.length}
      selected={diagram.nodes.find((node) => node.id === selected)}
      onAdd={() => setEditing({ mode: 'add' })}
      onConnect={() => setEditing({ mode: 'connect' })}
      onEdit={(id) => setEditing({ mode: 'edit', id })}
      onDelete={(id) => {
        apply(removeEvent(diagram, id));
        setSelected(null);
      }}
    />
  );
  return (
    <div className="space-y-3" data-testid="event-diagram">
      <ToolConflict conflict={session.conflict} keptText={session.keptText} reloading={session.reloading} onReload={() => void session.reload()} onDismissKept={session.dismissKept} />
      <ToolCanvas label="Event diagram" toolbar={toolbar} legend={<SeverityLegend />}>
        <DiagramCanvas nodes={state.nodes} edges={state.edges} readOnly={readOnly} onNodesChange={state.onNodesChange} onEdgesChange={state.onEdgesChange} onConnect={state.connect} onSelect={setSelected} />
      </ToolCanvas>
      <Connections diagram={diagram} readOnly={readOnly} onRemove={state.removeEdge} />
      <div className="border-t pt-3">
        <SaveBar onSave={session.save} disabled={!session.dirty} label="Save diagram" dirty={session.dirty} />
      </div>
      <EditDialogs editing={editing} diagram={diagram} apply={apply} onClose={() => setEditing(null)} />
    </div>
  );
}
