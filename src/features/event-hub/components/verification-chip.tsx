import { useMemo } from 'react';
import type { ProductionEventView } from '@/api/v2/types/events';
import { StatusBadge } from '@/features/ux-kit/status-badge';
import { actorText } from '@/features/ux-kit/labels/actor-labels';
import { useUserNames } from '@/features/ux-kit/labels/use-user-names';

/**
 * E-10: SME D13 supervisor verification of a stop's coding as a chip next to its states ("Verified by
 * A. Karimi" / "Not verified"), from the server's verification record; nothing for other events.
 */
export function VerificationChip({ event }: { event: ProductionEventView }) {
  const verification = event.verification;
  const ids = useMemo(() => [verification?.verifiedBy ?? null], [verification]);
  const users = useUserNames(ids);
  if (event.classification.physicalType !== 'downtime' || !verification) return null;
  if (!verification.verifiedAt) {
    return (
      <StatusBadge tone="neutral" data-testid="verification-chip" data-verified="false">
        Not verified
      </StatusBadge>
    );
  }
  return (
    <StatusBadge tone="success" data-testid="verification-chip" data-verified="true">
      Verified by {actorText({ id: verification.verifiedBy }, users.nameOf)}
    </StatusBadge>
  );
}
