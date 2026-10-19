import type { ProfileView } from '@/api/v2/types/profiles';

/**
 * The quantity unit of a plan's targets: header and slice targets are in the unit of each slice's
 * profile (unit × product), so one unit is named only when every slice's profiles agree on it.
 * Null when they differ or none is known (the summary then says "in the unit of each slice's profile").
 */
export function targetUomOf(profiles: readonly Pick<ProfileView, 'productId' | 'quantityUom'>[], productIds: readonly string[]): string | null {
  const wanted = new Set(productIds);
  const uoms = new Set(profiles.filter((p) => wanted.has(p.productId) && p.quantityUom).map((p) => p.quantityUom as string));
  return uoms.size === 1 ? [...uoms][0] : null;
}
