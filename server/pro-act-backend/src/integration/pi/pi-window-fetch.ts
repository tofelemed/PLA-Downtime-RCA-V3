import { Injectable } from '@nestjs/common';
import { IntegrationConnectionService } from '../../intake/connections/integration-connection.service';
import { IntegrationConnection } from '../../intake/entities/integration-connection.entity';
import { PIConnection } from '../../pi-connection/pi-connection.entity';
import { PiFramePayload } from '../pi-envelope';
import { PiClientFactory } from './pi-client-factory';
import { PiFrameReader } from './pi-frame-reader';
import { PiSearchScope, searchAllFrames } from './pi-frame-search';

/** One on-demand window of the v1 pull. */
export interface PiWindowQuery {
  tenantId: string;
  scope: PiSearchScope;
  start: string;
  end: string;
  pageSize: number;
}

/**
 * The v1 on-demand pull on the certified read path (plan 1.6 step 5): the v1 connection is mirrored
 * into `integration_connections` (same id), then every page of the window is read with the adapter's
 * client (TLS on, retries, timeouts) and the frames completed with batched attributes and ancestors.
 */
@Injectable()
export class PiWindowFetch {
  constructor(
    private readonly connections: IntegrationConnectionService,
    private readonly clients: PiClientFactory,
    private readonly reader: PiFrameReader,
  ) {}

  async fetch(
    piConnection: PIConnection,
    query: PiWindowQuery,
  ): Promise<{
    connection: IntegrationConnection;
    payloads: PiFramePayload[];
  }> {
    const connection = await this.connections.mirrorPiConnection(
      query.tenantId,
      piConnection,
    );
    const source = {
      client: await this.clients.forConnection(connection),
      connection,
    };
    const frames = await searchAllFrames(source.client, query.scope, {
      start: query.start,
      end: query.end,
      pageSize: query.pageSize,
    });
    return { connection, payloads: await this.reader.payloads(source, frames) };
  }
}
