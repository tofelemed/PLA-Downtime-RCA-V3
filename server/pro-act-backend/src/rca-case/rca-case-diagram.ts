import { parseArray, parseObject, Raw, text } from './rca-json-read';

export interface RcaDiagramNode {
  id: string;
  label: string;
  type: string | null;
  timestamp: string | null;
  description: string | null;
  asset: string | null;
  severity: string | null;
  position: { x: number; y: number };
}

export interface RcaDiagramEdge {
  id: string;
  source: string;
  target: string;
}

/** The case's event diagram: events (also the event timeline) and their cause / effect connections. */
export interface RcaEventDiagram {
  nodes: RcaDiagramNode[];
  edges: RcaDiagramEdge[];
}

const coordinate = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** v2 nodes carry their fields at the top level; v1 (reactflow) nodes kept them under `data`. */
function readNode(raw: Raw, index: number): RcaDiagramNode {
  const data = parseObject(raw.data) ?? raw;
  const position = parseObject(raw.position) ?? {};
  return {
    id: text(raw.id) ?? `event-${index + 1}`,
    label: text(data.label) ?? '',
    type: text(data.type),
    timestamp: text(data.timestamp),
    description: text(data.description),
    asset: text(data.asset),
    severity: text(data.severity),
    position: {
      x: coordinate(position.x, 100 + index * 40),
      y: coordinate(position.y, 100 + index * 40),
    },
  };
}

export function readEventDiagram(stored: unknown): RcaEventDiagram {
  const diagram = parseObject(stored);
  if (!diagram) return { nodes: [], edges: [] };
  const nodes = parseArray(diagram.nodes).map(readNode);
  const known = new Set(nodes.map((node) => node.id));
  const edges = parseArray(diagram.edges)
    .map((raw, index) => ({
      id: text(raw.id) ?? `edge-${index + 1}`,
      source: text(raw.source) ?? '',
      target: text(raw.target) ?? '',
    }))
    .filter((edge) => known.has(edge.source) && known.has(edge.target));
  return { nodes, edges };
}

/** The validated body diagram as stored JSON text (undefined = untouched, null = cleared). */
export function writeDiagram(
  diagram:
    | { nodes: readonly object[]; edges: readonly object[] }
    | null
    | undefined,
): string | null | undefined {
  if (diagram === undefined) return undefined;
  return diagram === null ? null : JSON.stringify(diagram);
}
