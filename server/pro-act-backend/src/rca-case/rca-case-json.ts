/**
 * Nested content of an RCA case (plan 3.9 step 1): recommendations, evidence items and the logic tree.
 * v1 stored them as JSON text in `rcas`; v2 keeps the same columns and reads both shapes, picking only
 * the known fields (never inventing values: a missing field stays null).
 */
export interface RcaRecommendationItem {
  id: string;
  title: string;
  description: string | null;
  priority: string | null;
  ownerId: string | null;
  dueDate: string | null;
  status: string | null;
}

export interface RcaEvidenceItem {
  id: string;
  title: string;
  description: string | null;
  type: string | null;
  source: string | null;
  collectedAt: string | null;
  collectedBy: string | null;
}

export interface RcaLogicNode {
  id: string;
  parentId: string | null;
  label: string;
  kind: string | null;
  status: string | null;
  notes: string | null;
}

type Raw = Record<string, unknown>;

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0
    ? value
    : typeof value === 'number'
      ? String(value)
      : null;

function parseArray(stored: unknown): Raw[] {
  let value = stored;
  if (typeof stored === 'string') {
    try {
      value = JSON.parse(stored) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is Raw =>
      typeof entry === 'object' && entry !== null && !Array.isArray(entry),
  );
}

export function readRecommendations(stored: unknown): RcaRecommendationItem[] {
  return parseArray(stored).map((raw, index) => ({
    id: text(raw.id) ?? `rec-${index + 1}`,
    title: text(raw.title) ?? '',
    description: text(raw.description),
    priority: text(raw.priority),
    ownerId: text(raw.ownerId) ?? text(raw.assigneeId),
    dueDate: text(raw.dueDate),
    status: text(raw.status),
  }));
}

export function readEvidence(stored: unknown): RcaEvidenceItem[] {
  return parseArray(stored).map((raw, index) => ({
    id: text(raw.id) ?? `ev-${index + 1}`,
    title: text(raw.title) ?? '',
    description: text(raw.description),
    type: text(raw.type),
    source: text(raw.source),
    collectedAt: text(raw.collectedAt),
    collectedBy: text(raw.collectedBy),
  }));
}

export function readLogicTree(stored: unknown): RcaLogicNode[] {
  return parseArray(stored).map((raw, index) => ({
    id: text(raw.id) ?? `node-${index + 1}`,
    parentId: text(raw.parentId),
    label: text(raw.label) ?? text(raw.title) ?? text(raw.description) ?? '',
    kind: text(raw.kind) ?? text(raw.type),
    status: text(raw.status),
    notes: text(raw.notes),
  }));
}

export function readIds(stored: unknown): string[] {
  if (Array.isArray(stored))
    return stored.filter((id): id is string => typeof id === 'string');
  if (typeof stored !== 'string') return [];
  try {
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

/** Items without undefined members, as stored JSON text. */
export function writeJson(
  items: readonly unknown[] | undefined,
): string | undefined {
  return items === undefined ? undefined : JSON.stringify(items);
}
