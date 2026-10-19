import type { CodingGateView } from '@/api/v2/types/stop-coding';

/**
 * Why "Verify this shift's stops" is unavailable (QA planning, disabled buttons give reasons): nothing
 * waits for verification because every stop is verified, or because the remaining stops are not coded yet
 * (only coded or investigation-pending stops are verified). Null while stops wait.
 */
export function verifyBlockedReason(gate: Pick<CodingGateView, 'uncoded' | 'verification'>): string | null {
  if (gate.verification.unverified > 0) return null;
  if (gate.uncoded > 0) return 'Code the uncoded stops first: only stops with a reason or “investigation pending” are verified.';
  return 'Every coded stop of this shift is already verified.';
}
