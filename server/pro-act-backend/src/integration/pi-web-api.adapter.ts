import { Injectable, OnModuleInit } from '@nestjs/common';
import { AdapterRegistry } from '../intake/adapters/adapter-registry';
import {
  AdapterHealth,
  ConnectionTest,
  ReadPage,
  ReadRequest,
  SourceAdapter,
} from '../intake/adapters/adapter.interface';
import {
  ConnectionCapabilities,
  IntegrationConnection,
} from '../intake/entities/integration-connection.entity';
import { piFrameEnvelope } from './pi-envelope';
import { fetchEventFrameAttributes } from './pi-event-mapper';
import { PiEventFrame } from './pi-frame-ingest.service';
import { PIWebApiService } from './pi-web-api.service';

/** Cursor of a PI event-frame job: the current search window and the next start index inside it. */
interface PiCursor {
  windowStart: string;
  windowEnd: string;
  startIndex: number;
}

const DEFAULT_LOOKBACK_MINUTES = 60;

/**
 * PI Web API adapter for leased ingestion jobs (ING07; certified in plan 1.6). Reads event frames of
 * the job scope (`scopeType`, `scopeId`, `templateName`, `lookbackMinutes`) window by window, sorted by
 * start time and paged by `startIndex`; each frame becomes a canonical envelope. Replay is served from
 * the raw store, so `replayRead` is not implemented.
 */
@Injectable()
export class PiWebApiAdapter implements SourceAdapter, OnModuleInit {
  readonly sourceType = 'pi_web_api' as const;

  constructor(
    private readonly registry: AdapterRegistry,
    private readonly piWebApi: PIWebApiService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  capabilities(): ConnectionCapabilities {
    return {
      replay: true,
      corrections: true,
      deletions: false,
      quality: false,
      sourceTimestamps: true,
      sequence: false,
    };
  }

  validateConfig(config: Readonly<Record<string, unknown>>): string[] {
    const url = config.piWebApiUrl;
    return typeof url === 'string' && /^https?:\/\/\S+$/i.test(url)
      ? []
      : ['piWebApiUrl must be an http(s) URL'];
  }

  test(connection: IntegrationConnection): Promise<ConnectionTest> {
    return this.piWebApi.testConnection(connection.tenantId);
  }

  async discover(
    connection: IntegrationConnection,
  ): Promise<Record<string, unknown>> {
    const servers = await this.piWebApi.request<{
      Items?: Array<{ Name?: string; WebId?: string }>;
    }>(connection.tenantId, '/assetservers');
    return {
      assetServers: (servers?.Items ?? []).map((item) => ({
        name: item.Name,
        webId: item.WebId,
      })),
    };
  }

  async read(request: ReadRequest): Promise<ReadPage> {
    const cursor = cursorOf(request);
    const tenantId = request.connection.tenantId;
    const data: unknown = await this.piWebApi.getEventFrames(tenantId, {
      scopeType: request.scope.scopeType as 'database' | 'element' | undefined,
      scopeId: request.scope.scopeId as string | undefined,
      templateName: request.scope.templateName as string | undefined,
      startTimeUtc: cursor.windowStart,
      endTimeUtc: cursor.windowEnd,
      maxCount: request.pageSize,
      startIndex: cursor.startIndex,
    });
    const frames = (data as { Items?: PiEventFrame[] } | null)?.Items ?? [];
    const records = await this.envelopes(request.connection, frames);
    const full = frames.length >= request.pageSize;
    return {
      records,
      hasMore: full,
      nextCursor: full
        ? { ...cursor, startIndex: cursor.startIndex + frames.length }
        : {
            windowStart: cursor.windowEnd,
            windowEnd: cursor.windowEnd,
            startIndex: 0,
          },
    };
  }

  async health(connection: IntegrationConnection): Promise<AdapterHealth> {
    const test = await this.test(connection);
    return test.connected
      ? { status: 'ok' }
      : { status: 'down', detail: test.message };
  }

  private async envelopes(
    connection: IntegrationConnection,
    frames: PiEventFrame[],
  ): Promise<unknown[]> {
    const binding = {
      tenantId: connection.tenantId,
      connectionId: connection.id,
    };
    const read = {
      at: new Date(),
      correlationId: `pi-job:${new Date().toISOString()}`,
    };
    const requestFn = (path: string) =>
      this.piWebApi.request(connection.tenantId, path);
    const records: unknown[] = [];
    for (const frame of frames) {
      const attributes = await fetchEventFrameAttributes(
        requestFn,
        frame.WebId,
      );
      records.push(piFrameEnvelope(binding, { frame, attributes }, read));
    }
    return records;
  }
}

/**
 * The window to read: the stored one while it is being paged; otherwise a new window from the end of
 * the previous one (or `lookbackMinutes` ago on the first run) to now.
 */
function cursorOf(request: ReadRequest): PiCursor {
  const stored = request.cursor as Partial<PiCursor> | null;
  if (stored?.windowStart && stored.windowEnd && (stored.startIndex ?? 0) > 0) {
    return {
      windowStart: stored.windowStart,
      windowEnd: stored.windowEnd,
      startIndex: stored.startIndex ?? 0,
    };
  }
  const lookback = Number(
    request.scope.lookbackMinutes ?? DEFAULT_LOOKBACK_MINUTES,
  );
  const start =
    stored?.windowEnd ?? new Date(Date.now() - lookback * 60_000).toISOString();
  return {
    windowStart: start,
    windowEnd: new Date().toISOString(),
    startIndex: 0,
  };
}
