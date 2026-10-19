import type { ActivityCountView } from '@/api/v2/types/activity-summary';

export interface LabelledCount {
  label: string;
  count: number;
}

/**
 * Counts by the words people read (QA_SHELL: "User" listed twice for the stored keys `User` and `USER`):
 * keys that read the same are one row, their counts added; largest first, then by label.
 */
export function labelledCounts(rows: readonly ActivityCountView[], labelOf: (key: string) => string): LabelledCount[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const label = labelOf(row.key);
    totals.set(label, (totals.get(label) ?? 0) + row.count);
  }
  return [...totals].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
