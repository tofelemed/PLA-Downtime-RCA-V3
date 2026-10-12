import { useEffect, type ReactNode } from 'react';
import { useFlag } from '@/api/v2/queries/feature-flags';
import type { FeatureFlagKey } from '@/api/v2/types/flags';
import { DataState } from '@/features/ux-kit/data-state';

export interface FlaggedRouteProps {
  flag: FeatureFlagKey;
  /** current screen (default while the flag is off, unknown or unreachable — decision C4) */
  v1: ReactNode;
  /** v2 binding of the same screen */
  v2: ReactNode;
  /** downloads the v2 chunk while the flags load, so the page chunk and `/feature-flags` overlap */
  preloadV2?: () => Promise<unknown>;
}

/**
 * Route-level switch between a screen's v1 and v2 binding from the server-side flag (plan 3.1 step 5,
 * MIG02): pilot units flip screens without a redeploy.
 */
export function FlaggedRoute({ flag, v1, v2, preloadV2 }: FlaggedRouteProps) {
  const state = useFlag(flag);
  useEffect(() => {
    if (state.loading && preloadV2) void preloadV2().catch(() => undefined);
  }, [state.loading, preloadV2]);
  if (state.loading) return <DataState state="loading" />;
  return <>{state.enabled ? v2 : v1}</>;
}
