import { createContext, useContext } from 'react';
import type { CodeView } from '@/api/v2/types/flags';
import type { UnitView } from '@/api/v2/types/units';

/** What every Event Hub component shares: plant timezone, acting tenant and scoped reference data. */
export interface EventHubEnv {
  tenantId: string;
  timezone: string;
  timezoneIsFallback: boolean;
  units: UnitView[];
  unitsLoading: boolean;
  reasonCodes: CodeView[];
  unitName: (id: string | null | undefined) => string;
  reasonName: (id: string | null | undefined) => string;
}

export const EventHubEnvContext = createContext<EventHubEnv | null>(null);

export function useEventHubEnv(): EventHubEnv {
  const env = useContext(EventHubEnvContext);
  if (!env) throw new Error('useEventHubEnv must be used inside EventHubEnvProvider');
  return env;
}
