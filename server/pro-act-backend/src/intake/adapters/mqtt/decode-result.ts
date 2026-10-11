import { CanonicalEnvelope } from '../../envelope/canonical-envelope';
import { MqttConnectionConfig } from './mqtt-config';
import { PayloadProfileKind } from './payload-profile';

/**
 * The outcome of decoding one MQTT packet (plan 1.8 WP3 step 2, design §4.2 stages 2–10): a canonical
 * envelope, or a typed rejection the subscriber host (step 3) quarantines and still acknowledges so a
 * poison message never blocks the session. Pure data; no broker I/O.
 */
export const DECODE_FAILURE_CODES = [
  'TOPIC_NOT_ALLOWED',
  'TOO_LARGE',
  'NOT_JSON',
  'UNSUPPORTED_VERSION',
  'TOPIC_SHAPE',
  'SCHEMA_INVALID',
  'IDENTITY_MISMATCH',
  'FUTURE_TIMESTAMP',
  'STALE_TIMESTAMP',
  'UNMAPPED_VALUE',
] as const;
export type DecodeFailureCode = (typeof DECODE_FAILURE_CODES)[number];

/** What the host may keep of a rejected packet: never more than the payload when it parsed. */
export interface DecodeRawRef {
  topic: string;
  bytes: number;
  /** `sha256:<hex>` of the raw bytes (not of the parsed JSON, which may not exist) */
  payloadHash: string;
  /** the parsed JSON object when the payload parsed (size and shape permitting) */
  json?: unknown;
}

export interface DecodeFailure {
  ok: false;
  code: DecodeFailureCode;
  detail: string;
  rawPayloadRef?: DecodeRawRef;
}

export type DecodeResult =
  | { ok: true; envelope: CanonicalEnvelope }
  | DecodeFailure;

/** The authenticated binding of the subscription; tenancy comes from here, never from the message. */
export interface DecodeConnection {
  tenantId: string;
  connectionId: string;
  /** `integration_connections.config_version` → `provenance.mappingVersion` */
  configVersion: number;
  config: MqttConnectionConfig;
}

/** One packet as mqtt.js `handleMessage` delivers it, plus the receive time and the binding. */
export interface DecodeInput {
  topic: string;
  payload: Buffer;
  retained: boolean;
  qos: 0 | 1 | 2;
  dup: boolean;
  packetId?: number | null;
  receivedAt: Date;
  /** overrides the default `mqtt:<bootId>` correlation id (replays, tests) */
  correlationId?: string;
  connection: DecodeConnection;
}

export interface ProfileDecoder {
  readonly kind: PayloadProfileKind;
  decode(input: DecodeInput): DecodeResult;
}

export function decodeFailure(
  code: DecodeFailureCode,
  detail: string,
  rawPayloadRef?: DecodeRawRef,
): DecodeFailure {
  return rawPayloadRef
    ? { ok: false, code, detail, rawPayloadRef }
    : { ok: false, code, detail };
}
