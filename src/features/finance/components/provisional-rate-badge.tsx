import { StatusBadge } from '@/features/ux-kit/status-badge';
import { StatusIcon } from '@/lib/icons';

/** SME V7: marks an authorised provisional exchange rate (in words, never colour alone): a warning, not an alarm. */
export function ProvisionalRateBadge({ provisional }: { provisional: boolean }) {
  if (!provisional) return null;
  return (
    <StatusBadge tone="warning" icon={StatusIcon.warning} data-testid="fx-provisional-badge">
      Provisional
    </StatusBadge>
  );
}
