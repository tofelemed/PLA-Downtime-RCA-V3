export interface FaultTreeNode {
  id: string;
  /** AND | OR (gates), Event (intermediate), BasicEvent (leaf with a probability) */
  type: string;
  parentId: string | null;
  probability: number | null;
}

export type FaultTreeReason =
  | 'no_single_top_event'
  | 'not_a_tree'
  | 'gate_without_inputs'
  | 'ambiguous_event'
  | 'probability_missing';

export interface TopEventResult {
  /** probability of the top event, null when it cannot be computed */
  probability: number | null;
  reason: FaultTreeReason | null;
}

class NotComputable extends Error {
  constructor(readonly reason: FaultTreeReason) {
    super(reason);
  }
}

function probabilityOf(
  node: FaultTreeNode,
  children: ReadonlyMap<string, FaultTreeNode[]>,
): number {
  const inputs = children.get(node.id) ?? [];
  if (node.type === 'BasicEvent' || (node.type === 'Event' && !inputs.length)) {
    if (node.probability === null)
      throw new NotComputable('probability_missing');
    return node.probability;
  }
  if (!inputs.length) throw new NotComputable('gate_without_inputs');
  const values = inputs.map((input) => probabilityOf(input, children));
  if (node.type === 'AND') return values.reduce((p, v) => p * v, 1);
  if (node.type === 'OR') return 1 - values.reduce((p, v) => p * (1 - v), 1);
  if (values.length === 1) return values[0];
  throw new NotComputable('ambiguous_event');
}

function reachesAll(
  root: FaultTreeNode,
  nodes: readonly FaultTreeNode[],
  children: ReadonlyMap<string, FaultTreeNode[]>,
): boolean {
  const seen = new Set<string>();
  const stack = [root];
  while (stack.length) {
    const next = stack.pop() as FaultTreeNode;
    if (seen.has(next.id)) return false;
    seen.add(next.id);
    stack.push(...(children.get(next.id) ?? []));
  }
  return seen.size === nodes.length;
}

/**
 * RCA-06: probability of a fault tree's top event, assuming independent basic events — AND = Π p,
 * OR = 1 − Π(1 − p), an intermediate event takes its single input. Null with a reason when the tree is
 * not a single connected tree or a basic event has no probability (never estimated).
 */
export function topEventProbability(
  nodes: readonly FaultTreeNode[],
): TopEventResult {
  const roots = nodes.filter((n) => n.parentId === null);
  if (roots.length !== 1)
    return { probability: null, reason: 'no_single_top_event' };
  const children = new Map<string, FaultTreeNode[]>();
  for (const n of nodes) {
    if (n.parentId === null) continue;
    children.set(n.parentId, [...(children.get(n.parentId) ?? []), n]);
  }
  if (!reachesAll(roots[0], nodes, children))
    return { probability: null, reason: 'not_a_tree' };
  try {
    return { probability: probabilityOf(roots[0], children), reason: null };
  } catch (error: unknown) {
    if (error instanceof NotComputable)
      return { probability: null, reason: error.reason };
    throw error;
  }
}
