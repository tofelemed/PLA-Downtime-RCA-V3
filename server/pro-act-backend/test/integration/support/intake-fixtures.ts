import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import {
  CanonicalEnvelope,
  SourceType,
} from '../../../src/intake/envelope/canonical-envelope';
import { payloadHash } from '../../../src/intake/envelope/envelope-validator';

/** Inserts an `integration_connections` row (no adapter config needed for intake tests). */
export async function insertConnection(
  dataSource: DataSource,
  tenantId: string,
  sourceType: SourceType = 'rest_import',
): Promise<string> {
  const id = randomUUID();
  await dataSource.query(
    `INSERT INTO integration_connections (id, tenant_id, source_type, display_name, row_version)
     VALUES ($1, $2, $3, $4, 1)`,
    [id, tenantId, sourceType, `test ${sourceType}`],
  );
  return id;
}

export interface MeasurementInput {
  tenantId: string;
  connectionId: string;
  objectId: string;
  /** minutes after 2026-10-08T06:00Z: the observation time */
  minute: number;
  value: number;
  messageId?: string;
}

/** A schema-valid measurement envelope (no normaliser is installed for measurements in 1.5). */
export function measurement(input: MeasurementInput): CanonicalEnvelope {
  const observedAt = new Date(
    Date.UTC(2026, 9, 8, 6, input.minute),
  ).toISOString();
  const raw = { v: input.value, ts: observedAt };
  return {
    schemaVersion: '1.0',
    messageId:
      input.messageId ?? `${input.objectId}:${input.minute}:${input.value}`,
    tenantId: input.tenantId,
    connectionId: input.connectionId,
    sourceType: 'rest_import',
    sourceObjectId: input.objectId,
    operation: 'observe',
    kind: 'measurement',
    observedAt,
    receivedAt: observedAt,
    location: { sourcePath: `test/${input.objectId}` },
    values: { sample: { signalRef: input.objectId, value: input.value } },
    quality: { status: 'good' },
    provenance: {
      rawPayload: raw,
      payloadHash: payloadHash(raw),
      mappingVersion: 0,
      correlationId: 'intake-test',
    },
  };
}

/** Row counts the intake tests assert on. */
export async function countRows(
  dataSource: DataSource,
  table: string,
  where = 'TRUE',
  params: unknown[] = [],
): Promise<number> {
  const rows: Array<{ count: number }> = await dataSource.query(
    `SELECT count(*)::int AS count FROM "${table}" WHERE ${where}`,
    params,
  );
  return rows[0].count;
}
