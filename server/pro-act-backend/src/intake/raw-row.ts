import { randomUUID } from 'crypto';
import { CanonicalEnvelope } from './envelope/canonical-envelope';
import {
  canonicalJson,
  EnvelopeViolation,
  payloadHash,
} from './envelope/envelope-validator';
import { RawObservation, RawOutcome } from './entities/raw-observation.entity';
import { IntakeBinding } from './intake.types';
import { VersionRow } from './source-object-store';

/** Source object id used for envelopes too broken to name one. */
export const UNIDENTIFIED_OBJECT = '(unidentified)';

/** The raw row of a schema-valid envelope. */
export function rawRowOf(
  envelope: CanonicalEnvelope,
  input: {
    version: VersionRow;
    outcome: RawOutcome;
    originalRawId: string | null;
  },
): RawObservation {
  const payload = envelope as unknown as Record<string, unknown>;
  return Object.assign(new RawObservation(), {
    id: input.version.rawId,
    receivedAt: input.version.receivedAt,
    tenantId: envelope.tenantId,
    connectionId: envelope.connectionId,
    messageId: envelope.messageId,
    sourceObjectId: envelope.sourceObjectId,
    sourceRevision: envelope.sourceRevision ?? null,
    contentHash: input.version.hash,
    kind: envelope.kind,
    operation: envelope.operation,
    eventTime: new Date(envelope.observedAt),
    payload,
    payloadRef: envelope.provenance.rawPayloadRef ?? null,
    payloadSize: Buffer.byteLength(canonicalJson(payload)),
    quality: { ...envelope.quality },
    sourceCursor: envelope.provenance.sourceCursor ?? null,
    mappingVersion: envelope.provenance.mappingVersion,
    correlationId: envelope.provenance.correlationId,
    replayRunId: envelope.provenance.replayRunId ?? null,
    originalRawId: input.originalRawId,
    outcome: input.outcome,
  });
}

/**
 * The raw row of an envelope that failed validation: identity from the adapter binding plus whatever
 * message/source id the payload still carries (or a content hash), kept as delivered.
 */
export function invalidRawRow(
  binding: IntakeBinding,
  input: {
    candidate: unknown;
    violations: EnvelopeViolation[];
    receivedAt: Date;
  },
): RawObservation {
  const fields = asRecord(input.candidate);
  const hash = payloadHash(input.candidate ?? null);
  const payload = { delivered: input.candidate ?? null } as Record<
    string,
    unknown
  >;
  return Object.assign(new RawObservation(), {
    id: randomUUID(),
    receivedAt: input.receivedAt,
    tenantId: binding.tenantId,
    connectionId: binding.connectionId,
    messageId: textField(fields.messageId) ?? `invalid:${hash}`,
    sourceObjectId: textField(fields.sourceObjectId) ?? UNIDENTIFIED_OBJECT,
    sourceRevision: null,
    contentHash: hash,
    kind: null,
    operation: null,
    eventTime: null,
    payload,
    payloadRef: null,
    payloadSize: Buffer.byteLength(canonicalJson(payload)),
    quality: null,
    sourceCursor: null,
    mappingVersion: 0,
    correlationId: textField(asRecord(fields.provenance).correlationId),
    replayRunId: null,
    originalRawId: null,
    outcome: 'invalid',
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function textField(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0
    ? value.slice(0, 512)
    : null;
}
