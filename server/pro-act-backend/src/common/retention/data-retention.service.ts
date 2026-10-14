import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { RetentionPolicy } from './retention-policy';

const DAY_MS = 86_400_000;

export interface RetentionResult {
  requestLog: number;
  auditTrail: number;
  rawPartitions: string[];
}

/** Served by `IDX_audit_logs_timestamp`; oldest first, one batch per statement (short locks). */
const REQUEST_LOG_BATCH = `DELETE FROM "audit_logs" WHERE "id" IN (
  SELECT "id" FROM "audit_logs" WHERE "timestamp" < $1 ORDER BY "timestamp" LIMIT $2)`;

/** Served by `IDX_audit_log_at`; the append-only trigger lets only rows older than the cutoff go. */
const AUDIT_TRAIL_BATCH = `DELETE FROM "audit_log" WHERE "id" IN (
  SELECT "id" FROM "audit_log" WHERE "at" < $1 ORDER BY "at" LIMIT $2)`;

/** Partitions of `raw_observations` whose upper bound (exclusive) is at or before the cutoff. */
const OLD_RAW_PARTITIONS = `SELECT "name" FROM (
  SELECT c."relname" AS "name",
         (regexp_match(pg_get_expr(c."relpartbound", c."oid"), 'TO \\(''([^'']+)''\\)'))[1]::timestamptz AS "upper"
    FROM pg_inherits i JOIN pg_class c ON c."oid" = i."inhrelid"
   WHERE i."inhparent" = '"raw_observations"'::regclass) p
 WHERE p."upper" <= $1 ORDER BY p."upper"`;

const RAW_PARTITION_NAME = /^raw_observations_y\d{4}m\d{2}$/;

/**
 * DB-07: deletes what is older than the configured windows (`RetentionPolicy`; null = keep). The request
 * log and the audit trail go in batches; raw observations go by whole monthly partition (DROP TABLE, no
 * row deletes, no bloat), never one holding a row newer than the cutoff. Nothing references raw rows by
 * foreign key; samples and summaries keep their `raw_id` as provenance.
 */
@Injectable()
export class DataRetentionService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async apply(now: Date, policy: RetentionPolicy): Promise<RetentionResult> {
    const before = (days: number | null) =>
      days === null ? null : new Date(now.getTime() - days * DAY_MS);
    const requestLog = before(policy.requestLogDays);
    const auditTrail = before(policy.auditTrailDays);
    const raw = before(policy.rawDays);
    return {
      requestLog: requestLog
        ? await this.purgeRequestLog(requestLog, policy.batchSize)
        : 0,
      auditTrail: auditTrail
        ? await this.purgeAuditTrail(auditTrail, policy.batchSize)
        : 0,
      rawPartitions: raw ? await this.dropRawPartitions(raw) : [],
    };
  }

  private purgeRequestLog(before: Date, batchSize: number): Promise<number> {
    return this.drain(
      (manager, limit) =>
        this.deleted(manager, REQUEST_LOG_BATCH, [before, limit]),
      batchSize,
    );
  }

  /** Each batch in its own transaction that declares the cutoff to the append-only trigger. */
  private purgeAuditTrail(before: Date, batchSize: number): Promise<number> {
    return this.drain(
      (manager, limit) =>
        manager.transaction(async (tx) => {
          await tx.query(
            `SELECT set_config('app.audit_retention_cutoff', $1, true)`,
            [before.toISOString()],
          );
          return this.deleted(tx, AUDIT_TRAIL_BATCH, [before, limit]);
        }),
      batchSize,
    );
  }

  private async dropRawPartitions(before: Date): Promise<string[]> {
    const rows: Array<{ name: string }> = await this.dataSource.query(
      OLD_RAW_PARTITIONS,
      [before],
    );
    const dropped: string[] = [];
    for (const { name } of rows) {
      if (!RAW_PARTITION_NAME.test(name)) continue;
      await this.dataSource.query(`DROP TABLE "public"."${name}"`);
      dropped.push(name);
    }
    return dropped;
  }

  private async drain(
    batch: (manager: EntityManager, limit: number) => Promise<number>,
    batchSize: number,
  ): Promise<number> {
    let total = 0;
    for (;;) {
      const deleted = await batch(this.dataSource.manager, batchSize);
      total += deleted;
      if (deleted < batchSize) return total;
    }
  }

  private async deleted(
    manager: EntityManager,
    sql: string,
    params: unknown[],
  ): Promise<number> {
    const result = await manager.query<[unknown, number]>(sql, params);
    return result[1] ?? 0;
  }
}
