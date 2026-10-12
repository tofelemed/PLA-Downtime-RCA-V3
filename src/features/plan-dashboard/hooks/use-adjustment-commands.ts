import { v2Request } from '@/api/v2/client';
import type { ChangeNotice } from '@/api/v2/queries/invalidation';
import { useV2Command } from '@/api/v2/queries/use-v2-command';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { PeriodAdjustmentView } from '@/api/v2/types/periods';

/** `POST /actuals/adjustments` body (AdjustmentCreateDto): only these fields (the API refuses extra ones). */
export interface AdjustmentProposal {
  sliceId: string;
  kind: 'gross' | 'good' | 'reject' | 'rework';
  /** signed decimal text in the slice quantity unit, not zero */
  quantity: string;
  basis: 'measured' | 'estimated';
  reason: string;
  evidenceRef: string;
  windowFrom?: string;
  windowTo?: string;
}

export interface AdjustmentDecision {
  id: string;
  reason?: string;
}

/** An adjustment changes the period's actuals and, once approved, its recalculated figures. */
function usePeriodNotice() {
  const tenantId = useV2TenantId();
  return (): ChangeNotice | null => (tenantId ? { tenantId, entityType: 'production_period', window: null } : null);
}

const post = async (path: string, body: unknown, idempotencyKey: string) =>
  (await v2Request<PeriodAdjustmentView>({ method: 'POST', path, body, idempotencyKey })).data;

/** A production engineer (or manager approver) proposes a governed correction of a slice's actuals. */
export function useProposeAdjustment() {
  const changes = usePeriodNotice();
  return useV2Command<AdjustmentProposal, PeriodAdjustmentView>({ run: ({ input, idempotencyKey }) => post('/actuals/adjustments', input, idempotencyKey), changes });
}

/** A manager approver who is not the author approves (the period is recalculated) or rejects with a reason. */
export function useDecideAdjustment(decision: 'approve' | 'reject') {
  const changes = usePeriodNotice();
  return useV2Command<AdjustmentDecision, PeriodAdjustmentView>({
    run: ({ input, idempotencyKey }) => post(`/actuals/adjustments/${input.id}/${decision}`, input.reason ? { reason: input.reason } : {}, idempotencyKey),
    changes,
  });
}
