import { createContext, useContext } from 'react';
import type { RcaCaseView } from '@/api/v2/types/rca';

/** The case every sub-page of `/rca/:caseId/*` works on, loaded once by the workspace. */
export interface CaseWorkspaceValue {
  rca: RcaCaseView;
  /** true when nothing may be changed here: the user cannot write RCA cases, or the investigation is closed */
  readOnly: boolean;
  /** the user's roles may write RCA cases (workflow moves such as Reopen stay available on a closed one) */
  canWrite: boolean;
  /** QA H1: the investigation is closed and frozen — reopening it is the only way to change it */
  closed: boolean;
  /** base path of the case, `/rca/<id>` */
  basePath: string;
}

export const CaseWorkspaceContext = createContext<CaseWorkspaceValue | null>(null);

export function useCaseWorkspace(): CaseWorkspaceValue {
  const value = useContext(CaseWorkspaceContext);
  if (!value) throw new Error('useCaseWorkspace outside the RCA case workspace');
  return value;
}

/** The case workspace when rendered inside one (shared action components also render outside). */
export function useOptionalCaseWorkspace(): CaseWorkspaceValue | null {
  return useContext(CaseWorkspaceContext);
}
