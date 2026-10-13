import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DOMAIN_EVENT_SCHEMAS } from '../domain-events/domain-event-schemas';

const DAY_MS = 86_400_000;

export interface RetentionOptions {
  /** published messages and processed inbox keys older than this are deleted */
  retentionDays: number;
  /** rows deleted per statement */
  batchSize: number;
}

/** Downstream domain events: delivery receipts of approved periods, kept with the audit (D07, 7 years). */
const KEPT_TYPES = Object.keys(DOMAIN_EVENT_SCHEMAS);

const OUTBOX_BATCH = `DELETE FROM "outbox" WHERE "id" IN (
  SELECT "id" FROM "outbox"
   WHERE "state" = 'published' AND "published_at" < $1 AND NOT ("type" = ANY($2::text[]))
   ORDER BY "id" LIMIT $3)`;

const INBOX_BATCH = `DELETE FROM "inbox" WHERE "delivery_key" IN (
  SELECT "delivery_key" FROM "inbox"
   WHERE "processed_at" IS NOT NULL AND "processed_at" < $1 LIMIT $2)`;

/**
 * DB-07: retention of the internal message tables. Published internal outbox messages and processed
 * inbox keys older than the window are deleted in small batches (short locks, no long transaction);
 * pending and failed messages wait for the relay or an operator, and the downstream domain events stay
 * as delivery receipts. Realtime clients further behind than the window resync from a snapshot.
 */
@Injectable()
export class OutboxRetentionService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async purge(
    now: Date,
    options: RetentionOptions,
  ): Promise<{ outbox: number; inbox: number }> {
    const before = new Date(now.getTime() - options.retentionDays * DAY_MS);
    const outbox = await this.drain(OUTBOX_BATCH, [
      before,
      KEPT_TYPES,
      options.batchSize,
    ]);
    const inbox = await this.drain(INBOX_BATCH, [before, options.batchSize]);
    return { outbox, inbox };
  }

  private async drain(sql: string, params: unknown[]): Promise<number> {
    const batchSize = params[params.length - 1] as number;
    let total = 0;
    for (;;) {
      const result = await this.dataSource.query<[unknown, number]>(
        sql,
        params,
      );
      const deleted = result[1] ?? 0;
      total += deleted;
      if (deleted < batchSize) return total;
    }
  }
}
