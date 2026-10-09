import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  Optional,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { envInt, withTimeout } from '../common/helpers/time-bounds';
import { OutboxTail } from './outbox-tail';
import { OutboxFeedRow, routeOutboxRow } from './realtime-message';
import { ScopedRealtimeGateway } from './scoped-realtime.gateway';

/** Starts the poll loop at boot; off in tests that drive `pollOnce()` themselves. */
export const REALTIME_FEED_AUTOSTART = Symbol('REALTIME_FEED_AUTOSTART');

/**
 * Feeds the scoped realtime channel from the transactional outbox (plan 3.1, API05). Every API process
 * tails committed `outbox` rows by id — independently of the relay's publish state, so it sees what the
 * worker's jobs wrote too — routes each row to its tenant/unit rooms and hands them to the gateway.
 * Only the API process runs it (the worker serves no sockets). Disabled with REALTIME_FEED_ENABLED=false.
 */
@Injectable()
export class RealtimeFeedService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(RealtimeFeedService.name);
  private tail: OutboxTail | null = null;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly gateway: ScopedRealtimeGateway,
    @Optional()
    @Inject(REALTIME_FEED_AUTOSTART)
    private readonly autostart: boolean = true,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.autostart === false) return;
    if (process.env.REALTIME_FEED_ENABLED === 'false') return;
    await this.start();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Begins after the newest existing row: history is never replayed to browsers. */
  async start(): Promise<void> {
    await this.ensureTail();
    const interval = envInt('REALTIME_POLL_MS', 1000);
    this.timer = setInterval(() => void this.tick(), interval);
    this.timer.unref?.();
  }

  /** One read of new rows; returns how many room deliveries were made. */
  async pollOnce(nowMs = Date.now()): Promise<number> {
    const tail = await this.ensureTail();
    const rows: OutboxFeedRow[] = await withTimeout(
      this.dataSource.query(
        `SELECT "id", "tenant_id", "aggregate_type", "aggregate_id", "type", "version", "payload", "created_at"
           FROM "outbox" WHERE "id" > $1 ORDER BY "id" LIMIT $2`,
        [tail.floor, envInt('REALTIME_BATCH_SIZE', 500)],
      ),
      envInt('REALTIME_QUERY_TIMEOUT_MS', 5000),
      'realtime outbox read',
    );
    const byId = new Map(rows.map((row) => [Number(row.id), row]));
    const fresh = tail.accept([...byId.keys()], nowMs);
    let deliveries = 0;
    for (const id of fresh) {
      for (const routed of routeOutboxRow(byId.get(id) as OutboxFeedRow)) {
        this.gateway.deliver(this.gateway.buffer.append(routed));
        deliveries += 1;
      }
    }
    return deliveries;
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.pollOnce();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Realtime feed poll failed: ${message}`);
    } finally {
      this.running = false;
    }
  }

  private async ensureTail(): Promise<OutboxTail> {
    if (this.tail) return this.tail;
    const rows: Array<{ max: string }> = await this.dataSource.query(
      `SELECT COALESCE(MAX("id"), 0)::text AS "max" FROM "outbox"`,
    );
    const [row] = rows;
    this.tail = new OutboxTail(
      Number(row?.max ?? 0),
      envInt('REALTIME_GAP_GRACE_MS', 10_000),
    );
    return this.tail;
  }
}
