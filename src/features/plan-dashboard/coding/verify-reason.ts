import type { CodingGateView } from '@/api/v2/types/stop-coding';
import { plural } from '@/features/ux-kit/format/plural';

/**
 * Why "Verify this shift's stops" is unavailable (QA planning, disabled buttons give reasons; re-test N8):
 * a shift is verified once every stop is coded — while any stop is uncoded the supervisor codes it first
 * (the server never verifies an uncoded stop: NOT_CODED). Otherwise nothing waits because every coded stop
 * is verified. Null while coded stops wait for verification.
 */
export function verifyBlockedReason(
  gate: Pick<CodingGateView, 'uncoded' | 'verification'>,
  formatCount?: (value: number) => string,
): string | null {
  const why = 'only stops with a reason or “investigation pending” are verified.';
  if (gate.uncoded === 1) return `Code the stop first: ${why}`;
  if (gate.uncoded > 1) return `Code the ${plural(gate.uncoded, 'uncoded stop', 'uncoded stops', formatCount)} first: ${why}`;
  if (gate.verification.unverified > 0) return null;
  return 'Every coded stop of this shift is already verified.';
}
