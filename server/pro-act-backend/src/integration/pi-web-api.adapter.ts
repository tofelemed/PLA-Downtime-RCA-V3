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
import { PiClientFactory } from './pi/pi-client-factory';
import { diagnosePiEndpoint, diagnosisMessage } from './pi/pi-diagnostics';
import { PiSearchScope } from './pi/pi-frame-search';
import { PiInventory } from './pi/pi-inventory';
import { PiJobScope, parsePiJobScope } from './pi/pi-job-scope';
import { PiOpenFrameRefresh } from './pi/pi-open-frame-refresh';
import { PiWindowRead } from './pi/pi-window-read';

interface AfItem {
  Name?: unknown;
  WebId?: unknown;
}

/**
 * Certified PI Web API adapter (plan 1.6, ING07, PI01–PI06). Each PI ingestion job has a mode
 * (`parsePiJobScope`): `window` polls with overlap and full paging, `rescan` re-reads 7/90 days for
 * corrections, `open_frames` re-reads tracked open frames by WebId, `inventory` confirms deletions.
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

  async read(request: ReadRequest): Promise<ReadPage> {
    const scope = parsePiJobScope(request.scope);
    const source = {
      client: await this.clients.forConnection(request.connection),
      connection: request.connection,
    };
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
