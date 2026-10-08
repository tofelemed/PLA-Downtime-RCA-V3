import { PiJobScope } from './pi-job-scope';

/** The window being paged: bounds, the next start index and the page number inside it. */
export interface PiActiveWindow {
  start: string;
  end: string;
  startIndex: number;
  page: number;
}

/**
 * Committed cursor of a PI window job (PI04). `checkpoint` = end of the last window whose every page
 * was durably accepted; it moves only when a window completes. `window` = the window still being
 * paged (page progress is committed per page, so a failed page is retried, not the whole window).
 */
export interface PiWindowCursor {
  checkpoint: string | null;
  window: PiActiveWindow | null;
}

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Reads a stored cursor; also accepts the plan 1.5 shape `{ windowStart, windowEnd, startIndex }`. */
export function parseWindowCursor(
  raw: Readonly<Record<string, unknown>> | null,
): PiWindowCursor {
  if (!raw) return { checkpoint: null, window: null };
  if ('checkpoint' in raw || 'window' in raw) {
    return {
      checkpoint: isoOrNull(raw.checkpoint),
      window: windowOf(raw.window),
    };
  }
  const start = isoOrNull(raw.windowStart);
  const end = isoOrNull(raw.windowEnd);
  const startIndex = Number(raw.startIndex ?? 0);
  if (start && end && startIndex > 0) {
    return {
      checkpoint: start,
      window: { start, end, startIndex, page: 0 },
    };
  }
  return { checkpoint: end, window: null };
}

/**
 * The window to read now: the one in progress, else a new one ending now — `window` mode from the
 * checkpoint minus the overlap (PI05; the lookback on the first run), `rescan`/`inventory` over the
 * last N days.
 */
export function activeWindow(
  cursor: PiWindowCursor,
  scope: PiJobScope,
  now: Date,
): PiActiveWindow {
  if (cursor.window) return cursor.window;
  const end = now.getTime();
  return {
    start: new Date(windowStart(cursor, scope, end)).toISOString(),
    end: now.toISOString(),
    startIndex: 0,
    page: 0,
  };
}

function windowStart(
  cursor: PiWindowCursor,
  scope: PiJobScope,
  end: number,
): number {
  if (scope.mode === 'rescan') return end - scope.rescanDays * DAY;
  if (scope.mode === 'inventory') return end - scope.inventoryDays * DAY;
  if (!cursor.checkpoint) return end - scope.lookbackMinutes * MINUTE;
  const start = Date.parse(cursor.checkpoint) - scope.overlapMinutes * MINUTE;
  return Math.min(start, end);
}

/**
 * The cursor after a fully accepted page of `itemCount` frames: a short page completes the window
 * (checkpoint = window end); a full page moves to the next start index of the same window.
 */
export function advanceWindow(
  cursor: PiWindowCursor,
  window: PiActiveWindow,
  page: { itemCount: number; pageSize: number },
): { cursor: PiWindowCursor; complete: boolean } {
  if (page.itemCount < page.pageSize) {
    return { cursor: { checkpoint: window.end, window: null }, complete: true };
  }
  return {
    cursor: {
      checkpoint: cursor.checkpoint,
      window: {
        ...window,
        startIndex: window.startIndex + page.itemCount,
        page: window.page + 1,
      },
    },
    complete: false,
  };
}

function windowOf(value: unknown): PiActiveWindow | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const start = isoOrNull(record.start);
  const end = isoOrNull(record.end);
  if (!start || !end) return null;
  return {
    start,
    end,
    startIndex: Number(record.startIndex ?? 0),
    page: Number(record.page ?? 0),
  };
}

function isoOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}
