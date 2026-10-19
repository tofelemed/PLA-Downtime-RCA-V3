import { useFeatureFlags } from '@/api/v2/queries/feature-flags';
import type { FeatureFlagKey } from '@/api/v2/types/flags';
import { NAVIGATION_FLAGS } from '@/features/auth/navigation-items';

/** `{flag: on}` for the flags the menu depends on (unknown / unreachable = off, decision C4). */
export function useMenuFlags(): Partial<Record<FeatureFlagKey, boolean>> {
  const { data } = useFeatureFlags();
  return Object.fromEntries(
    NAVIGATION_FLAGS.map((key) => [key, data?.items.find((flag) => flag.key === key)?.enabled === true]),
  );
}
