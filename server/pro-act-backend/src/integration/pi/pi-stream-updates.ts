import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ReadPage, ReadRequest } from '../../intake/adapters/adapter.interface';
import { IntegrationConnection } from '../../intake/entities/integration-connection.entity';
import { Signal } from '../../signals/entities/signal.entity';
import { SignalBackfillService } from '../../signals/signal-backfill.service';
import { PiSource } from './pi-frame-reader';
import { PiHttpClient, PiRequestError } from './pi-http-client';
import { piSampleEnvelope, PiTimedValue } from './pi-signal-envelope';
import { PiSignalScope } from './pi-signal-scope';
import { readRecorded, timedValues } from './pi-streams';

const MINUTE = 60_000;

/** Committed state of an `updates` job: the marker and the newest delivered sample time per signal. */
interface UpdatesCursor {
  markers: Record<string, string>;
  lastSampleAt: Record<string, string>;
}

/** One signal's share of a page. */
interface SignalUpdates {
  values: PiTimedValue[];
  marker: string;
  backfill: { from: Date; to: Date; detail: Record<string, unknown> } | null;
}

/**
 * Stream updates (PI08, plan 1.7 step 4), gated by the connection capability `streamUpdates`: each
 * signal registers once (`POST streams/{webId}/updates`) and then reads its events by marker
 * (`GET streams/updates/{marker}`). A lost or expired marker re-registers and re-reads the bounded window
 * `[max(last sample, now − maxBackfillMinutes), now)` from recorded values, recorded as a `marker_lost`
 * backfill run after the commit; anything older is left to the independent `recorded` job. When PI has
 * no updates controller (404/405/501 on register) the capability is stored as false and the job fails.
 */
@Injectable()
export class PiStreamUpdates {
  private readonly logger = new Logger(PiStreamUpdates.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly backfills: SignalBackfillService,
  ) {}

  async read(
    source: PiSource,
    request: ReadRequest,
    input: { scope: PiSignalScope; signals: Signal[] },
  ): Promise<ReadPage> {
    assertCapability(source.connection);
    const cursor = updatesCursorOf(request.cursor);
    const now = new Date();
    const next: UpdatesCursor = {
      markers: { ...cursor.markers },
      lastSampleAt: { ...cursor.lastSampleAt },
    };
    const records: unknown[] = [];
    const backfills: Array<() => Promise<void>> = [];
    for (const signal of input.signals) {
      const updates = await this.updatesOf(source, signal, {
        cursor,
        now,
        scope: input.scope,
        pageSize: request.pageSize,
      });
      next.markers[signal.id] = updates.marker;
      records.push(...envelopesOf(request, signal, { updates, at: now }));
      advanceLastSample(next, signal.id, updates.values);
      if (updates.backfill) {
        backfills.push(this.recordBackfill(signal, updates.backfill));
      }
    }
    return {
      records,
      nextCursor: { ...next },
      hasMore: false,
      onCommitted: inOrder(backfills),
    };
  }

  /** Events since the marker; a first read registers; a lost marker re-registers and backfills. */
  private async updatesOf(
    source: PiSource,
    signal: Signal,
    context: UpdatesContext,
  ): Promise<SignalUpdates> {
    const marker = context.cursor.markers[signal.id];
    if (!marker) {
      return {
        values: [],
        marker: await this.register(source, signal),
        backfill: null,
      };
    }
    const polled = await pollMarker(source.client, marker);
    if (polled) {
      return { values: polled.values, marker: polled.marker, backfill: null };
    }
    this.logger.warn(
      `PI update marker of signal ${signal.id} lost; re-registering and backfilling`,
    );
    const fresh = await this.register(source, signal);
    const recovered = await recoverWindow(source, signal, context);
    return {
      values: recovered.values,
      marker: fresh,
      backfill: {
        ...recovered.window,
        detail: { ...recovered.detail, lostMarker: marker },
      },
    };
  }

  private async register(source: PiSource, signal: Signal): Promise<string> {
    try {
      const reply = await source.client.post<{ LatestMarker?: unknown }>(
        `streams/${encodeURIComponent(signal.sourceKey)}/updates`,
        null,
      );
      if (typeof reply?.LatestMarker === 'string') return reply.LatestMarker;
      throw new PiRequestError(
        `PI returned no update marker for ${signal.sourceKey}`,
        'unavailable',
      );
    } catch (error) {
      if (isUnsupported(error)) await this.disableUpdates(source.connection);
      throw error;
    }
  }

  private async disableUpdates(
    connection: IntegrationConnection,
  ): Promise<void> {
    connection.capabilities = {
      ...connection.capabilities,
      streamUpdates: false,
    };
    await this.dataSource.query(
      `UPDATE "integration_connections" SET "capabilities" = "capabilities" || '{"streamUpdates": false}'::jsonb
        WHERE "id" = $1`,
      [connection.id],
    );
  }

  private recordBackfill(
    signal: Signal,
    backfill: NonNullable<SignalUpdates['backfill']>,
  ): () => Promise<void> {
    return () =>
      this.backfills.recordCompleted({
        tenantId: signal.tenantId,
        signalId: signal.id,
        ...backfill,
      });
  }
}

interface UpdatesContext {
  cursor: UpdatesCursor;
  now: Date;
  scope: PiSignalScope;
  pageSize: number;
}

/**
 * Re-reads `[max(last sample, now − maxBackfillMinutes), now)` from recorded values after a lost marker;
 * `truncated` when the bound cut the gap or the page was full (the `recorded` job covers the rest).
 */
async function recoverWindow(
  source: PiSource,
  signal: Signal,
  context: UpdatesContext,
): Promise<{
  values: PiTimedValue[];
  window: { from: Date; to: Date };
  detail: Record<string, unknown>;
}> {
  const last = context.cursor.lastSampleAt[signal.id];
  const bound =
    context.now.getTime() - context.scope.maxBackfillMinutes * MINUTE;
  const from = new Date(Math.max(last ? Date.parse(last) : bound, bound));
  const [stream] = await readRecorded(source.client, {
    webIds: [signal.sourceKey],
    start: from.toISOString(),
    end: context.now.toISOString(),
    maxCount: context.pageSize,
  });
  const truncated =
    (last !== undefined && Date.parse(last) < bound) ||
    stream.items.length >= context.pageSize;
  return {
    values: stream.items,
    window: { from, to: context.now },
    detail: { truncated, values: stream.items.length },
  };
}

function envelopesOf(
  request: ReadRequest,
  signal: Signal,
  input: { updates: SignalUpdates; at: Date },
): unknown[] {
  const binding = {
    tenantId: request.connection.tenantId,
    connectionId: request.connection.id,
  };
  const read = {
    webId: signal.sourceKey,
    at: input.at,
    correlationId: `pi-job:${request.jobId ?? 'adhoc'}:updates`,
  };
  return input.updates.values.map((value) =>
    piSampleEnvelope(binding, value, read),
  );
}

/** Runs the post-commit bookkeeping one after another; undefined when there is none. */
function inOrder(
  steps: Array<() => Promise<void>>,
): (() => Promise<void>) | undefined {
  if (steps.length === 0) return undefined;
  return async () => {
    for (const step of steps) await step();
  };
}

/** `GET streams/updates/{marker}`; null when PI no longer knows the marker (lost or expired). */
async function pollMarker(
  client: PiHttpClient,
  marker: string,
): Promise<{ values: PiTimedValue[]; marker: string } | null> {
  try {
    const reply = await client.get<{
      Events?: unknown;
      LatestMarker?: unknown;
      Status?: unknown;
    }>(`streams/updates/${encodeURIComponent(marker)}`);
    if (reply?.Status !== 'Succeeded' || typeof reply.LatestMarker !== 'string')
      return null;
    // a `Remove` event deletes an archive value; deletions of samples are not modelled yet (D02 item 7)
    const events = Array.isArray(reply.Events)
      ? reply.Events.filter(
          (event: { Action?: unknown }) => event?.Action !== 'Remove',
        )
      : [];
    return { values: timedValues(events), marker: reply.LatestMarker };
  } catch (error) {
    if (
      error instanceof PiRequestError &&
      [400, 404, 410].includes(error.status ?? 0)
    )
      return null;
    throw error;
  }
}

function assertCapability(connection: IntegrationConnection): void {
  if (connection.capabilities.streamUpdates !== false) return;
  throw new PiRequestError(
    'This PI Web API has no stream updates; use a recorded job (capability streamUpdates = false)',
    'unsupported',
  );
}

function isUnsupported(error: unknown): boolean {
  return (
    error instanceof PiRequestError &&
    [404, 405, 501].includes(error.status ?? 0)
  );
}

function updatesCursorOf(
  raw: Readonly<Record<string, unknown>> | null,
): UpdatesCursor {
  const map = (value: unknown): Record<string, string> =>
    typeof value === 'object' && value !== null
      ? Object.fromEntries(
          Object.entries(value).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string',
          ),
        )
      : {};
  return { markers: map(raw?.markers), lastSampleAt: map(raw?.lastSampleAt) };
}

function advanceLastSample(
  cursor: UpdatesCursor,
  signalId: string,
  values: PiTimedValue[],
): void {
  for (const value of values) {
    const at = new Date(value.Timestamp).toISOString();
    const held = cursor.lastSampleAt[signalId];
    if (!held || at > held) cursor.lastSampleAt[signalId] = at;
  }
}
