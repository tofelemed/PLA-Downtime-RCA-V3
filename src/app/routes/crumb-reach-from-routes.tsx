import { useCallback, type ReactNode } from 'react';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { CrumbReachProvider } from '@/features/ux-kit/page-layout/crumb-reach';
import { canReachPath } from './route-gates';
import type { AppRoute } from './route-types';

/** Breadcrumbs and back links follow the route gates: a target the user's plant roles cannot open is plain text. */
export function CrumbReachFromRoutes({ routes, children }: { routes: readonly AppRoute[]; children: ReactNode }) {
  const capabilities = useCapabilities();
  const reach = useCallback((to: string) => canReachPath(to, capabilities, routes), [capabilities, routes]);
  return <CrumbReachProvider reach={reach}>{children}</CrumbReachProvider>;
}
