import { v2Request } from '@/api/v2/client';
import type { ChangeNotice } from '@/api/v2/queries/invalidation';
import { useV2Command } from '@/api/v2/queries/use-v2-command';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { LotDispositionView } from '@/api/v2/types/periods';
import type { DispositionProposal } from '../model/disposition-form';

export interface DispositionDecision {
  id: string;
  reason?: string;
}

/** A disposition reclassifies the actuals of its production interval once approved (periods are recalculated). */
function usePeriodNotice() {
  const tenantId = useV2TenantId();
  return (): ChangeNotice | null => (tenantId ? { tenantId, entityType: 'production_period', window: null } : null);
}

const post = async (path: string, body: unknown, idempotencyKey: string) =>
  (await v2Request<LotDispositionView>({ method: 'POST', path, body, idempotencyKey })).data;

/** SME E3: an operator or production engineer records a lot disposition or a recovery movement. */
export function useProposeDisposition() {
  const changes = usePeriodNotice();
  return useV2Command<DispositionProposal, LotDispositionView>({ run: ({ input, idempotencyKey }) => post('/lot-dispositions', input, idempotencyKey), changes });
}

/** A manager approver who is not the author approves (the periods are recalculated) or rejects with a reason. */
export function useDecideDisposition(decision: 'approve' | 'reject') {
  const changes = usePeriodNotice();
  return useV2Command<DispositionDecision, LotDispositionView>({
    run: ({ input, idempotencyKey }) => post(`/lot-dispositions/${input.id}/${decision}`, input.reason ? { reason: input.reason } : {}, idempotencyKey),
    changes,
  });
}
