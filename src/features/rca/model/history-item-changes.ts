import type { RcaHistoryEntryView } from '@/api/v2/types/rca-history';
import { labelOf } from '@/features/ux-kit/labels';

/** One item of a list field the server recorded as added, removed or edited (`detail.itemChanges`). */
export interface HistoryItemChange {
  item: string;
  change: 'added' | 'removed' | 'edited';
  fields: string[];
}

/** Fields of an evidence item or a recommendation in the words of their forms (QA L8). */
const ITEM_FIELD_LABELS: Readonly<Record<string, string>> = {
  title: 'title',
  description: 'description',
  type: 'type',
  source: 'source',
  collectedAt: 'collected',
  collectedBy: 'collected by',
  category: 'category',
  location: 'location',
  occurredAt: 'observed time',
  assetId: 'asset',
  severity: 'severity',
  tags: 'tags',
  verified: 'verified',
  verifiedBy: 'verified by',
  verifiedAt: 'verified at',
  fiveP: '5P',
  task: 'request',
  taskDueDate: 'request due',
  taskStatus: 'request status',
  taskAssigneeId: 'requested from',
  nodeIds: 'logic-tree nodes',
  series: 'time series',
  attachments: 'files',
  priority: 'priority',
  ownerId: 'owner',
  dueDate: 'due date',
  status: 'status',
  estimatedCost: 'estimated cost',
};

/** List fields whose History entries name the items (older entries recorded only the field). */
const ITEM_LIST_FIELDS = new Set(['evidence', 'recommendations']);

const isChange = (value: unknown): value is HistoryItemChange => {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.item === 'string' && ['added', 'removed', 'edited'].includes(String(record.change)) && Array.isArray(record.fields);
};

/** The recorded item changes of one field of an entry; undefined when the entry recorded none. */
export function itemChangesOf(entry: Pick<RcaHistoryEntryView, 'detail'>, field: string): HistoryItemChange[] | undefined {
  const all = entry.detail.itemChanges;
  if (typeof all !== 'object' || all === null) return undefined;
  const list = (all as Record<string, unknown>)[field];
  return Array.isArray(list) ? list.filter(isChange) : undefined;
}

function changeText(change: HistoryItemChange): string {
  const fields = change.fields.map((field) => labelOf(ITEM_FIELD_LABELS, field));
  const what = change.change === 'edited' && fields.length > 0 ? `edited (${fields.join(', ')})` : change.change;
  return `“${change.item}” ${what}`;
}

/**
 * What changed in a list field, in words (QA L8): `Evidence: “Oil sample” edited (status, observed time)`;
 * an entry recorded before items were named says so instead of a bare "Evidence".
 */
export function fieldChangeText(entry: Pick<RcaHistoryEntryView, 'detail'>, field: string, label: string): string {
  const changes = itemChangesOf(entry, field);
  if (changes && changes.length > 0) return `${label}: ${changes.map(changeText).join('; ')}`;
  return ITEM_LIST_FIELDS.has(field) ? `${label} (which item changed was not recorded)` : label;
}
