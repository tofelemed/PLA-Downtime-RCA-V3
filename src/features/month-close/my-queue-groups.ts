import type { QueueItemView } from '@/api/v2/types/period-sla';
import { utcToPlantLocal } from '@/lib/dates';

export type QueueGroupKey = 'overdue' | 'today' | 'later';

export interface QueueGroup {
  key: QueueGroupKey;
  title: string;
  rows: QueueItemView[];
}

const TITLES: Record<QueueGroupKey, string> = { overdue: 'Overdue', today: 'Due today', later: 'Later' };
const ORDER: readonly QueueGroupKey[] = ['overdue', 'today', 'later'];

/**
 * Display grouping of "My queue" rows, keeping the server's order inside each group: the server's
 * `overdue` verdict first, then rows due on today's plant day, then the rest (paused rows included).
 * It decides nothing: due times and overdue flags come from the server.
 */
export function groupQueueRows(rows: readonly QueueItemView[], nowIso: string, timezone: string): QueueGroup[] {
  const today = utcToPlantLocal(nowIso, timezone).slice(0, 10);
  const keyOf = (row: QueueItemView): QueueGroupKey => {
    if (row.overdue) return 'overdue';
    if (!row.onHold && utcToPlantLocal(row.dueAt, timezone).slice(0, 10) === today) return 'today';
    return 'later';
  };
  return ORDER.map((key) => ({ key, title: TITLES[key], rows: rows.filter((row) => keyOf(row) === key) })).filter((group) => group.rows.length > 0);
}
