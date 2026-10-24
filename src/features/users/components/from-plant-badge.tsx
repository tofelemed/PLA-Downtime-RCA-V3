import type { UserView } from '@/api/v2/types/administration';
import { Badge } from '@/components/ui/badge';
import { useFromOtherPlant } from './use-from-other-plant';

/** "From <home plant>" on a user granted into the selected plant from another plant; nothing otherwise. */
export function FromPlantBadge({ user }: { user: Pick<UserView, 'tenantId' | 'tenantName'> }) {
  const fromOtherPlant = useFromOtherPlant(user);
  if (!fromOtherPlant) return null;
  return <Badge variant="outline" className="whitespace-nowrap">From {user.tenantName ?? 'another plant'}</Badge>;
}
