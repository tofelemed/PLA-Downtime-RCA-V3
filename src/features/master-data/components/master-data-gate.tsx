import type { ReactNode } from 'react';
import { useCapabilities } from '@/features/auth/use-capabilities';

/**
 * Master data is for SuperAdmin, OrgAdmin, TenantAdmin and master-data administrators (the menu's
 * capability); a page may also admit the roles that write its records (`alsoAllowed`, e.g. reliability
 * engineers on the work-order page). Anyone else reaching a master-data URL gets the refusal text.
 */
export function MasterDataGate({ children, alsoAllowed = false }: { children: ReactNode; alsoAllowed?: boolean }) {
  const { canManageMasterData } = useCapabilities();
  if (!canManageMasterData && !alsoAllowed) {
    return (
      <p className="py-12 text-center text-muted-foreground">You don&apos;t have permission to access master data management.</p>
    );
  }
  return <>{children}</>;
}

