import { LinkedQuarantine } from '../intake/normalization/normalization-handler';
import type { FrameResult } from './pi-frame-ingest.service';

/** Attribute names a reason token arrives under (PI default rule, MQTT contract v1, short form). */
const REASON_ATTRIBUTES = ['ReasonCode', 'Reason Code', 'Reason'] as const;

/**
 * A reason token delivered but not a code of the tenant (PI frame or MQTT event): the event is created
 * uncoded and the token is parked as an open `unknown_code` item, so a missing code-library entry is
 * seen in the quarantine instead of only as an uncoded event.
 */
export function unresolvedReason(
  result: FrameResult,
  attributes: Readonly<Record<string, unknown>>,
): LinkedQuarantine | null {
  const unresolved = result.diagnostics.find(
    (entry) => entry.code === 'CODE_UNRESOLVED' && entry.field === 'reason',
  );
  if (!unresolved) return null;
  const named = REASON_ATTRIBUTES.find((name) => attributes[name] != null);
  return {
    errorCode: 'unknown_code',
    detail: {
      reason: unresolved.message,
      field: 'reason',
      delivered: named ? attributes[named] : null,
    },
  };
}
