import type { ReactNode } from 'react';
import { PageGate } from '@/features/admin/shared/page-gate';
import type { CapabilityKey } from '@/features/auth/capabilities';
import { useCapabilities } from '@/features/auth/use-capabilities';

export interface IntegrationPageGateProps {
  title: string;
  /** the capability the page needs; the Integration section is SuperAdmin-only by default */
  requires?: Extract<CapabilityKey, 'canReachIntegration' | 'canReviewSourcePriority' | 'canReviewSourceStatusRules'>;
  children: ReactNode;
}

/**
 * Page gate of the Integration section (owner 18 Oct 2026): SuperAdmin only, except the two maker-checker
 * review pages that approvers open from the approvals inbox. The route gate checks the same capability;
 * this keeps the page closed even when it is mounted another way. The server stays authoritative.
 */
export function IntegrationPageGate({ title, requires = 'canReachIntegration', children }: IntegrationPageGateProps) {
  const capabilities = useCapabilities();
  return (
    <PageGate title={title} allowed={capabilities[requires]} deniedText="The Integration section is available to SuperAdmin only.">
      {children}
    </PageGate>
  );
}
