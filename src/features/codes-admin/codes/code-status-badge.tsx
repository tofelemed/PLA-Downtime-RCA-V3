import { Badge } from '@/components/ui/badge';

/** Active / Retired as a word (colour is never the only signal). */
export function CodeStatusBadge({ active }: { active: boolean }) {
  return active ? <Badge variant="outline">Active</Badge> : <Badge variant="secondary">Retired</Badge>;
}
