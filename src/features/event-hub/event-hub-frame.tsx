import type { ReactNode } from 'react';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { DataState } from '@/features/ux-kit/data-state';
import { EventHubEnvProvider } from './event-hub-env';

export interface EventHubFrameProps {
  children: ReactNode;
  /** shown when no plant is chosen */
  noTenantText?: string;
}

/** Acting plant check and the shared Event Hub environment (zone, units, reasons) of every event route. */
export function EventHubFrame({ children, noTenantText = 'Choose a plant to see its events.' }: EventHubFrameProps) {
  const tenantId = useV2TenantId();
  if (!tenantId) return <DataState state="no-permission" detail={noTenantText} />;
  return <EventHubEnvProvider tenantId={tenantId}>{children}</EventHubEnvProvider>;
}
