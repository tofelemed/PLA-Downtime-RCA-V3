import { SourceType } from '../envelope/canonical-envelope';
import {
  ConnectionCapabilities,
  IntegrationConnection,
} from '../entities/integration-connection.entity';

/** One page request of a leased job: the committed cursor and the job scope. */
export interface ReadRequest {
  connection: IntegrationConnection;
  scope: Readonly<Record<string, unknown>>;
  /** last committed cursor; null on the first run */
  cursor: Readonly<Record<string, unknown>> | null;
  pageSize: number;
}

/** What a read returns; the runner commits `nextCursor` only after every record is accepted. */
export interface ReadPage {
  /** canonical envelopes (validated by intake, not by the adapter's types) */
  records: unknown[];
  nextCursor: Record<string, unknown>;
  /** true = more data is ready now (the runner reads again without waiting for the cadence) */
  hasMore: boolean;
}

export interface AdapterHealth {
  status: 'ok' | 'degraded' | 'down';
  detail?: string;
}

export interface ConnectionTest {
  connected: boolean;
  message: string;
}

/**
 * Source adapter contract (spec ING07). Config validation, capability declaration, connection test,
 * metadata discovery, paged reads from a checkpoint and health are mandatory. Pause, drain and stop are
 * job states handled by the runner between pages; a checkpoint is the cursor returned by `read`.
 * Replay re-delivers retained raw observations (source-neutral, `ReplayService`); an adapter that can
 * re-read the source itself declares `capabilities.replay` and implements `replayRead`.
 */
export interface SourceAdapter {
  readonly sourceType: SourceType;
  capabilities(): ConnectionCapabilities;
  /** problems with an endpoint configuration (empty = valid); secrets are never part of it */
  validateConfig(config: Readonly<Record<string, unknown>>): string[];
  test(connection: IntegrationConnection): Promise<ConnectionTest>;
  discover(connection: IntegrationConnection): Promise<Record<string, unknown>>;
  read(request: ReadRequest): Promise<ReadPage>;
  replayRead?(
    request: ReadRequest & { from: Date; to: Date },
  ): Promise<ReadPage>;
  health(connection: IntegrationConnection): Promise<AdapterHealth>;
  close?(): Promise<void>;
}
