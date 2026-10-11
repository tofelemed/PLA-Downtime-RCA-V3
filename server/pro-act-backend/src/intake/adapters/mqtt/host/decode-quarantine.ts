import { createHash } from 'crypto';
import { IngestionErrorCode } from '../../../entities/ingestion-exception.entity';
import { RejectedDelivery } from '../../../rejected-delivery';
import {
  DecodeFailure,
  DecodeFailureCode,
  DecodeInput,
} from '../decode-result';

/** `DECODE_FAILURE_CODES` → `ingestion_exceptions.error_code` (design §4.2 stages 2, 4, 7, 9). */
export const DECODE_ERROR_CODES: Readonly<
  Record<DecodeFailureCode, IngestionErrorCode>
> = {
  TOPIC_NOT_ALLOWED: 'topic_not_allowed',
  TOO_LARGE: 'too_large',
  NOT_JSON: 'not_json',
  UNSUPPORTED_VERSION: 'unsupported_version',
  TOPIC_SHAPE: 'topic_shape',
  SCHEMA_INVALID: 'schema_invalid',
  IDENTITY_MISMATCH: 'identity_mismatch',
  FUTURE_TIMESTAMP: 'future_timestamp',
  STALE_TIMESTAMP: 'stale_timestamp',
  UNMAPPED_VALUE: 'unmapped_value',
};

/** Parsed bodies above this size are not copied into the raw row (the hash and size still are). */
const MAX_RETAINED_JSON_BYTES = 16_384;

/**
 * What intake retains of a packet the profile rejected (design §4.2 stage 2 "on failure"): the delivery
 * facts, the parsed body when it exists and is small, and the typed reason. The message id is the hash
 * of the raw bytes, so a redelivered poison message is a `duplicate` and bumps `occurrences` instead of
 * adding rows; the source object is the topic (one open row per topic and code).
 */
export function rejectedDeliveryOf(
  input: DecodeInput,
  failure: DecodeFailure,
): RejectedDelivery {
  const payloadHash =
    failure.rawPayloadRef?.payloadHash ??
    `sha256:${createHash('sha256').update(input.payload).digest('hex')}`;
  const json = failure.rawPayloadRef?.json;
  const keepJson =
    json !== undefined && input.payload.length <= MAX_RETAINED_JSON_BYTES;
  return {
    messageId: `invalid:${payloadHash}`,
    sourceObjectId: input.topic,
    errorCode: DECODE_ERROR_CODES[failure.code],
    detail: {
      reason: failure.detail.slice(0, 2000),
      decodeCode: failure.code,
      rawPayloadRef: {
        topic: input.topic,
        bytes: input.payload.length,
        payloadHash,
      },
      retained: input.retained,
      duplicate: input.dup,
    },
    payload: {
      topic: input.topic,
      bytes: input.payload.length,
      payloadHash,
      retained: input.retained,
      qos: input.qos,
      duplicate: input.dup,
      packetId: input.packetId ?? null,
      ...(keepJson ? { json } : {}),
    },
    payloadHash,
    mappingVersion: input.connection.configVersion,
    correlationId:
      input.correlationId ?? `mqtt:${input.connection.connectionId}`,
    receivedAt: input.receivedAt,
  };
}
