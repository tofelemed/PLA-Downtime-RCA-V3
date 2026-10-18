import { useCallback, useState } from 'react';
import ReactFlow, { addEdge, Background, Controls, MiniMap, useEdgesState, useNodesState, type Connection } from 'reactflow';
import 'reactflow/dist/style.css';
import type { RcaEventDiagram } from '@/api/v2/types/rca';
import { useUnsavedChangesGuard } from '@/features/ux-kit/use-unsaved-changes-guard';
import { IconButton } from '@/features/ux-kit/icon-button';
import { ActionIcon } from '@/lib/icons';
import { useCaseWorkspace } from '../../../case-context';
import { ToolConflict } from '../tool-conflict';
import { SaveBar } from '../tool-record';
import { ConnectionDialog } from './connection-dialog';
import { DiagramToolbar } from './diagram-toolbar';
import { addConnection, addEvent, fromFlow, removeEvent, toFlowEdges, toFlowNodes, updateEvent, type EventNodeData } from './diagram-model';
import { EventDialog, type EventFields } from './event-dialog';
import { EventNode } from './event-node';
import { useDiagramSession } from './use-diagram-session';

/** Defined once outside the component (reactflow warns when node types change between renders). */
const NODE_TYPES = { rcaEvent: EventNode };

type Editing = { mode: 'add' } | { mode: 'edit'; id: string } | { mode: 'connect' } | null;

function Connections({ diagram, readOnly, onRemove }: { diagram: RcaEventDiagram; readOnly: boolean; onRemove: (id: string) => void }) {
  const label = (id: string) => diagram.nodes.find((node) => node.id === id)?.label ?? 'Removed event';
  if (diagram.edges.length === 0) return <p className="text-sm text-muted-foreground">No connections yet: use "Add connection", or drag from an event's bottom handle to another event.</p>;
  return (
    <ul className="divide-y rounded border text-sm" aria-label="Connections">
      {diagram.edges.map((edge) => (
        <li key={edge.id} className="flex items-center justify-between gap-2 px-2 py-1">
          <span>
            {label(edge.source)} → {label(edge.target)}
          </span>
          {!readOnly && <IconButton icon={ActionIcon.remove} label={`Remove connection ${label(edge.source)} to ${label(edge.target)}`} onClick={() => onRemove(edge.id)} />}
        </li>
      ))}
    </ul>
  );
}

/**
 * Event diagram: events before the failure on a canvas, connected cause → effect; saved with the case
 * with If-Match = the version it was opened with (a concurrent save offers "Reload latest").
 */
export function EventDiagramTool() {
  const { rca, readOnly } = useCaseWorkspace();
  const [nodes, setNodes, onNodesChange] = useNodesState<EventNodeData>(toFlowNodes(rca.eventDiagram.nodes));
  const [edges, setEdges, onEdgesChange] = useEdgesState(toFlowEdges(rca.eventDiagram.edges));
  const [editing, setEditing] = useState<Editing>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const diagram = fromFlow(nodes, edges);
  const apply = useCallback(
    (next: RcaEventDiagram) => {
      setNodes(toFlowNodes(next.nodes));
      setEdges(toFlowEdges(next.edges));
    },
    [setNodes, setEdges],
  );
  const session = useDiagramSession(diagram, apply);
  const dirty = session.dirty;
  useUnsavedChangesGuard(dirty);
  const saveEvent = (fields: EventFields) => {
    apply(editing?.mode === 'edit' ? updateEvent(diagram, editing.id, fields) : { ...diagram, nodes: [...diagram.nodes, addEvent(diagram.nodes, fields)] });
    setEditing(null);
  };
  const connect = (connection: Connection) => setEdges((current) => addEdge({ ...connection, id: `edge-${connection.source}-${connection.target}`, animated: true }, current));
  const selectedNode = diagram.nodes.find((node) => node.id === selected);
  return (
    <div className="space-y-3" data-testid="event-diagram">
      <ToolConflict conflict={session.conflict} keptText={session.keptText} reloading={session.reloading} onReload={() => void session.reload()} onDismissKept={session.dismissKept} />
      {!readOnly && (
        <DiagramToolbar
          eventCount={diagram.nodes.length}
          selected={selectedNode}
          onAdd={() => setEditing({ mode: 'add' })}
          onConnect={() => setEditing({ mode: 'connect' })}
          onEdit={(id) => setEditing({ mode: 'edit', id })}
          onDelete={(id) => {
            apply(removeEvent(diagram, id));
            setSelected(null);
          }}
        />
      )}
      <div className="h-[min(520px,70vh)] min-h-[320px] rounded border" role="region" aria-label="Event diagram canvas: drag events to arrange them; the list below has every connection">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={readOnly ? undefined : onNodesChange}
          onEdgesChange={readOnly ? undefined : onEdgesChange}
          onConnect={readOnly ? undefined : connect}
          onSelectionChange={({ nodes: chosen }) => setSelected(chosen[0]?.id ?? null)}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          fitView
          fitViewOptions={{ maxZoom: 1 }}
        >
          <MiniMap pannable zoomable />
          <Controls />
          <Background gap={16} size={1} />
        </ReactFlow>
      </div>
      <Connections diagram={diagram} readOnly={readOnly} onRemove={(id) => setEdges((current) => current.filter((edge) => edge.id !== id))} />
      <SaveBar onSave={session.save} disabled={!dirty} label="Save diagram" dirty={dirty} />
      {editing?.mode === 'connect' && (
        <ConnectionDialog
          diagram={diagram}
          onAdd={(source, target) => {
            apply(addConnection(diagram, source, target));
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {editing && editing.mode !== 'connect' && (
        <EventDialog
          title={editing.mode === 'edit' ? 'Edit event' : 'Add event'}
          initial={editing.mode === 'edit' ? diagram.nodes.find((node) => node.id === editing.id) : undefined}
          onSave={saveEvent}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
