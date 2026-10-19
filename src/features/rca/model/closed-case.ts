import type { RcaCaseView } from '@/api/v2/types/rca';

/** QA H1: what a closed investigation tells its writers where edit controls would be. */
export const CLOSED_CASE_NOTICE = 'Closed investigation — reopen to change';

/** The investigation's closure was approved: it is frozen (the server answers 409 CASE_CLOSED). */
export const isClosedCase = (rca: Pick<RcaCaseView, 'status'>): boolean => rca.status === 'Closed';

/** The workspace's access: nothing is editable on a closed investigation; its workflow (Reopen) still is. */
export function workspaceAccess(rca: Pick<RcaCaseView, 'status'>, canWriteRca: boolean): { readOnly: boolean; canWrite: boolean; closed: boolean } {
  const closed = isClosedCase(rca);
  return { readOnly: !canWriteRca || closed, canWrite: canWriteRca, closed };
}
