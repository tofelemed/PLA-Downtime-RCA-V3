import type { CalendarVersionView } from '@/api/v2/types/calendars';

/**
 * Where a stored calendar version opens: a draft the user may edit on `/planning/calendars/:id/edit`,
 * anything else (published, or a reader without calendar rights) on the read-only `/planning/calendars/:id`.
 */
export function calendarVersionPath(version: Pick<CalendarVersionView, 'id' | 'state'>, canWriteCalendars: boolean): string {
  const editable = version.state === 'draft' && canWriteCalendars;
  return `/planning/calendars/${version.id}${editable ? '/edit' : ''}`;
}
