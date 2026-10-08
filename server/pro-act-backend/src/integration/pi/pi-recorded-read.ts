import { Injectable } from '@nestjs/common';
import { ReadPage, ReadRequest } from '../../intake/adapters/adapter.interface';
import { Signal } from '../../signals/entities/signal.entity';
import { SignalBackfillService } from '../../signals/signal-backfill.service';
import { PiSource } from './pi-frame-reader';
import { PiRequestError } from './pi-http-client';
import {
  advanceSignalWindow,
  openSignalWindow,
  pageStart,
  parseSignalCursor,
  PiSignalWindow,
  StreamPage,
} from './pi-signal-cursor';
import { piSampleEnvelope } from './pi-signal-envelope';
import { PiSignalScope } from './pi-signal-scope';
import { PiStreamValues, readRecorded } from './pi-streams';

/**
 * `recorded` and `backfill` reads (PI07, PI08, plan 1.7 step 3): one `streamsets/recorded` call per page
 * for every signal still reading in the active window, each value an envelope. Values before a signal's
 * own progress are dropped (the shared start time re-reads them). Progress commits per page; the
 * checkpoints move when the window completes. A backfill run turns `running` on its first page and
 * `completed` once its window is committed.
 */
@Injectable()
export class PiRecordedRead {
  constructor(private readonly backfills: SignalBackfillService) {}

  async read(
    source: PiSource,
    request: ReadRequest,
    input: { scope: PiSignalScope; signals: Signal[] },
  ): Promise<ReadPage> {
    const { scope, signals } = input;
    const cursor = parseSignalCursor(request.cursor);
    const now = new Date();
    const window = openSignalWindow(cursor, scope, {
      signalIds: signals.map((signal) => signal.id),
      now,
    });
    if (!window) return this.finished(request, scope);
    if (scope.runId) await this.backfills.advance(scope.runId, 'running');
    const reading = signals.filter((signal) => window.progress[signal.id]);
    const streams = await readRecorded(source.client, {
      webIds: reading.map((signal) => signal.sourceKey),
      start: pageStart(window),
      end: window.end,
      maxCount: request.pageSize,
    });
    const pages = streams.map((stream, index) =>
      streamPage(reading[index], stream, {
        window,
        pageSize: request.pageSize,
      }),
    );
    const next = advanceSignalWindow(cursor, window, {
      pages,
      pageSize: request.pageSize,
    });
    return {
      records: envelopesOf(streams, {
        request,
        reading,
        window,
        at: now,
      }),
      nextCursor: { ...next.cursor },
      hasMore: !next.complete,
      onCommitted: this.completion(scope, next.complete),
    };
  }

  /** Nothing left in the window (a backfill already past `to`): an empty, final page. */
  private finished(request: ReadRequest, scope: PiSignalScope): ReadPage {
    return {
      records: [],
      nextCursor: { ...(request.cursor ?? {}) },
      hasMore: false,
      onCommitted: this.completion(scope, true),
    };
  }

  private completion(
    scope: PiSignalScope,
    complete: boolean,
  ): (() => Promise<void>) | undefined {
    const runId = scope.runId;
    if (scope.mode !== 'backfill' || !complete || !runId) return undefined;
    return () => this.backfills.advance(runId, 'completed');
  }
}

/**
 * Page bookkeeping of one stream. A full page ending at the page start cannot advance (more values at
 * one timestamp than a page holds) and would loop forever, so it fails.
 */
function streamPage(
  signal: Signal,
  stream: PiStreamValues,
  context: { window: PiSignalWindow; pageSize: number },
): StreamPage {
  const last = stream.items[stream.items.length - 1];
  const lastTimestamp = last ? isoOf(last.Timestamp) : null;
  const full = stream.items.length >= context.pageSize;
  if (
    full &&
    lastTimestamp !== null &&
    lastTimestamp <= pageStart(context.window)
  ) {
    throw new PiRequestError(
      `More than ${context.pageSize} values of stream ${stream.webId} at ${lastTimestamp}; raise the page size`,
      'rejected',
    );
  }
  return { signalId: signal.id, count: stream.items.length, lastTimestamp };
}

/** Envelopes of the values at or after each signal's own progress (earlier ones were read already). */
function envelopesOf(
  streams: PiStreamValues[],
  context: {
    request: ReadRequest;
    reading: Signal[];
    window: PiSignalWindow;
    at: Date;
  },
): unknown[] {
  const { request, reading, window } = context;
  const binding = {
    tenantId: request.connection.tenantId,
    connectionId: request.connection.id,
  };
  const correlationId = `pi-job:${request.jobId ?? 'adhoc'}:${window.end}`;
  return streams.flatMap((stream, index) =>
    stream.items
      .filter(
        (item) => isoOf(item.Timestamp) >= window.progress[reading[index].id],
      )
      .map((item) =>
        piSampleEnvelope(binding, item, {
          webId: stream.webId,
          at: context.at,
          correlationId,
        }),
      ),
  );
}

function isoOf(timestamp: string): string {
  return new Date(timestamp).toISOString();
}
