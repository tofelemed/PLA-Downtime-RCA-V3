import { Injectable, OnModuleInit } from '@nestjs/common';
import { AdapterRegistry } from '../intake/adapters/adapter-registry';
import {
  AdapterHealth,
  ConnectionTest,
  ReadPage,
  ReadRequest,
  SampleRequest,
  SourceAdapter,
  SourceSample,
} from '../intake/adapters/adapter.interface';
import {
  ConnectionCapabilities,
  IntegrationConnection,
} from '../intake/entities/integration-connection.entity';
import { PiClientFactory } from './pi/pi-client-factory';
import { diagnosePiEndpoint, diagnosisMessage } from './pi/pi-diagnostics';
import { PiSearchScope } from './pi/pi-frame-search';
import { PiInventory } from './pi/pi-inventory';
import { PiJobScope, parsePiJobScope } from './pi/pi-job-scope';
import { PiOpenFrameRefresh } from './pi/pi-open-frame-refresh';
import { samplePiFrames } from './pi/pi-sample';
import { PiSignalRead } from './pi/pi-signal-read';
import { isPiSignalMode } from './pi/pi-signal-scope';
import { PiWindowRead } from './pi/pi-window-read';

interface AfItem {
  Name?: unknown;
  WebId?: unknown;
}

/**
 * Certified PI Web API adapter (plan 1.6, ING07, PI01–PI06). Each PI ingestion job has a mode
 * (`parsePiJobScope`): `window` polls with overlap and full paging, `rescan` re-reads 7/90 days for
 * corrections, `open_frames` re-reads tracked open frames by WebId, `inventory` confirms deletions.
 * Signal modes (plan 1.7, `PiSignalRead`): `recorded`, `summary`, `updates` and `backfill`.
 * Connection tests report DNS, TLS, auth, version, authorisation and read separately and detect the
 * batch controller. Replay is served from the raw store, so `replayRead` is not implemented.
 */
@Injectable()
export class PiWebApiAdapter implements SourceAdapter, OnModuleInit {
  readonly sourceType = 'pi_web_api' as const;

  constructor(
    private readonly registry: AdapterRegistry,
    private readonly clients: PiClientFactory,
    private readonly windows: PiWindowRead,
    private readonly openFrames: PiOpenFrameRefresh,
    private readonly inventory: PiInventory,
    private readonly signals: PiSignalRead,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  capabilities(): ConnectionCapabilities {
    return {
      replay: true,
      corrections: true,
      deletions: true,
      quality: false,
      sourceTimestamps: true,
      sequence: false,
      batch: true,
    };
  }

  validateConfig(config: Readonly<Record<string, unknown>>): string[] {
    const problems: string[] = [];
    const url = config.piWebApiUrl;
    if (typeof url !== 'string' || !/^https?:\/\/\S+$/i.test(url)) {
      problems.push('piWebApiUrl must be an http(s) URL');
    }
    const insecure = config.allowInsecureTls;
    if (insecure !== undefined && typeof insecure !== 'boolean') {
      problems.push('allowInsecureTls must be a boolean');
    }
    return problems;
  }

  async test(connection: IntegrationConnection): Promise<ConnectionTest> {
    const client = await this.clients
      .forConnection(connection)
      .catch((error: unknown) => error as Error);
    if (client instanceof Error) {
      return { connected: false, message: client.message };
    }
    const verifyTls = connection.endpointConfig.allowInsecureTls !== true;
    const result = await diagnosePiEndpoint(client, verifyTls);
    const message = diagnosisMessage(result.diagnostics);
    return {
      connected: message === 'All PI Web API checks passed',
      message,
      diagnostics: { ...result.diagnostics },
      capabilities: result.capabilities,
    };
  }

  async discover(
    connection: IntegrationConnection,
  ): Promise<Record<string, unknown>> {
    const client = await this.clients.forConnection(connection);
    const servers = itemsOf(await client.get('assetservers'));
    const assetServers: Array<Record<string, unknown>> = [];
    for (const server of servers) {
      if (typeof server.WebId !== 'string') continue;
      const databases = itemsOf(
        await client.get(
          `assetservers/${encodeURIComponent(server.WebId)}/assetdatabases`,
        ),
      );
      assetServers.push({
        name: server.Name,
        webId: server.WebId,
        databases: databases.map((db) => ({ name: db.Name, webId: db.WebId })),
      });
    }
    return { assetServers };
  }

  /** Discovery sample of recent frames with attribute values (plan 3.7); nothing is stored. */
  async sample(
    connection: IntegrationConnection,
    request: SampleRequest,
  ): Promise<SourceSample> {
    const client = await this.clients.forConnection(connection);
    return samplePiFrames(
      client,
      request,
      connection.capabilities.batch !== false,
    );
  }

  /** Signal jobs (plan 1.7) are checked at creation; frame jobs keep failing at read time (1.6). */
  async validateScope(
    connection: IntegrationConnection,
    scope: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    if (isPiSignalMode(scope.mode)) await this.signals.check(connection, scope);
  }

  async read(request: ReadRequest): Promise<ReadPage> {
    const source = {
      client: await this.clients.forConnection(request.connection),
      connection: request.connection,
    };
    if (isPiSignalMode(request.scope.mode)) {
      return this.signals.read(source, request);
    }
    const scope = parsePiJobScope(request.scope);
    if (scope.mode === 'open_frames') {
      return this.openFrames.read(source, request);
    }
    const searchable = scope as PiJobScope & { search: PiSearchScope };
    return scope.mode === 'inventory'
      ? this.inventory.read(source, request, searchable)
      : this.windows.read(source, request, searchable);
  }

  async health(connection: IntegrationConnection): Promise<AdapterHealth> {
    const test = await this.test(connection);
    return test.connected
      ? { status: 'ok' }
      : { status: 'down', detail: test.message };
  }
}

function itemsOf(reply: unknown): AfItem[] {
  const items = (reply as { Items?: unknown } | null)?.Items;
  return Array.isArray(items) ? (items as AfItem[]) : [];
}
