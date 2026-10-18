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
  /** every reason code, retired ones included (pickers keep a retired current value, FE-04 / FE-05) */
  allReasonCodes: CodeView[];
  unitName: (id: string | null | undefined) => string;
  /** C-10: the unit's code when it differs from its name (secondary text); null when they are the same */
  unitCode?: (id: string | null | undefined) => string | null;
  reasonName: (id: string | null | undefined) => string;
}

export const EventHubEnvContext = createContext<EventHubEnv | null>(null);

export function useEventHubEnv(): EventHubEnv {
  const env = useContext(EventHubEnvContext);
  if (!env) throw new Error('useEventHubEnv must be used inside EventHubEnvProvider');
  return env;
}
