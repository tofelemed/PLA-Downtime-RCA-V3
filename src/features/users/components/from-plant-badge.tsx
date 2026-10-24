import type { UserView } from '@/api/v2/types/administration';
import { Badge } from '@/components/ui/badge';
import { useFromOtherPlant } from './use-from-other-plant';

type BadgeUser = Pick<UserView, 'tenantId' | 'tenantName' | 'organizationName'>;

/** Where a user without a home plant belongs: its organization, else "All plants" (super administrators). */
const placeWithoutPlant = (user: BadgeUser) => user.organizationName ?? 'All plants';

/**
 * Where a user comes from when it is not the selected plant: "From <home plant>" for a user granted in from
 * another plant, "<organization>" / "All plants" for a user without a home plant; nothing for the plant's own.
 */
export function FromPlantBadge({ user }: { user: BadgeUser }) {
  const fromOtherPlant = useFromOtherPlant(user);
  if (!user.tenantId) return <Badge variant="outline" className="whitespace-nowrap">{placeWithoutPlant(user)}</Badge>;
  if (!fromOtherPlant) return null;
  return <Badge variant="outline" className="whitespace-nowrap">From {user.tenantName ?? 'another plant'}</Badge>;
}
