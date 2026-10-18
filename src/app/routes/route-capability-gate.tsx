import type { ReactNode } from 'react';
import { PageGate } from '@/features/admin/shared/page-gate';
import type { CapabilityKey } from '@/features/auth/capabilities';
import { useCapabilities } from '@/features/auth/use-capabilities';

export interface RouteCapabilityGateProps {
  /** the capability of the selected plant the route needs; none = open to every signed-in user */
  requires?: CapabilityKey;
  /** heading of the denied page */
  title?: string;
  children: ReactNode;
}

/**
 * Route-level capability guard (UX audit B-7): a typed URL the menu would not list shows one denied
 * page (the shared `PageGate`) instead of a page frame full of 403 alerts. The server stays authoritative.
 */
export function RouteCapabilityGate({ requires, title = 'Page', children }: RouteCapabilityGateProps) {
  const capabilities = useCapabilities();
  if (!requires || capabilities[requires]) return <>{children}</>;
  return (
    <PageGate title={title} allowed={false} deniedText={`Your roles in this plant do not include ${title}.`}>
      {null}
    </PageGate>
  );
}
