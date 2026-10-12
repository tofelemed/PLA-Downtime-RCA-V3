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
