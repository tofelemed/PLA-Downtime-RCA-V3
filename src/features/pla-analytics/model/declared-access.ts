import type { PlaView } from '@/features/analysis-navigation/analysis-pages';

export const DECLARED_NOT_AVAILABLE = 'Not available: this plant accounts declared losses';

/** Pages built on the capacity ledger and the sustained rate, which declared mode does not compute. */
const CAPACITY_BASED: ReadonlySet<PlaView> = new Set(['oee', 'capacity']);

export function isCapacityBasedPage(view: PlaView): boolean {
  return CAPACITY_BASED.has(view);
}

/** The pages the menu offers: declared losses have no capacity ledger, so OEE and Capacity gap are left out. */
export function declaredPagesFor<T extends { key: string }>(pages: readonly T[], declared: boolean): T[] {
  return declared ? pages.filter((page) => !CAPACITY_BASED.has(page.key as PlaView)) : [...pages];
}
