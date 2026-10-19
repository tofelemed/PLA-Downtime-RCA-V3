import type { RcaCaseView } from '@/api/v2/types/rca';
import { workspaceAccess } from '../model/closed-case';
import type { CaseWorkspaceValue } from './case-context';

/** The workspace value of a loaded case for the signed-in user's RCA write capability (QA H1: closed = read-only). */
export const workspaceOf = (rca: RcaCaseView, canWriteRca: boolean): CaseWorkspaceValue => ({
  rca,
  ...workspaceAccess(rca, canWriteRca),
  basePath: `/rca/${rca.id}`,
});
