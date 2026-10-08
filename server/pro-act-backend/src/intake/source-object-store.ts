import { EntityManager } from 'typeorm';
import {
  SourceObject,
  SourceObjectState,
} from './entities/source-object.entity';
import { ObjectKey } from './exceptions/exception-store';
import { StoredVersion } from './source-object-ordering';

/** The version a delivery would make the latest one. */
export interface VersionRow extends StoredVersion {
  rawId: string;
  receivedAt: Date;
  kind: string;
  /** `retracted` for a retraction, `deleted_confirmed` for a confirmed source deletion (PI06) */
  state: SourceObjectState;
}

/**
 * Inserts the source object with `version` as its first version; null when it already exists. A
 * concurrent first delivery waits on the unique key and then finds the row (no lost update).
 */
export async function insertIfNew(
  manager: EntityManager,
  key: ObjectKey,
  version: VersionRow,
): Promise<string | null> {
  const rows: Array<{ id: string }> = await manager.query(
    `INSERT INTO "source_objects" ("tenant_id", "connection_id", "source_object_id", "kind", "latest_raw_id",
            "latest_received_at", "latest_revision", "latest_hash", "latest_observed_at", "first_seen",
            "last_seen", "state", "row_version")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now(), $10::source_object_state, 1)
     ON CONFLICT ("tenant_id", "connection_id", "source_object_id") DO NOTHING RETURNING "id"`,
    [
      key.tenantId,
      key.connectionId,
      key.sourceObjectId,
      version.kind,
      version.rawId,
      version.receivedAt,
      version.revision,
      version.hash,
      version.observedAt,
      version.state,
    ],
  );
  return rows[0]?.id ?? null;
}

/** The source object row locked for this transaction, or null when there is none. */
export function findLockedObject(
  manager: EntityManager,
  key: ObjectKey,
): Promise<SourceObject | null> {
  return manager.findOne(SourceObject, {
    where: {
      tenantId: key.tenantId,
      connectionId: key.connectionId,
      sourceObjectId: key.sourceObjectId,
    },
    lock: { mode: 'pessimistic_write' },
  });
}

/** The source object row, locked; it must exist (insertIfNew found it). */
export async function lockObject(
  manager: EntityManager,
  key: ObjectKey,
): Promise<SourceObject> {
  const found = await findLockedObject(manager, key);
  if (!found) throw new Error(`source object ${key.sourceObjectId} vanished`);
  return found;
}

/** Makes `version` the latest one (a provably newer revision). */
export async function advanceVersion(
  manager: EntityManager,
  objectId: string,
  version: VersionRow,
): Promise<void> {
  await manager.query(
    `UPDATE "source_objects" SET "latest_raw_id" = $2, "latest_received_at" = $3, "latest_revision" = $4,
            "latest_hash" = $5, "latest_observed_at" = $6, "kind" = $7,
            "state" = $8::source_object_state, "last_seen" = now(), "updated_at" = now(),
            "row_version" = "row_version" + 1
      WHERE "id" = $1`,
    [
      objectId,
      version.rawId,
      version.receivedAt,
      version.revision,
      version.hash,
      version.observedAt,
      version.kind,
      version.state,
    ],
  );
}

/** A delivery that does not change the latest version still proves the object is alive. */
export async function touchObject(
  manager: EntityManager,
  objectId: string,
): Promise<void> {
  await manager.query(
    `UPDATE "source_objects" SET "last_seen" = now() WHERE "id" = $1`,
    [objectId],
  );
}

/** Records that canonical data was built from `rawId` (and which canonical event it is). */
export async function markNormalized(
  manager: EntityManager,
  key: ObjectKey,
  result: { rawId: string; canonicalEventId: string | null },
): Promise<void> {
  await manager.query(
    `UPDATE "source_objects" SET "normalized_raw_id" = $4,
            "canonical_event_id" = coalesce($5, "canonical_event_id"), "updated_at" = now(),
            "row_version" = "row_version" + 1
      WHERE "tenant_id" = $1 AND "connection_id" = $2 AND "source_object_id" = $3`,
    [
      key.tenantId,
      key.connectionId,
      key.sourceObjectId,
      result.rawId,
      result.canonicalEventId,
    ],
  );
}
