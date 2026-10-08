import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

/** One delivery as a consumer sees it; `key` identifies the effect, not the transport attempt. */
export interface InboxDelivery {
  key: string;
  tenantId: string;
  /** consumer name (inbox `scope`) */
  consumer: string;
  type: string;
}

export type InboxOutcome<T> =
  | { status: 'processed'; result: T }
  | { status: 'duplicate' };

/**
 * Consumer side of FND02 / T10. `runOnce` inserts the delivery key and runs `work` in one transaction:
 * a crash before commit leaves neither the key nor the effect, so the redelivery processes it; once
 * committed, every redelivery finds the key (`ON CONFLICT DO NOTHING`) and has no second effect. A
 * concurrent duplicate blocks on the key until the first transaction ends, then sees it.
 *
 * Effects that run their own transactions (normalisation) must be idempotent themselves: the key then
 * stops repeats after success, and a crash between effect and commit re-runs an idempotent effect.
 */
@Injectable()
export class InboxService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  runOnce<T>(
    delivery: InboxDelivery,
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<InboxOutcome<T>> {
    return this.dataSource.transaction(async (manager) => {
      const claimed: Array<{ delivery_key: string }> = await manager.query(
        `INSERT INTO "inbox" ("delivery_key", "tenant_id", "scope", "type")
         VALUES ($1, $2, $3, $4) ON CONFLICT ("delivery_key") DO NOTHING RETURNING "delivery_key"`,
        [delivery.key, delivery.tenantId, delivery.consumer, delivery.type],
      );
      if (claimed.length === 0) return { status: 'duplicate' };
      const result = await work(manager);
      await manager.query(
        `UPDATE "inbox" SET "processed_at" = now() WHERE "delivery_key" = $1`,
        [delivery.key],
      );
      return { status: 'processed', result };
    });
  }

  /** True when the key was processed (used to skip work before claiming, e.g. inline paths). */
  async isProcessed(key: string): Promise<boolean> {
    const rows: unknown[] = await this.dataSource.query(
      `SELECT 1 FROM "inbox" WHERE "delivery_key" = $1 AND "processed_at" IS NOT NULL`,
      [key],
    );
    return rows.length > 0;
  }
}
