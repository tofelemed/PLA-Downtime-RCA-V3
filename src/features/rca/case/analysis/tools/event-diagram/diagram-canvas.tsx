import ReactFlow, { Background, Controls, MiniMap, type Connection, type Edge, type Node, type OnEdgesChange, type OnNodesChange } from 'reactflow';
import 'reactflow/dist/style.css';
import { Badge } from '@/components/ui/badge';
import type { EventNodeData } from './diagram-model';
import { EventNode } from './event-node';

/** Defined once outside the component (reactflow warns when node types change between renders). */
const NODE_TYPES = { rcaEvent: EventNode };

const canvasLabel = (readOnly: boolean) =>
  readOnly ? 'Event diagram canvas (read-only); the list below has every connection' : 'Event diagram canvas: drag events to arrange them; the list below has every connection';

/** What the badge colours on the events mean (the severity word is always on the badge too). */
export function SeverityLegend() {
  return (
    <span className="inline-flex items-center gap-1.5" data-testid="diagram-legend">
      <Badge variant="destructive" className="px-1.5 py-0 text-[11px]">
        High
      </Badge>
      High or critical severity
      <Badge variant="outline" className="ml-2 px-1.5 py-0 text-[11px]">
        Low
      </Badge>
      Other severities
    </span>
  );
}

export interface DiagramCanvasProps {
  nodes: Node<EventNodeData>[];
  edges: Edge[];
  readOnly: boolean;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
  onSelect: (id: string | null) => void;
}

/** The React Flow canvas of the event diagram: draggable and connectable only on an editable case. */
export function DiagramCanvas({ nodes, edges, readOnly, onNodesChange, onEdgesChange, onConnect, onSelect }: DiagramCanvasProps) {
  return (
    <div className="h-[min(520px,70vh)] min-h-[320px] rounded border bg-muted/20" role="region" aria-label={canvasLabel(readOnly)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={readOnly ? undefined : onNodesChange}
        onEdgesChange={readOnly ? undefined : onEdgesChange}
        onConnect={readOnly ? undefined : onConnect}
        onSelectionChange={({ nodes: chosen }) => onSelect(chosen[0]?.id ?? null)}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        fitView
        fitViewOptions={{ maxZoom: 1 }}
      >
        <MiniMap pannable zoomable />
        <Controls showInteractive={!readOnly} />
        <Background gap={16} size={1} />
      </ReactFlow>
    </div>
  );
}
