import { useState } from 'react';
import ReactFlow, { addEdge, Background, Controls, MiniMap, useEdgesState, useNodesState, type Connection } from 'reactflow';
import 'reactflow/dist/style.css';
import type { RcaEventDiagram } from '@/api/v2/types/rca';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { IconButton } from '@/features/ux-kit/icon-button';
import { ActionIcon } from '@/lib/icons';
import { useCaseWorkspace } from '../../../case-context';
import { useCasePatch } from '../../../use-case-patch';
import { SaveBar } from '../tool-record';
import { addEvent, fromFlow, removeEvent, toFlowEdges, toFlowNodes, updateEvent, type EventNodeData } from './diagram-model';
import { EventDialog, type EventFields } from './event-dialog';
import { EventNode } from './event-node';

/** Defined once outside the component (reactflow warns when node types change between renders). */
const NODE_TYPES = { rcaEvent: EventNode };

type Editing = { mode: 'add' } | { mode: 'edit'; id: string } | null;

function Connections({ diagram, readOnly, onRemove }: { diagram: RcaEventDiagram; readOnly: boolean; onRemove: (id: string) => void }) {
  const label = (id: string) => diagram.nodes.find((node) => node.id === id)?.label ?? 'Removed event';
  if (diagram.edges.length === 0) return <p className="text-sm text-muted-foreground">No connections yet: drag from an event's bottom handle to another event.</p>;
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

/** Event diagram: events before the failure on a canvas, connected cause → effect; saved with the case. */
export function EventDiagramTool() {
  const { rca, readOnly } = useCaseWorkspace();
  const patch = useCasePatch();
  const [nodes, setNodes, onNodesChange] = useNodesState<EventNodeData>(toFlowNodes(rca.eventDiagram.nodes));
  const [edges, setEdges, onEdgesChange] = useEdgesState(toFlowEdges(rca.eventDiagram.edges));
  const [editing, setEditing] = useState<Editing>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const diagram = fromFlow(nodes, edges);
  const dirty = JSON.stringify(diagram) !== JSON.stringify(rca.eventDiagram);
  const apply = (next: RcaEventDiagram) => {
    setNodes(toFlowNodes(next.nodes));
    setEdges(toFlowEdges(next.edges));
  };
  const saveEvent = (fields: EventFields) => {
    apply(editing?.mode === 'edit' ? updateEvent(diagram, editing.id, fields) : { ...diagram, nodes: [...diagram.nodes, addEvent(diagram.nodes, fields)] });
    setEditing(null);
  };
  const connect = (connection: Connection) => setEdges((current) => addEdge({ ...connection, id: `edge-${connection.source}-${connection.target}`, animated: true }, current));
  const selectedNode = diagram.nodes.find((node) => node.id === selected);
  return (
    <div className="space-y-3" data-testid="event-diagram">
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setEditing({ mode: 'add' })} data-testid="add-event">
            Add event
          </Button>
          <Button size="sm" variant="outline" disabled={!selectedNode} onClick={() => selectedNode && setEditing({ mode: 'edit', id: selectedNode.id })}>
            Edit selected event
          </Button>
          <ConfirmDialog
            trigger={<Button size="sm" variant="outline" disabled={!selectedNode}>Delete selected event</Button>}
            title={`Delete "${selectedNode?.label ?? ''}"?`}
            description="The event and its connections are removed from the diagram when you save it."
            confirmLabel="Delete event"
            destructive
            onConfirm={() => {
              if (selectedNode) apply(removeEvent(diagram, selectedNode.id));
              setSelected(null);
            }}
          />
          {dirty && <span className="text-sm text-muted-foreground">Unsaved changes.</span>}
        </div>
      )}
      <div className="h-[520px] rounded border" aria-label="Event diagram canvas">
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
      <SaveBar onSave={() => patch.save({ eventDiagram: diagram })} disabled={!dirty} label="Save diagram" />
      {editing && (
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
