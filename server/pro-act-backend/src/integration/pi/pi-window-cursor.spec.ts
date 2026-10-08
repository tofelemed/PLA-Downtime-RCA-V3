import { parsePiJobScope } from './pi-job-scope';
import {
  activeWindow,
  advanceWindow,
  parseWindowCursor,
} from './pi-window-cursor';

const now = new Date('2026-10-08T12:00:00.000Z');
const scope = (extra: Record<string, unknown> = {}) =>
  parsePiJobScope({ scopeType: 'database', scopeId: 'DB1', ...extra });

/** Plan 1.6 (PI04, PI05): window checkpoints move only when a whole window is accepted. */
describe('PI window cursor', () => {
  it('starts the first window at the lookback and later windows at checkpoint minus overlap', () => {
    const first = activeWindow(parseWindowCursor(null), scope(), now);
    expect(first).toEqual({
      start: '2026-10-08T11:00:00.000Z',
      end: now.toISOString(),
      startIndex: 0,
      page: 0,
    });
    const next = activeWindow(
      { checkpoint: '2026-10-08T11:59:00.000Z', window: null },
      scope(),
      now,
    );
    expect(next.start).toBe('2026-10-08T11:44:00.000Z');
  });

  it('pages a full window without moving the checkpoint, and checkpoints on the short page (T07)', () => {
    let cursor = parseWindowCursor(null);
    const window = activeWindow(cursor, scope(), now);
    const counts = [500, 500, 201];
    const checkpoints: Array<string | null> = [];
    let current = window;
    for (const itemCount of counts) {
      const step = advanceWindow(cursor, current, { itemCount, pageSize: 500 });
      cursor = step.cursor;
      checkpoints.push(cursor.checkpoint);
      if (cursor.window) current = cursor.window;
    }
    expect(checkpoints).toEqual([null, null, window.end]);
    expect(cursor.window).toBeNull();
  });

  it('keeps the in-progress window and start index across reads', () => {
    const cursor = {
      checkpoint: null,
      window: {
        start: '2026-10-08T10:00:00.000Z',
        end: '2026-10-08T11:00:00.000Z',
        startIndex: 1000,
        page: 2,
      },
    };
    expect(activeWindow(cursor, scope(), now)).toEqual(cursor.window);
  });

  it('opens rescan and inventory windows over the last N days', () => {
    const rescan = activeWindow(
      { checkpoint: null, window: null },
      scope({ mode: 'rescan', rescanDays: 90 }),
      now,
    );
    expect(rescan.start).toBe('2026-07-10T12:00:00.000Z');
    const inventory = activeWindow(
      { checkpoint: null, window: null },
      scope({ mode: 'inventory' }),
      now,
    );
    expect(inventory.start).toBe('2026-10-01T12:00:00.000Z');
  });

  it('reads the plan 1.5 cursor shape', () => {
    expect(
      parseWindowCursor({
        windowStart: '2026-10-08T10:00:00Z',
        windowEnd: '2026-10-08T11:00:00Z',
        startIndex: 0,
      }),
    ).toEqual({ checkpoint: '2026-10-08T11:00:00.000Z', window: null });
    expect(
      parseWindowCursor({
        windowStart: '2026-10-08T10:00:00Z',
        windowEnd: '2026-10-08T11:00:00Z',
        startIndex: 500,
      }).window,
    ).toMatchObject({ startIndex: 500 });
  });

  it('rejects scopes without an AF scope or with an unknown mode; open_frames needs none', () => {
    expect(() => parsePiJobScope({ scopeType: 'database' })).toThrow(/scopeId/);
    expect(() => parsePiJobScope({ mode: 'delete-all', scopeId: 'x' })).toThrow(
      /unknown PI job mode/,
    );
    expect(parsePiJobScope({ mode: 'open_frames' }).search).toBeNull();
  });
});
