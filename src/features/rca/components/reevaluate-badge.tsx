import { StatusBadge } from '@/features/ux-kit/status-badge';
import { StatusIcon } from '@/lib/icons';

/**
 * D-T3: a closed investigation whose failure mode recurs above its frozen baseline since the closure.
 * The server only recommends; a person reopens the case or dismisses the recommendation.
 */
export function ReevaluateBadge({ title }: { title?: string }) {
  return (
    <StatusBadge tone="warning" icon={StatusIcon.warning} title={title ?? 'The failure mode recurs above its baseline since the closure'} data-testid="reevaluate-badge">
      Re-evaluate
    </StatusBadge>
  );
}
