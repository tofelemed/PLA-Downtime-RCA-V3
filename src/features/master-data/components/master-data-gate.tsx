import type { ReactNode } from 'react';
import { useCapabilities } from '@/features/auth/use-capabilities';

/**
 * Master data is for SuperAdmin, OrgAdmin, TenantAdmin and master-data administrators (the menu's
 * capability); anyone else reaching a master-data URL gets the refusal text instead of the page.
 */
export function MasterDataGate({ children }: { children: ReactNode }) {
  const { canManageMasterData } = useCapabilities();
  if (!canManageMasterData) {
    return (
      <p className="py-12 text-center text-muted-foreground">You don&apos;t have permission to access master data management.</p>
    );
  }
  return <>{children}</>;
}

