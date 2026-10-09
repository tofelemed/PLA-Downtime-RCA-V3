import type { ReactNode } from 'react';
import { useFlag } from '@/api/v2/queries/feature-flags';
import type { FeatureFlagKey } from '@/api/v2/types/flags';
import { DataState } from '@/features/ux-kit/data-state';

export interface FlaggedRouteProps {
  flag: FeatureFlagKey;
  /** current screen (default while the flag is off, unknown or unreachable — decision C4) */
  v1: ReactNode;
  /** v2 binding of the same screen */
  v2: ReactNode;
}

/**
 * Route-level switch between a screen's v1 and v2 binding from the server-side flag (plan 3.1 step 5,
 * MIG02): pilot units flip screens without a redeploy.
 */
export function FlaggedRoute({ flag, v1, v2 }: FlaggedRouteProps) {
  const state = useFlag(flag);
  if (state.loading) return <DataState state="loading" />;
  return <>{state.enabled ? v2 : v1}</>;
}
