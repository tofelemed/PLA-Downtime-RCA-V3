import { StatusBadge } from '@/features/ux-kit/status-badge';

/** Active / Retired as a word (colour is never the only signal). */
export function CodeStatusBadge({ active }: { active: boolean }) {
  return <StatusBadge tone={active ? 'success' : 'neutral'}>{active ? 'Active' : 'Retired'}</StatusBadge>;
}
