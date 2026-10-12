import type { ReactNode } from 'react';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { DataState } from '@/features/ux-kit/data-state';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';

export interface PageGateProps {
  title: string;
  /** whether the user's roles in the selected plant reach this page */
  allowed: boolean;
  /** the refusal text, e.g. "You don't have permission to access user management." */
  deniedText: string;
  children: ReactNode;
}

/**
 * Shows the page only with a selected plant and the needed capability; otherwise one header and a
 * plain explanation (the menu already hides the page; this covers a typed URL).
 */
export function PageGate({ title, allowed, deniedText, children }: PageGateProps) {
  const tenantId = useV2TenantId();
  if (tenantId && allowed) return <>{children}</>;
  return (
    <Page>
      <PageHeader title={title} />
      <DataState state="no-permission" detail={tenantId ? deniedText : 'Choose a plant first.'} />
    </Page>
  );
}
