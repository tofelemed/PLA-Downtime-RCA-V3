import { PiSignalScope } from './pi-signal-scope';

/** A window being paged: its end and, per signal still reading, where its next page starts. */
export interface PiSignalWindow {
  end: string;
  progress: Record<string, string>;
}

/**
 * Committed cursor of a `recorded` / `backfill` job (PI04 for samples). `checkpoints[signalId]` = end of
 * the last window whose values of that signal were all accepted; `window` = the window being paged.
 */
export interface PiSignalCursor {
  checkpoints: Record<string, string>;
  window: PiSignalWindow | null;
}

/** What one streamsets page returned for one signal. */
export interface StreamPage {
  signalId: string;
  count: number;
  lastTimestamp: string | null;
}

const MINUTE = 60_000;

export function parseSignalCursor(
  raw: Readonly<Record<string, unknown>> | null,
): PiSignalCursor {
  const checkpoints = stringMap(raw?.checkpoints);
  const window = raw?.window as Record<string, unknown> | null | undefined;
  if (!window || typeof window.end !== 'string')
    return { checkpoints, window: null };
  return {
    checkpoints,
    window: { end: window.end, progress: stringMap(window.progress) },
  };
}

/**
 * The window to read now: the one in progress, else a new one. `recorded`: per signal from its
 * checkpoint minus the overlap (first run: the lookback) to now. `backfill`: `[from, to)` for the
 * signals not yet past `to`. Null when there is nothing to read.
 */
export function openSignalWindow(
  cursor: PiSignalCursor,
  scope: PiSignalScope,
  input: { signalIds: string[]; now: Date },
): PiSignalWindow | null {
  if (cursor.window) return cursor.window;
  const now = input.now.getTime();
  const end = scope.mode === 'backfill' ? Date.parse(scope.to as string) : now;
  const progress: Record<string, string> = {};
  for (const id of input.signalIds) {
    const start = windowStart(cursor.checkpoints[id], scope, now);
    if (start < end) progress[id] = new Date(start).toISOString();
  }
  if (Object.keys(progress).length === 0) return null;
  return { end: new Date(end).toISOString(), progress };
}

function windowStart(
  checkpoint: string | undefined,
  scope: PiSignalScope,
  now: number,
): number {
  if (scope.mode === 'backfill') {
    return checkpoint
      ? Date.parse(checkpoint)
      : Date.parse(scope.from as string);
  }
  if (!checkpoint) return now - scope.lookbackMinutes * MINUTE;
  return Date.parse(checkpoint) - scope.overlapMinutes * MINUTE;
}

/** Earliest page start among the signals still reading (one `startTime` for the streamset call). */
export function pageStart(window: PiSignalWindow): string {
  return Object.values(window.progress).sort()[0];
}

/**
 * The cursor after a fully accepted page: a signal whose page was full continues at its last
 * timestamp (re-read values there are duplicates; progress never moves back, since the shared start
 * time can return values before a signal's own progress); a short page completes it. When every
 * signal is complete, their checkpoints move to the window end.
 */
export function advanceSignalWindow(
  cursor: PiSignalCursor,
  window: PiSignalWindow,
  input: { pages: StreamPage[]; pageSize: number },
): { cursor: PiSignalCursor; complete: boolean } {
  const progress = { ...window.progress };
  for (const page of input.pages) {
    if (page.count >= input.pageSize && page.lastTimestamp) {
      const current = progress[page.signalId];
      progress[page.signalId] =
        current && current > page.lastTimestamp ? current : page.lastTimestamp;
    } else {
      delete progress[page.signalId];
    }
  }
  if (Object.keys(progress).length > 0) {
    return {
      cursor: { ...cursor, window: { ...window, progress } },
      complete: false,
    };
  }
  const checkpoints = { ...cursor.checkpoints };
  for (const id of Object.keys(window.progress)) checkpoints[id] = window.end;
  return { cursor: { checkpoints, window: null }, complete: true };
}

function stringMap(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}
