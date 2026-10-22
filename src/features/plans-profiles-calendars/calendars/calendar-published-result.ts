import type { CalendarPublishView } from '@/api/v2/types/calendars';
import type { SaveLink, SaveResult } from '@/features/ux-kit/save-result';

export interface CalendarPublishedInput {
  result: CalendarPublishView;
  /** "Site calendar" / "Unit override · Extruder 1" */
  scopeLabel: string;
  /** the plant's number format for counts */
  count: (value: number) => string;
  /** a unit's name, for a site calendar that generated the shifts of several units */
  unitName: (id: string) => string;
  next: SaveLink | null;
}

const shiftsText = (shifts: number, count: (value: number) => string) => `${count(shifts)} ${shifts === 1 ? 'shift' : 'shifts'} generated`;

/**
 * "Published: 42 shifts generated" from the server's materialization, per unit the calendar covers (named
 * when there are several; the counts are the server's, never added up here).
 */
function publishedShiftsText({ result, count, unitName }: Pick<CalendarPublishedInput, 'result' | 'count' | 'unitName'>): string {
  const units = result.materialization;
  if (units.length === 0) return 'Published: no unit shifts generated.';
  if (units.length === 1) return `Published: ${shiftsText(units[0].insertedInstances, count)}.`;
  return `Published: ${units.map((unit) => `${unitName(unit.unitId)} ${shiftsText(unit.insertedInstances, count)}`).join(' · ')}.`;
}

/** The result dialog of a publish: what was generated · Back to calendars · Next: <setup page>. */
export function calendarPublishedResult(input: CalendarPublishedInput): SaveResult {
  const { result, scopeLabel, next } = input;
  return {
    title: 'Calendar published',
    recordLabel: `Calendar version ${result.version.version} · ${scopeLabel}`,
    message: publishedShiftsText(input),
    listPath: '/setup/calendars',
    listLabel: 'calendars',
    next,
  };
}
