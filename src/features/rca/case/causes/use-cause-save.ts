import { useCreateRcaCause, useUpdateRcaCause } from '@/api/v2/queries/rca-commands';
import type { RcaCaseCauseView } from '@/api/v2/types/rca-causes';
import { buildCauseBody, buildCausePatch, type CauseForm } from '../../model/cause-form';

/** Item 7: saves a new cause (Idempotency-Key) or the changes of one (If-Match); resolves true when saved. */
export function useCauseSave(rcaId: string, cause: RcaCaseCauseView | undefined) {
  const create = useCreateRcaCause();
  const update = useUpdateRcaCause();
  const command = cause ? update : create;
  const save = async (form: CauseForm): Promise<boolean> => {
    const saved = cause
      ? await update.submit({ cause, body: buildCausePatch(form, cause) }).catch(() => null)
      : await create.submit({ rcaId, body: buildCauseBody(form) }).catch(() => null);
    return saved !== null;
  };
  return { save, isPending: command.isPending, error: command.error };
}
