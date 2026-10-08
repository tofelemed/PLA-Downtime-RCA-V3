import { CanonicalEnvelope } from '../intake/envelope/canonical-envelope';
import { payloadHash } from '../intake/envelope/envelope-validator';
import { IntakeBinding } from '../intake/intake.types';
import type { PiEventFrame } from './pi-frame-ingest.service';
import { piEndTimeIso } from './pi/pi-time';

/** What the PI bridge retains for one frame: the frame as PI delivered it and its attribute values. */
export interface PiFramePayload {
  frame: PiEventFrame;
  attributes: Record<string, unknown>;
}

/**
 * One PI event frame as a canonical envelope (spec §5.1, plan 1.5). PI frames carry no version, so the
 * message id is the WebId plus the content hash (an unchanged frame re-read by the next poll is a
 * duplicate delivery) and the observation time is the read time (later reads are newer versions).
 */
export function piFrameEnvelope(
  binding: IntakeBinding,
  payload: PiFramePayload,
  read: { at: Date; correlationId: string },
): CanonicalEnvelope {
  const { frame } = payload;
  const hash = payloadHash(payload);
  return {
    schemaVersion: '1.0',
    messageId: `${frame.WebId}:${hash}`,
    tenantId: binding.tenantId,
    connectionId: binding.connectionId,
    sourceType: 'pi_web_api',
    sourceObjectId: frame.WebId,
    sourceRevision: null,
    operation: 'observe',
    kind: 'interval_event',
    observedAt: read.at.toISOString(),
    receivedAt: read.at.toISOString(),
    startTime: isoOrNull(frame.StartTime) ?? read.at.toISOString(),
    // PI03: the open sentinel becomes null; the raw value stays in the payload and sourceControls
    endTime: piEndTimeIso(frame.EndTime),
    location: locationOf(frame),
    values: { templateName: frame.TemplateName ?? null },
    quality: { status: 'good' },
    provenance: {
      rawPayload: payload,
      payloadHash: hash,
      mappingVersion: 0,
      correlationId: read.correlationId,
    },
    sourceControls: {
      pi: { webId: frame.WebId, rawEndTime: frame.EndTime ?? null },
    },
  };
}

/** Evidence that a PI frame is gone (PI06): absent from a completed listing and 404 on direct lookup. */
export interface PiDeletionEvidence {
  webId: string;
  confirmedAt: Date;
  window: { start: string; end: string };
  correlationId: string;
}

/**
 * Retraction of a PI frame whose deletion is confirmed (PI06, T46): the source object becomes
 * `deleted_confirmed` and the canonical event is tombstoned through the revision path (never deleted).
 * One message id per frame, so a repeated confirmation is a duplicate delivery.
 */
export function piDeletionEnvelope(
  binding: IntakeBinding,
  evidence: PiDeletionEvidence,
): CanonicalEnvelope {
  const raw = {
    webId: evidence.webId,
    evidence: 'missing from a completed inventory listing; PI answered 404',
    window: evidence.window,
  };
  const at = evidence.confirmedAt.toISOString();
  return {
    schemaVersion: '1.0',
    messageId: `${evidence.webId}:deleted`,
    tenantId: binding.tenantId,
    connectionId: binding.connectionId,
    sourceType: 'pi_web_api',
    sourceObjectId: evidence.webId,
    sourceRevision: 'deleted',
    operation: 'retract',
    kind: 'retraction',
    observedAt: at,
    receivedAt: at,
    location: { sourcePath: evidence.webId },
    quality: { status: 'good' },
    provenance: {
      rawPayload: raw,
      payloadHash: payloadHash(raw),
      mappingVersion: 0,
      correlationId: evidence.correlationId,
    },
    sourceControls: { pi: { webId: evidence.webId } },
    retraction: {
      reason: 'PI event frame deleted (confirmed by inventory comparison)',
      confirmedDeletion: true,
    },
  };
}

/** The primary AF element path (or the frame path) and every referenced element id, primary first. */
function locationOf(frame: PiEventFrame): CanonicalEnvelope['location'] {
  const primary = frame.PrimaryReferencedElement;
  return {
    sourcePath: primary?.Path || frame.Path || frame.WebId,
    sourceElementIds: [
      ...(primary?.WebId ? [primary.WebId] : []),
      ...(frame.RefElementWebIds ?? []),
      ...(frame.AncestorElementWebIds ?? []),
    ],
  };
}

/** The frame and attributes retained in an envelope built by `piFrameEnvelope`. */
export function piPayloadOf(envelope: CanonicalEnvelope): PiFramePayload {
  const payload = envelope.provenance.rawPayload as Partial<PiFramePayload>;
  if (!payload?.frame?.WebId) {
    throw new Error(`envelope ${envelope.messageId} carries no PI frame`);
  }
  return { frame: payload.frame, attributes: payload.attributes ?? {} };
}

function isoOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
