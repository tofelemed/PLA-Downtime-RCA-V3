import { plantToday } from '@/lib/dates/zoned-time';
import { plantDayOf } from './plant-day';

/**
 * True when a due day (stored as the instant the plant day starts, or a bare `YYYY-MM-DD`) lies before
 * today in the plant calendar. A display comparison of the server's date with now; nothing is decided by it.
 */
export function isPastPlantDay(due: string | null | undefined, timeZone: string, now: Date = new Date()): boolean {
  const day = plantDayOf(due, timeZone);
  return day !== '' && day < plantToday(timeZone, now);
}

const FINISHED_ACTION = new Set(['done', 'cancelled']);

/** An action past its due day that is neither done nor cancelled. */
export function isActionOverdue(action: { dueDate: string | null; status: string }, timeZone: string, now?: Date): boolean {
  return !FINISHED_ACTION.has(action.status) && isPastPlantDay(action.dueDate, timeZone, now);
}

/** An evidence collection task past its due day and not completed. */
export function isEvidenceTaskOverdue(item: { taskDueDate: string | null; taskStatus: string | null }, timeZone: string, now?: Date): boolean {
  return item.taskStatus !== 'completed' && isPastPlantDay(item.taskDueDate, timeZone, now);
}
