import { CanonicalEnvelope } from './envelope/canonical-envelope';
import { payloadHash } from './envelope/envelope-validator';

/** The version a source object currently holds (from `source_objects`). */
export interface StoredVersion {
  hash: string;
  observedAt: Date;
  revision: string | null;
}

/** The version a new delivery carries. */
export type IncomingVersion = StoredVersion;

/**
 * What intake does with a delivery of a known message-id-new record (spec §5.1, ING01, FND04):
 * - `accepted`          first version of the source object
 * - `duplicate_content` same content as the stored version (redelivery under a new message id)
 * - `revision`          provably newer: becomes the latest version
 * - `stale`             provably older (out of order): kept raw, never overwrites
 * - `conflict`          different content and the order cannot be proven: quarantined, never overwrites
 */
export type OrderingDecision =
  | 'accepted'
  | 'duplicate_content'
  | 'revision'
  | 'stale'
  | 'conflict';

/**
 * Order = source observation time; on a tie a numeric source revision decides (sequence numbers,
 * offsets). Equal times with no comparable revision cannot be ordered: conflict instead of overwrite.
 */
export function decideOrdering(
  stored: StoredVersion | null,
  incoming: IncomingVersion,
): OrderingDecision {
  if (!stored) return 'accepted';
  if (stored.hash === incoming.hash) return 'duplicate_content';
  const byTime = incoming.observedAt.getTime() - stored.observedAt.getTime();
  if (byTime !== 0) return byTime > 0 ? 'revision' : 'stale';
  const byRevision = compareRevisions(stored.revision, incoming.revision);
  if (byRevision === null || byRevision === 0) return 'conflict';
  return byRevision > 0 ? 'revision' : 'stale';
}

/** incoming − stored for two numeric revisions; null when they are not comparable. */
function compareRevisions(
  stored: string | null,
  incoming: string | null,
): number | null {
  if (stored === null || incoming === null) return null;
  if (!/^\d+$/.test(stored) || !/^\d+$/.test(incoming)) return null;
  const difference = BigInt(incoming) - BigInt(stored);
  return difference === 0n ? 0 : difference > 0n ? 1 : -1;
}

/**
 * Hash of the business content of an envelope: everything except delivery fields (message id, receive
 * and observation times, provenance), so the same content delivered twice hashes equally.
 */
export function contentHashOf(envelope: CanonicalEnvelope): string {
  return payloadHash({
    kind: envelope.kind,
    operation: envelope.operation,
    sourceRevision: envelope.sourceRevision ?? null,
    startTime: envelope.startTime ?? null,
    endTime: envelope.endTime ?? null,
    location: envelope.location,
    values: envelope.values ?? null,
    quality: envelope.quality,
    retraction: envelope.retraction ?? null,
    rawPayloadHash: envelope.provenance.payloadHash,
  });
}
