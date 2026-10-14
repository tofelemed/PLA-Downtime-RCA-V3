import { v2Request } from '../client';
import type { BodyOf } from '../schema-types';
import type { VersionState } from '../types/profiles';
import type { DemandStatusView, WithRevaluation } from '../types/valuation';
import { v2 } from '../v2';
import { usePagedQuery } from './use-paged-query';
import { useFinanceCommand } from './valuation';

export type DemandStatusCreateBody = BodyOf<'/api/v2/demand-statuses', 'post'>;

export interface DemandStatusFilters {
  productId?: string;
  state?: VersionState;
}

/** Demand status versions of the tenant (SME V3), filtered on the server, keyset on effectiveFrom. */
export function useDemandStatuses(filters: DemandStatusFilters) {
  const query = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== '')) as Record<string, string>;
  return usePagedQuery<DemandStatusView>({
    resource: 'valuation',
    path: '/demand-statuses',
    query,
    key: { filters: { kind: 'demand-statuses', ...query } },
  });
}

export function useCreateDemandStatus() {
  return useFinanceCommand<DemandStatusCreateBody, DemandStatusView>('demand_status', async (body, idempotencyKey) =>
    (await v2.post<DemandStatusView, '/api/v2/demand-statuses'>('/api/v2/demand-statuses', { body, idempotencyKey })).data,
  );
}

export interface DemandTransition {
  id: string;
  action: 'approve' | 'retire';
  supersede?: boolean;
}

/** Approve (finance approver, never the author) or retire; the answer names the revaluation it queued. */
export function useDemandTransition() {
  return useFinanceCommand<DemandTransition, DemandStatusView & WithRevaluation>('demand_status', async (input, idempotencyKey) =>
    (await v2Request<DemandStatusView & WithRevaluation>({
      method: 'POST',
      path: `/demand-statuses/${input.id}/${input.action}`,
      body: input.action === 'approve' ? { supersede: input.supersede === true } : {},
      idempotencyKey,
    })).data,
  );
}
