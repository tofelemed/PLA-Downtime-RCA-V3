import type { ReactNode } from 'react';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';

export interface MasterDataGateProps {
  /** the page's title: heading and document title of the refusal page */
  title: string;
  /** admit the roles that write this page's records besides the master-data administrators */
  alsoAllowed?: boolean;
  children: ReactNode;
}

/**
 * Master data is for SuperAdmin, OrgAdmin, TenantAdmin and master-data administrators (the menu's
 * capability); a page may also admit the roles that write its records (`alsoAllowed`, e.g. reliability
 * engineers on the work-order page). Anyone else reaching a master-data URL gets the standard "No access"
 * page with the page's own heading and document title (QA M4, same layout as `RouteCapabilityGate`).
 */
export function MasterDataGate({ title, children, alsoAllowed = false }: MasterDataGateProps) {
  const { canManageMasterData } = useCapabilities();
  if (canManageMasterData || alsoAllowed) return <>{children}</>;
  return (
    <Page>
      <PageHeader title={title} />
      <DataState state="no-permission" detail={`Your roles in this plant do not include ${title}.`} />
    </Page>
  );
}
