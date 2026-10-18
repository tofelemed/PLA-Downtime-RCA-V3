import { createContext } from 'react';

/** Detail pages expose their own report provenance rather than fetching the overview for metadata. */
export const AnalysisSnapshotContext = createContext<{
  scopeLabel: string;
  timezone: string;
  timezoneIsFallback: boolean;
} | null>(null);
