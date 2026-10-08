import { EntityManager } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { RawObservation } from './entities/raw-observation.entity';

/** Delivery identity of one message (FND02 dedupe key). */
export interface DeliveryIdentity {
  tenantId: string;
  connectionId: string;
  messageId: string;
}

export type IdentityRegistration =
  | { fresh: true }
  | { fresh: false; rawId: string; receivedAt: Date };

/**
 * Registers the first delivery of a message id (`raw_identities`). A repeat returns the first
 * delivery's raw row; the caller decides whether that is a duplicate or a replay.
 */
export async function registerIdentity(
  manager: EntityManager,
  identity: DeliveryIdentity,
  raw: { rawId: string; receivedAt: Date },
): Promise<IdentityRegistration> {
  const inserted: unknown[] = await manager.query(
    `INSERT INTO "raw_identities" ("tenant_id", "connection_id", "message_id", "raw_id", "received_at")
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT ("tenant_id", "connection_id", "message_id") DO NOTHING RETURNING "raw_id"`,
    [
      identity.tenantId,
      identity.connectionId,
      identity.messageId,
      raw.rawId,
      raw.receivedAt,
    ],
  );
  if (inserted.length > 0) return { fresh: true };
  const rows: Array<{ raw_id: string; received_at: Date }> =
    await manager.query(
      `SELECT "raw_id", "received_at" FROM "raw_identities"
        WHERE "tenant_id" = $1 AND "connection_id" = $2 AND "message_id" = $3`,
      [identity.tenantId, identity.connectionId, identity.messageId],
    );
  return {
    fresh: false,
    rawId: rows[0].raw_id,
    receivedAt: new Date(rows[0].received_at),
  };
}

/** Counts a repeated delivery of an already retained message id. */
export async function countDuplicateDelivery(
  manager: EntityManager,
  identity: DeliveryIdentity,
): Promise<void> {
  await manager.query(
    `UPDATE "raw_identities" SET "duplicate_count" = "duplicate_count" + 1, "last_duplicate_at" = now()
      WHERE "tenant_id" = $1 AND "connection_id" = $2 AND "message_id" = $3`,
    [identity.tenantId, identity.connectionId, identity.messageId],
  );
}

/** Appends one immutable raw row. */
export async function insertRaw(
  manager: EntityManager,
  row: RawObservation,
): Promise<void> {
  // jsonb columns: TypeORM's deep-partial type cannot express open records
  await manager.insert(
    RawObservation,
    row as unknown as QueryDeepPartialEntity<RawObservation>,
  );
}

/** One raw row by its key (partition pruning needs `received_at`). */
export function findRaw(
  manager: EntityManager,
  key: { rawId: string; receivedAt: Date },
): Promise<RawObservation | null> {
  return manager.findOne(RawObservation, {
    where: { id: key.rawId, receivedAt: key.receivedAt },
  });
}
