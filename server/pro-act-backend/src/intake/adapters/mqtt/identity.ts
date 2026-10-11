import { IDENTITY_STRATEGIES } from './payload-profile';

/**
 * Delivery and logical identity of an MQTT message (design §4.2 stage 3, MQ05, contract §4).
 * `messageId` is the dedupe key of one delivery (`raw_identities`); packet ids are never part of it.
 * `sourceObjectId` is the thing the message is about; `sourceRevision` orders versions of it
 * (`decideOrdering`: observation time first, then a numeric revision).
 */
export type IdentityStrategy = (typeof IDENTITY_STRATEGIES)[number];

export interface IdentityParts {
  /** equipment level of the topic, or the topic itself when the profile captures none */
  equipment: string;
  bootId?: string | null;
  seq?: number | null;
  eventId?: string | null;
  revision?: string | null;
  /** `sha256:<hex>` of the canonical payload (`payloadHash`) */
  payloadHash: string;
  /** ISO event time */
  eventTime: string;
}

export type IdentityResult =
  | { ok: true; messageId: string }
  | { ok: false; code: 'SCHEMA_INVALID'; detail: string };

/**
 * The message id under a strategy:
 * - `seq_boot`     `<equipment>:<bootId>:<seq>` (contract delivery identity)
 * - `event_id`     `<eventId>:<revision>` (contract event identity; a re-sent revision is a duplicate)
 * - `payload_hash` `<payloadHash>:<eventTime>` (weakest; for sources without identity fields)
 */
export function messageIdFor(
  strategy: IdentityStrategy,
  parts: IdentityParts,
): IdentityResult {
  if (strategy === 'payload_hash') {
    return { ok: true, messageId: `${parts.payloadHash}:${parts.eventTime}` };
  }
  if (strategy === 'event_id') {
    if (!parts.eventId || !parts.revision) {
      return missing('event_id', 'event_id and revision');
    }
    return { ok: true, messageId: `${parts.eventId}:${parts.revision}` };
  }
  if (!parts.bootId || !isSequence(parts.seq)) {
    return missing('seq_boot', 'boot_id and seq');
  }
  return {
    ok: true,
    messageId: `${parts.equipment}:${parts.bootId}:${parts.seq}`,
  };
}

/** Logical identity of an explicit event: the equipment plus the producer's event id. */
export function eventSourceObjectId(
  equipment: string,
  eventId: string,
): string {
  return `${equipment}:${eventId}`;
}

/** Logical identity of one sample: the topic plus its observation time (contract §4: signal + ts). */
export function sampleSourceObjectId(
  topic: string,
  observedAt: string,
): string {
  return `${topic}@${observedAt}`;
}

/** Revision of a sample or state: the sequence as a string, else the receive time in ms. */
export function sampleSourceRevision(
  seq: number | null | undefined,
  receivedAt: Date,
): string {
  return isSequence(seq) ? String(seq) : String(receivedAt.getTime());
}

/** A revision as the source sent it (RFC 3339 string or integer version), as a string. */
export function revisionOf(raw: unknown): string | null {
  if (typeof raw === 'string') return raw.length > 0 ? raw : null;
  if (typeof raw === 'number' && Number.isInteger(raw)) return String(raw);
  return null;
}

function isSequence(seq: unknown): seq is number {
  return typeof seq === 'number' && Number.isInteger(seq) && seq >= 0;
}

function missing(strategy: IdentityStrategy, fields: string): IdentityResult {
  return {
    ok: false,
    code: 'SCHEMA_INVALID',
    detail: `identityStrategy ${strategy} needs ${fields}`,
  };
}
