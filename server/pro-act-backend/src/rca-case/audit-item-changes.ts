/** One item of a list field (evidence, recommendations) that a command added, removed or edited. */
export interface AuditItemChange {
  /** the item's title as saved (shortened), never its id */
  item: string;
  change: 'added' | 'removed' | 'edited';
  /** the item's fields that differ (edited items only) */
  fields: string[];
}

type Item = Record<string, unknown> & { id: string };

const MAX_ITEMS = 20;
const MAX_TITLE = 120;
/** Bookkeeping of an item: never reported as an edit. */
const IGNORED = new Set([
  'id',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
]);

const parse = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
};

const isItem = (value: unknown): value is Item =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  typeof (value as Record<string, unknown>).id === 'string';

/** The stored list as items with ids; null when the field is not such a list. */
function itemsOf(value: unknown): Item[] | null {
  const parsed = parse(value);
  if (parsed === null || parsed === undefined) return [];
  if (!Array.isArray(parsed) || !parsed.every(isItem)) return null;
  return parsed;
}

function titleOf(item: Item): string {
  const title = [item.title, item.name, item.label].find(
    (value): value is string =>
      typeof value === 'string' && value.trim() !== '',
  );
  const text = title?.trim() ?? 'Untitled item';
  return text.length > MAX_TITLE ? `${text.slice(0, MAX_TITLE - 1)}…` : text;
}

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function editedFields(before: Item, after: Item): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys]
    .filter((key) => !IGNORED.has(key) && !same(before[key], after[key]))
    .sort();
}

/**
 * QA L8: which items of a list field changed ("Changed: Evidence" names the evidence item and its fields).
 * Only titles and field names are kept — the content stays in its row, as for every History entry. At most
 * 20 items; null when the field is not a list of items with ids or nothing item-level changed.
 */
export function itemChanges(
  before: unknown,
  after: unknown,
): AuditItemChange[] | null {
  const from = itemsOf(before);
  const to = itemsOf(after);
  if (!from || !to) return null;
  const old = new Map(from.map((item) => [item.id, item]));
  const now = new Set(to.map((item) => item.id));
  const changes: AuditItemChange[] = [];
  for (const item of to) {
    const prior = old.get(item.id);
    if (!prior)
      changes.push({ item: titleOf(item), change: 'added', fields: [] });
    else {
      const fields = editedFields(prior, item);
      if (fields.length > 0)
        changes.push({ item: titleOf(item), change: 'edited', fields });
    }
  }
  for (const item of from)
    if (!now.has(item.id))
      changes.push({ item: titleOf(item), change: 'removed', fields: [] });
  return changes.length > 0 ? changes.slice(0, MAX_ITEMS) : null;
}

/** Item-level changes of the list fields among `fields` (`detail.itemChanges`), undefined when none. */
export function itemChangesOf(
  fields: readonly string[],
  before: Readonly<Record<string, unknown>>,
  after: Readonly<Record<string, unknown>>,
): Record<string, AuditItemChange[]> | undefined {
  const entries = fields.flatMap((field) => {
    const changes = itemChanges(before[field], after[field]);
    return changes ? [[field, changes] as const] : [];
  });
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}
