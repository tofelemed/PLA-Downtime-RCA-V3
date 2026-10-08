import { RawOutcome } from './entities/raw-observation.entity';

/** Who may deliver into intake: the adapter's authenticated tenant and connection (never the payload). */
export interface IntakeBinding {
  tenantId: string;
  connectionId: string;
}

/** `duplicate` = the message id was retained before (no new raw row). */
export type AcceptStatus = RawOutcome | 'duplicate';

/** A normalisation request written to the outbox (`RawAccepted`) in the accept transaction. */
export interface NormalizationTicket {
  /** inbox delivery key; the relay delivery and an inline run share it */
  key: string;
  rawId: string;
  receivedAt: string;
  tenantId: string;
  connectionId: string;
  sourceObjectId: string;
  replayRunId: string | null;
}

/**
 * Result of `IntakeService.accept`. The adapter may acknowledge / advance its cursor once this
 * resolves: the raw record (or the fact that it was already retained) is committed (FND01).
 */
export interface AcceptResult {
  status: AcceptStatus;
  rawId: string | null;
  sourceObjectId: string;
  /** set when canonical processing was requested (new version, replay, or retry of a quarantine) */
  ticket: NormalizationTicket | null;
}

/** Payload of the `RawAccepted` outbox message. */
export type RawAcceptedPayload = Omit<NormalizationTicket, 'key'>;
