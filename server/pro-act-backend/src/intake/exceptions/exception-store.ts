import { EntityManager } from 'typeorm';
import { IngestionErrorCode } from '../entities/ingestion-exception.entity';

/** The source object an exception belongs to. */
export interface ObjectKey {
  tenantId: string;
  connectionId: string;
  sourceObjectId: string;
}

export interface ExceptionInput extends ObjectKey {
  rawId: string;
  rawReceivedAt: Date;
  errorCode: IngestionErrorCode;
  detail: Record<string, unknown>;
}

/**
 * Quarantines a delivery (ING05): one open row per source object and error code; a repeat points the
 * row at the newest raw delivery and counts it (`occurrences` = retries). Returns the row id.
 */
export async function recordException(
  manager: EntityManager,
  input: ExceptionInput,
): Promise<string> {
  const rows: Array<{ id: string }> = await manager.query(
    `INSERT INTO "ingestion_exceptions" ("tenant_id", "connection_id", "source_object_id", "raw_id",
            "raw_received_at", "error_code", "detail", "first_seen", "last_seen", "occurrences", "row_version")
     VALUES ($1, $2, $3, $4, $5, $6::ingestion_error_code, $7::jsonb, now(), now(), 1, 1)
     ON CONFLICT ("tenant_id", "connection_id", "source_object_id", "error_code") WHERE "state" = 'open'
     DO UPDATE SET "raw_id" = EXCLUDED."raw_id", "raw_received_at" = EXCLUDED."raw_received_at",
                   "detail" = EXCLUDED."detail", "last_seen" = now(),
                   "occurrences" = "ingestion_exceptions"."occurrences" + 1,
                   "updated_at" = now(), "row_version" = "ingestion_exceptions"."row_version" + 1
     RETURNING "id"`,
    [
      input.tenantId,
      input.connectionId,
      input.sourceObjectId,
      input.rawId,
      input.rawReceivedAt,
      input.errorCode,
      JSON.stringify(input.detail),
    ],
  );
  return rows[0].id;
}

/**
 * Resolves every open exception of a source object (the object normalised after all), except the one
 * with `keepCode` when given: a record applied with a linked quarantine (e.g. an event created uncoded,
 * `unknown_code`) keeps that row open and counting.
 */
export async function resolveOpenExceptions(
  manager: EntityManager,
  key: ObjectKey,
  resolution: { rawId: string; replayRunId: string | null; outcome: string },
  keepCode: IngestionErrorCode | null = null,
): Promise<number> {
  const [rows]: [unknown[], number] = await manager.query(
    `UPDATE "ingestion_exceptions"
        SET "state" = 'resolved', "resolution" = $4::jsonb, "replay_run_id" = coalesce($5, "replay_run_id"),
            "updated_at" = now(), "row_version" = "row_version" + 1
      WHERE "tenant_id" = $1 AND "connection_id" = $2 AND "source_object_id" = $3 AND "state" = 'open'
        AND ($6::text IS NULL OR "error_code"::text <> $6::text)
      RETURNING "id"`,
    [
      key.tenantId,
      key.connectionId,
      key.sourceObjectId,
      JSON.stringify({ ...resolution, resolvedAt: new Date().toISOString() }),
      resolution.replayRunId,
      keepCode,
    ],
  );
  return rows.length;
}
