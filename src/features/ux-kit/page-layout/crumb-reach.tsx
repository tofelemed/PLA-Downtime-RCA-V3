import { createContext, useContext, type ReactNode } from 'react';

/** Whether the signed-in user may open `to` (a path, with or without `?query` / `#hash`). */
export type CrumbReach = (to: string) => boolean;

const everywhere: CrumbReach = () => true;

const CrumbReachContext = createContext<CrumbReach>(everywhere);

/**
 * QA_MASTERDATA L23: a breadcrumb step or back link must not lead to a page the user cannot open. The app
 * provides the route gates' answer; without a provider (isolated tests) every target counts as reachable.
 */
export function CrumbReachProvider({ reach, children }: { reach: CrumbReach; children: ReactNode }) {
  return <CrumbReachContext.Provider value={reach}>{children}</CrumbReachContext.Provider>;
}

export function useCrumbReach(): CrumbReach {
  return useContext(CrumbReachContext);
}
