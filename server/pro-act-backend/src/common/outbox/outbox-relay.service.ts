import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { domainEventViolations } from '../domain-events/domain-event-validator';
import { backoffSeconds, envInt, withTimeout } from '../helpers/time-bounds';
import {
  OUTBOX_TRANSPORT,
  OutboxTransport,
  PublishedMessage,
} from './outbox-transport';

interface OutboxRow {
  id: string;
  tenant_id: string;
  aggregate_type: string;
  aggregate_id: string;
  type: string;
  version: number;
  payload: Record<string, unknown>;
  scope: string | null;
  attempts: number;
  created_at: Date;
}

export interface RelayResult {
  published: number;
  failed: number;
  deferred: number;
}

const BACKOFF_BASE_SECONDS = 2;
/** last_error prefix of a payload that violates its domain-event contract (API05) */
export const SCHEMA_INVALID = 'SCHEMA_INVALID';
const BACKOFF_CAP_SECONDS = 600;

/**
 * Outbox relay (FND02, API05): claims due `pending` rows with `FOR UPDATE SKIP LOCKED` (so two relays
 * never publish the same row concurrently), publishes them in id order through the bound transport
 * with a timeout, and marks them `published` in the same transaction. A failed publish is retried with
 * exponential backoff; after OUTBOX_MAX_ATTEMPTS the row is `failed` (dead letter, logged as an error).
 * Payloads of versioned domain messages are validated against their contract before publishing (plan
 * 2.9, API05); a violation is never published and dead-letters at once (`SCHEMA_INVALID`). Later rows of
 * an aggregate wait while an earlier row of it is backing off (per-aggregate order).
 */
@Injectable()
export class OutboxRelayService {
  private readonly logger = new Logger(OutboxRelayService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(OUTBOX_TRANSPORT) private readonly transport: OutboxTransport,
  ) {}

  /** One batch; returns what happened to the claimed rows. */
  relayBatch(limit = envInt('OUTBOX_BATCH_SIZE', 100)): Promise<RelayResult> {
    return this.dataSource.transaction(async (manager) => {
      const rows: OutboxRow[] = await manager.query(
        `SELECT "id", "tenant_id", "aggregate_type", "aggregate_id", "type", "version", "payload", "scope",
                "attempts", "created_at"
           FROM "outbox" "o" WHERE "state" = 'pending' AND "next_attempt_at" <= now()
            AND NOT EXISTS (
              SELECT 1 FROM "outbox" "earlier"
               WHERE "earlier"."tenant_id" = "o"."tenant_id" AND "earlier"."aggregate_type" = "o"."aggregate_type"
                 AND "earlier"."aggregate_id" = "o"."aggregate_id" AND "earlier"."state" = 'pending'
                 AND "earlier"."id" < "o"."id" AND "earlier"."next_attempt_at" > now())
          ORDER BY "id" LIMIT $1 FOR UPDATE SKIP LOCKED`,
        [limit],
      );
      return this.publishRows(manager, rows);
    });
  }

  private async publishRows(
    manager: EntityManager,
    rows: OutboxRow[],
  ): Promise<RelayResult> {
    const published: string[] = [];
    const blocked = new Set<string>();
    const result: RelayResult = { published: 0, failed: 0, deferred: 0 };
    for (const row of rows) {
      const aggregate = `${row.aggregate_type}:${row.aggregate_id}`;
      if (blocked.has(aggregate)) {
        result.deferred += 1;
        continue;
      }
      const violation = domainEventViolations(row.type, row.payload);
      const error = violation
        ? `${SCHEMA_INVALID}: ${violation}`.slice(0, 2000)
        : await this.publishOne(row);
      if (!error) {
        published.push(row.id);
        continue;
      }
      blocked.add(aggregate);
      result.failed += 1;
      await this.recordFailure(manager, row, error, violation !== null);
    }
    if (published.length > 0) {
      await manager.query(
        `UPDATE "outbox" SET "state" = 'published', "published_at" = now(), "attempts" = "attempts" + 1,
                "last_error" = NULL WHERE "id" = ANY($1::bigint[])`,
        [published],
      );
    }
    result.published = published.length;
    return result;
  }

  private async publishOne(row: OutboxRow): Promise<string | null> {
    try {
      await withTimeout(
        this.transport.publish(toPublished(row)),
        envInt('OUTBOX_PUBLISH_TIMEOUT_MS', 10_000),
        `publish ${row.type} #${row.id}`,
      );
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Outbox ${row.type} #${row.id} via ${this.transport.name} failed: ${message}`,
      );
      return message.slice(0, 2000);
    }
  }

  /** A permanent failure (schema violation) dead-letters at once: retrying cannot fix the payload. */
  private async recordFailure(
    manager: EntityManager,
    row: OutboxRow,
    error: string,
    permanent: boolean,
  ): Promise<void> {
    const attempts = row.attempts + 1;
    const exhausted =
      permanent || attempts >= envInt('OUTBOX_MAX_ATTEMPTS', 12);
    if (exhausted) {
      this.logger.error(
        `Outbox ${row.type} #${row.id} dead-lettered after ${attempts} attempt(s): ${error}`,
      );
    }
    const delay = backoffSeconds(
      row.attempts,
      BACKOFF_BASE_SECONDS,
      BACKOFF_CAP_SECONDS,
    );
    await manager.query(
      `UPDATE "outbox" SET "attempts" = $2, "last_error" = $3,
              "state" = $4::outbox_state, "next_attempt_at" = now() + make_interval(secs => $5)
        WHERE "id" = $1`,
      [row.id, attempts, error, exhausted ? 'failed' : 'pending', delay],
    );
  }
}

function toPublished(row: OutboxRow): PublishedMessage {
  return {
    id: String(row.id),
    tenantId: row.tenant_id,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    type: row.type,
    version: row.version,
    payload: row.payload,
    scope: row.scope,
    createdAt: new Date(row.created_at).toISOString(),
  };
}
