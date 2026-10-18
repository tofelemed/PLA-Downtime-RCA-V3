import { StatusBadge } from '@/features/ux-kit/status-badge';

/** Active / deactivated as a word on a badge (status is never colour-only); deactivated is a state, not an alarm. */
export function UserStatusBadge({ isActive }: { isActive: boolean }) {
  return <StatusBadge tone={isActive ? 'success' : 'neutral'}>{isActive ? 'Active' : 'Deactivated'}</StatusBadge>;
}
