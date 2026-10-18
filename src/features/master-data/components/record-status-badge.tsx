import { StatusBadge } from '@/features/ux-kit/status-badge';

/** "Active" / "Retired" as a badge with a word (never colour alone). */
export function RecordStatusBadge({ retired }: { retired: boolean }) {
  return <StatusBadge tone={retired ? 'neutral' : 'success'}>{retired ? 'Retired' : 'Active'}</StatusBadge>;
}
