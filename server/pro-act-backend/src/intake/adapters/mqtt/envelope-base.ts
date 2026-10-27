import {
  CanonicalEnvelope,
  EnvelopeQuality,
} from '../../envelope/canonical-envelope';
import { DecodeInput } from './decode-result';
import { PickedMessage } from './decode-stages';

/** The delivery fields every contract message carries (contract §3 common rules). */
export interface CommonFields {
  bootId: string | null;
  seq: number | null;
  source: string | null;
}

export function commonFieldsOf(picked: PickedMessage): CommonFields {
  return {
    bootId: picked.fields.string('bootId'),
    seq: picked.fields.integer('sequence'),
    source: picked.fields.string('source'),
  };
}

/** What a profile decoder decided; everything else of the envelope is the same for every profile. */
export interface EnvelopeParts {
  messageId: string;
  sourceObjectId: string;
  sourceRevision: string | null;
  operation: CanonicalEnvelope['operation'];
  kind: CanonicalEnvelope['kind'];
  observedAt: string;
  startTime?: string;
  endTime?: string | null;
  sourcePath: string;
  values?: CanonicalEnvelope['values'];
  quality: EnvelopeQuality;
  retraction?: CanonicalEnvelope['retraction'];
  /** profile-specific additions to `sourceControls.mqtt` */
  controls?: Record<string, unknown>;
}

/**
 * The canonical envelope of one decoded packet (design §4.2 stages 3, 5, 10, 11): tenancy from the
 * connection, raw payload and canonical hash in provenance, `mappingVersion` = the connection's
 * `config_version`, and every MQTT delivery fact in `sourceControls.mqtt` (diagnostic only: packet
 * ids are never identities, MQ05).
 */
export function buildEnvelope(
  input: DecodeInput,
  picked: Pick<PickedMessage, 'json' | 'hash'>,
  common: CommonFields,
  parts: EnvelopeParts,
): CanonicalEnvelope {
  const { connection } = input;
  return {
    schemaVersion: '1.0',
    messageId: parts.messageId,
    tenantId: connection.tenantId,
    connectionId: connection.connectionId,
    sourceType: 'mqtt',
    sourceObjectId: parts.sourceObjectId,
    sourceRevision: parts.sourceRevision,
    operation: parts.operation,
    kind: parts.kind,
    observedAt: parts.observedAt,
    receivedAt: input.receivedAt.toISOString(),
    ...(parts.startTime !== undefined ? { startTime: parts.startTime } : {}),
    ...(parts.endTime !== undefined ? { endTime: parts.endTime } : {}),
    location: { sourcePath: parts.sourcePath },
    ...(parts.values ? { values: parts.values } : {}),
    quality: parts.quality,
    provenance: {
      rawPayload: picked.json,
      payloadHash: picked.hash,
      mappingVersion: connection.configVersion,
      correlationId:
        input.correlationId ??
        `mqtt:${common.bootId ?? connection.connectionId}`,
    },
    sourceControls: {
      mqtt: {
        topic: input.topic,
        retained: input.retained,
        duplicate: input.dup,
        qos: input.qos,
        packetId: input.packetId ?? null,
        bootId: common.bootId,
        sequence: common.seq,
        source: common.source,
        ...(parts.controls ?? {}),
      },
    },
    ...(parts.retraction ? { retraction: parts.retraction } : {}),
  };
}
