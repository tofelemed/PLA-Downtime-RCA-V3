import { createContext, useContext } from 'react';
import type { RcaCaseView } from '@/api/v2/types/rca';

/** The case every sub-page of `/rca/:caseId/*` works on, loaded once by the workspace. */
export interface CaseWorkspaceValue {
  rca: RcaCaseView;
  /** true for users who may read but not write RCA cases */
  readOnly: boolean;
  /** base path of the case, `/rca/<id>` */
  basePath: string;
}

export const CaseWorkspaceContext = createContext<CaseWorkspaceValue | null>(null);

export function useCaseWorkspace(): CaseWorkspaceValue {
  const value = useContext(CaseWorkspaceContext);
  if (!value) throw new Error('useCaseWorkspace outside the RCA case workspace');
  return value;
}
