import { useCalendarVersions } from '@/api/v2/queries/calendars';
import { flattenPages } from '@/api/v2/queries/use-v2-list';

/** Shift labels of the published calendars (the names periods carry), each once, sorted. */
export function useShiftOptions(): Array<{ value: string; label: string }> {
  const versions = flattenPages(useCalendarVersions({}).data?.pages);
  const names = new Set(versions.filter((v) => v.state === 'published').flatMap((v) => v.shiftTemplates.map((shift) => shift.name)));
  return [...names].map((name) => ({ value: name, label: name })).sort((a, b) => a.label.localeCompare(b.label));
}
