import {
  advanceSignalWindow,
  openSignalWindow,
  pageStart,
  parseSignalCursor,
  PiSignalWindow,
} from './pi-signal-cursor';
import { parsePiSignalScope } from './pi-signal-scope';

const now = new Date('2026-10-08T10:00:00.000Z');
const recorded = parsePiSignalScope({ mode: 'recorded' });
const SIGNAL = '6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b';

describe('PI signal cursor (plan 1.7 step 3)', () => {
  it('first window: lookback; later windows: checkpoint minus overlap, per signal', () => {
    const cursor = parseSignalCursor({
      checkpoints: { b: '2026-10-08T09:50:00.000Z' },
    });
    const window = openSignalWindow(cursor, recorded, {
      signalIds: ['a', 'b'],
      now,
    }) as PiSignalWindow;

    expect(window).toEqual({
      end: now.toISOString(),
      progress: {
        a: '2026-10-08T09:00:00.000Z',
        b: '2026-10-08T09:35:00.000Z',
      },
    });
    expect(pageStart(window)).toBe('2026-10-08T09:00:00.000Z');
  });

  it('a full page continues at its last timestamp (never backwards); short pages complete the window', () => {
    const cursor = parseSignalCursor(null);
    const window: PiSignalWindow = {
      end: now.toISOString(),
      progress: {
        a: '2026-10-08T09:00:00.000Z',
        b: '2026-10-08T09:40:00.000Z',
      },
    };

    const partial = advanceSignalWindow(cursor, window, {
      pageSize: 2,
      pages: [
        { signalId: 'a', count: 2, lastTimestamp: '2026-10-08T09:10:00.000Z' },
        { signalId: 'b', count: 2, lastTimestamp: '2026-10-08T09:05:00.000Z' },
      ],
    });
    expect(partial.complete).toBe(false);
    expect(partial.cursor.window?.progress).toEqual({
      a: '2026-10-08T09:10:00.000Z',
      b: '2026-10-08T09:40:00.000Z',
    });

    const done = advanceSignalWindow(
      partial.cursor,
      partial.cursor.window as PiSignalWindow,
      {
        pageSize: 2,
        pages: [
          { signalId: 'a', count: 1, lastTimestamp: null },
          { signalId: 'b', count: 0, lastTimestamp: null },
        ],
      },
    );
    expect(done).toEqual({
      complete: true,
      cursor: {
        checkpoints: { a: now.toISOString(), b: now.toISOString() },
        window: null,
      },
    });
  });

  it('backfill reads [from, to) once; nothing is left after its checkpoint reaches to', () => {
    const scope = parsePiSignalScope({
      mode: 'backfill',
      signalIds: [SIGNAL],
      from: '2026-10-01T00:00:00Z',
      to: '2026-10-02T00:00:00Z',
    });
    expect(
      openSignalWindow(parseSignalCursor(null), scope, {
        signalIds: [SIGNAL],
        now,
      }),
    ).toEqual({
      end: '2026-10-02T00:00:00.000Z',
      progress: { [SIGNAL]: '2026-10-01T00:00:00.000Z' },
    });
    const finished = parseSignalCursor({
      checkpoints: { [SIGNAL]: '2026-10-02T00:00:00.000Z' },
    });
    expect(
      openSignalWindow(finished, scope, { signalIds: [SIGNAL], now }),
    ).toBeNull();
  });

  it('rejects scopes that could never run (non-retryable)', () => {
    expect(() => parsePiSignalScope({ mode: 'summary' })).toThrow(
      /totalTimebase/,
    );
    expect(() =>
      parsePiSignalScope({ mode: 'backfill', signalIds: [] }),
    ).toThrow(/backfill needs/);
    expect(() =>
      parsePiSignalScope({ mode: 'recorded', signalIds: ['x'] }),
    ).toThrow(/UUIDs/);
  });
});
