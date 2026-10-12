import { Badge } from '@/components/ui/badge';

/** Active / deactivated as a word on a badge (status is never colour-only). */
export function UserStatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? <Badge variant="secondary">Active</Badge> : <Badge variant="destructive">Deactivated</Badge>;
}
