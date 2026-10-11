import { INGESTION_ERROR_CODES } from '../../../entities/ingestion-exception.entity';
import { DECODE_FAILURE_CODES, decodeFailure } from '../decode-result';
import { examplePacket } from '../mqtt-decode.example';
import { DECODE_ERROR_CODES, rejectedDeliveryOf } from './decode-quarantine';

describe('decode failure → quarantine (plan 1.8 step 3)', () => {
  it('maps every DECODE_FAILURE_CODE onto an ingestion error code of the enum', () => {
    for (const code of DECODE_FAILURE_CODES) {
      expect(INGESTION_ERROR_CODES).toContain(DECODE_ERROR_CODES[code]);
    }
    expect(DECODE_ERROR_CODES).toMatchObject({
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
    });
  });

  it('keys the delivery on the hash of the raw bytes and keeps the parsed body when it is small', () => {
    const input = examplePacket({
      topic: 'proact/v1/HDPE/Polymer/Line1/Extruder1/events',
      payload: { schema_version: '2.0' },
      retained: true,
      dup: true,
    });
    const rejected = rejectedDeliveryOf(
      input,
      decodeFailure('UNSUPPORTED_VERSION', 'schema_version 2.0', {
        topic: input.topic,
        bytes: input.payload.length,
        payloadHash: 'sha256:abc',
        json: { schema_version: '2.0' },
      }),
    );
    expect(rejected).toMatchObject({
      messageId: 'invalid:sha256:abc',
      sourceObjectId: input.topic,
      errorCode: 'unsupported_version',
      payloadHash: 'sha256:abc',
      mappingVersion: 3,
      receivedAt: input.receivedAt,
      detail: {
        reason: 'schema_version 2.0',
        decodeCode: 'UNSUPPORTED_VERSION',
        rawPayloadRef: { topic: input.topic, payloadHash: 'sha256:abc' },
        retained: true,
        duplicate: true,
      },
      payload: { json: { schema_version: '2.0' }, retained: true, qos: 1 },
    });
  });

  it('hashes the bytes itself when the decoder had no raw reference, and drops a body above 16 KB', () => {
    const big = examplePacket({
      topic: 't',
      payload: { pad: 'x'.repeat(20_000) },
    });
    const rejected = rejectedDeliveryOf(
      big,
      decodeFailure('TOO_LARGE', 'payload is 20013 bytes'),
    );
    expect(rejected.messageId).toMatch(/^invalid:sha256:[0-9a-f]{64}$/);
    expect(rejected.payload).not.toHaveProperty('json');
    expect(rejected.payload.bytes).toBe(big.payload.length);
    expect(rejected.correlationId).toBe(`mqtt:${big.connection.connectionId}`);
  });
});
