import type { Edge, Node } from 'reactflow';
import type { RcaDiagramEdge, RcaDiagramNode, RcaEventDiagram } from '@/api/v2/types/rca';
import { newItemId } from '../../../../model/rca-form';
import type { EventFields } from './event-dialog';

export type EventNodeData = Omit<RcaDiagramNode, 'id' | 'position'>;

export const toFlowNodes = (nodes: readonly RcaDiagramNode[]): Node<EventNodeData>[] =>
  nodes.map(({ id, position, ...data }) => ({ id, position, data, type: 'rcaEvent' }));

export const toFlowEdges = (edges: readonly RcaDiagramEdge[]): Edge[] => edges.map((edge) => ({ ...edge, animated: true }));

/** The stored diagram from the canvas state (positions as dragged; only the declared fields). */
export function fromFlow(nodes: readonly Node<EventNodeData>[], edges: readonly Edge[]): RcaEventDiagram {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      label: node.data.label,
      type: node.data.type,
      timestamp: node.data.timestamp,
      description: node.data.description,
      asset: node.data.asset,
      severity: node.data.severity,
      position: { x: Math.round(node.position.x), y: Math.round(node.position.y) },
    })),
    edges: edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
  };
}

/** A new event placed below the others. */
export function addEvent(nodes: readonly RcaDiagramNode[], fields: EventFields): RcaDiagramNode {
  const lowest = nodes.reduce((max, node) => Math.max(max, node.position.y), 0);
  return { id: newItemId('event', nodes), ...fields, position: { x: 100, y: nodes.length ? lowest + 140 : 100 } };
}

/** The diagram with one event's fields replaced (position kept). */
export const updateEvent = (diagram: RcaEventDiagram, id: string, fields: EventFields): RcaEventDiagram => ({
  ...diagram,
  nodes: diagram.nodes.map((node) => (node.id === id ? { ...node, ...fields } : node)),
});

/** The diagram without an event and its connections. */
export const removeEvent = (diagram: RcaEventDiagram, id: string): RcaEventDiagram => ({
  nodes: diagram.nodes.filter((node) => node.id !== id),
  edges: diagram.edges.filter((edge) => edge.source !== id && edge.target !== id),
});

/** True when a cause → effect connection between two different events is not drawn yet. */
export const canConnect = (diagram: RcaEventDiagram, source: string, target: string): boolean =>
  source !== '' && target !== '' && source !== target && !diagram.edges.some((edge) => edge.source === source && edge.target === target);

/** The diagram with one more connection (same id scheme as a dragged connection); unchanged when not allowed. */
export function addConnection(diagram: RcaEventDiagram, source: string, target: string): RcaEventDiagram {
  if (!canConnect(diagram, source, target)) return diagram;
  return { ...diagram, edges: [...diagram.edges, { id: `edge-${source}-${target}`, source, target }] };
}

/** The diagram in words, one line per event and connection (kept on screen after a concurrent save). */
export function diagramText(diagram: RcaEventDiagram): string {
  const label = (id: string) => diagram.nodes.find((node) => node.id === id)?.label ?? 'Removed event';
  const events = diagram.nodes.map((node) => {
    const facts = [node.type, node.timestamp, node.asset, node.severity].filter(Boolean).join(', ');
    return `Event: ${node.label}${facts ? ` (${facts})` : ''}${node.description ? ` — ${node.description}` : ''}`;
  });
  const connections = diagram.edges.map((edge) => `Connection: ${label(edge.source)} → ${label(edge.target)}`);
  return [...events, ...connections].join('\n');
}

/** QA L6 / N2: the how-to-connect hint only where connecting is possible (not on a closed, read-only case). */
export const noConnectionsText = (readOnly: boolean): string =>
  readOnly ? 'No connections recorded.' : `No connections yet: use "Add connection", or drag from an event's bottom handle to another event.`;
