import { randomUUID } from 'crypto';
import { EntityManager } from 'typeorm';
import { IngestionErrorCode } from './entities/ingestion-exception.entity';
import { RawObservation } from './entities/raw-observation.entity';
import { canonicalJson } from './envelope/envelope-validator';
import { recordException } from './exceptions/exception-store';
import { AcceptResult, IntakeBinding } from './intake.types';
import {
  countDuplicateDelivery,
  insertRaw,
  registerIdentity,
} from './raw-store';

/** A delivery an adapter could not decode into an envelope (plan 1.8), kept with its typed reason. */
export interface RejectedDelivery {
  /** dedupe key of the delivery (e.g. `invalid:<sha256 of the raw bytes>`) */
  messageId: string;
  sourceObjectId: string;
  errorCode: IngestionErrorCode;
  detail: Record<string, unknown>;
  /** what is kept of the raw delivery: metadata, the parsed body when there is one, never secrets */
  payload: Record<string, unknown>;
  /** `sha256:<hex>` of the raw bytes */
  payloadHash: string;
  mappingVersion: number;
  correlationId: string;
  receivedAt: Date;
}

/** The raw row of a rejected delivery: `outcome = invalid`, no kind, no event time. */
export function rejectedRawRow(
  binding: IntakeBinding,
  rejected: RejectedDelivery,
): RawObservation {
  const payload = { ...rejected.payload, rejection: rejected.errorCode };
  return Object.assign(new RawObservation(), {
    id: randomUUID(),
    receivedAt: rejected.receivedAt,
    tenantId: binding.tenantId,
    connectionId: binding.connectionId,
    messageId: rejected.messageId.slice(0, 512),
    sourceObjectId: rejected.sourceObjectId.slice(0, 512),
    sourceRevision: null,
    contentHash: rejected.payloadHash,
    kind: null,
    operation: null,
    eventTime: null,
    payload,
    payloadRef: null,
    payloadSize: Buffer.byteLength(canonicalJson(payload)),
    quality: null,
    sourceCursor: null,
    mappingVersion: rejected.mappingVersion,
    correlationId: rejected.correlationId,
    replayRunId: null,
    originalRawId: null,
    outcome: 'invalid',
  });
}

/**
 * Retains a rejected delivery inside the caller's transaction: first delivery → raw row + open
 * exception; a repeat of the same message id → duplicate counted, exception `occurrences` bumped.
 */
export async function retainRejectedDelivery(
  manager: EntityManager,
  binding: IntakeBinding,
  rejected: RejectedDelivery,
): Promise<AcceptResult> {
  const row = rejectedRawRow(binding, rejected);
  const identity = {
    tenantId: row.tenantId,
    connectionId: row.connectionId,
    messageId: row.messageId,
  };
  const registration = await registerIdentity(manager, identity, {
    rawId: row.id,
    receivedAt: row.receivedAt,
  });
  if (registration.fresh) await insertRaw(manager, row);
  else await countDuplicateDelivery(manager, identity);
  const first = registration.fresh
    ? { rawId: row.id, receivedAt: row.receivedAt }
    : { rawId: registration.rawId, receivedAt: registration.receivedAt };
  await recordException(manager, {
    tenantId: row.tenantId,
    connectionId: row.connectionId,
    sourceObjectId: row.sourceObjectId,
    rawId: first.rawId,
    rawReceivedAt: first.receivedAt,
    errorCode: rejected.errorCode,
    detail: rejected.detail,
  });
  return {
    status: registration.fresh ? 'invalid' : 'duplicate',
    rawId: first.rawId,
    sourceObjectId: row.sourceObjectId,
    ticket: null,
  };
}
