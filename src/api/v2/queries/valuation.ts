import { v2Request } from '../client';
import type { BodyOf } from '../schema-types';
import type { FxRateView, ValuationPolicyView } from '../types/valuation';
import type { VersionState } from '../types/profiles';
import { v2 } from '../v2';
import type { ChangeNotice } from './invalidation';
import { useV2Command } from './use-v2-command';
import { flattenPages, useV2InfiniteList } from './use-v2-list';
import { useV2TenantId } from './use-v2-tenant';

export type FxRateCreateBody = BodyOf<'/api/v2/fx-rates', 'post'>;
export type ValuationPolicyCreateBody = BodyOf<'/api/v2/valuation-policies', 'post'>;

export interface FxRateFilters {
  fromCurrency?: string;
  toCurrency?: string;
  state?: VersionState;
}

const defined = (filters: FxRateFilters) =>
  Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== '')) as Record<string, string>;

/** FX rate versions of the tenant (plan 2.6), filtered on the server, keyset on effectiveFrom. */
export function useFxRates(filters: FxRateFilters) {
  const query = defined(filters);
  const list = useV2InfiniteList<FxRateView>({
    resource: 'valuation',
    path: '/fx-rates',
    query: { ...query, limit: 200 },
    key: { filters: { kind: 'fx-rates', ...query } },
  });
  return { ...list, items: flattenPages(list.data?.pages) };
}

/** Valuation policy versions of the tenant, newest first (the server seeds v2 IRR / USD on first use). */
export function useValuationPolicies() {
  const list = useV2InfiniteList<ValuationPolicyView>({
    resource: 'valuation',
    path: '/valuation-policies',
    query: { limit: 100 },
    key: { filters: { kind: 'valuation-policies' } },
  });
  return { ...list, items: flattenPages(list.data?.pages) };
}

/** A finance change: the FX / policy lists refresh. Approvals never recalculate periods (plan 2.6). */
function useFinanceCommand<TInput, TResult>(entityType: string, run: (input: TInput, idempotencyKey: string) => Promise<TResult>) {
  const tenantId = useV2TenantId();
  const notice = (): ChangeNotice | null => (tenantId ? { tenantId, entityType, window: null } : null);
  return useV2Command<TInput, TResult>({ run: ({ input, idempotencyKey }) => run(input, idempotencyKey), changes: notice });
}

export function useCreateFxRate() {
  return useFinanceCommand<FxRateCreateBody, FxRateView>('fx_rate', async (body, idempotencyKey) =>
    (await v2.post<FxRateView, '/api/v2/fx-rates'>('/api/v2/fx-rates', { body, idempotencyKey })).data,
  );
}

export interface FxTransition {
  id: string;
  action: 'approve' | 'retire';
  /** approve only: close the one approved predecessor of the pair at this version's effectiveFrom */
  supersede?: boolean;
}

/** Approve (409 VERSION_OVERLAP with `details.conflicts`) or retire an FX rate version; the server checks the role. */
export function useFxTransition() {
  return useFinanceCommand<FxTransition, FxRateView>('fx_rate', async (input, idempotencyKey) =>
    (await v2Request<FxRateView>({
      method: 'POST',
      path: `/fx-rates/${input.id}/${input.action}`,
      body: input.action === 'approve' ? { supersede: input.supersede === true } : {},
      idempotencyKey,
    })).data,
  );
}

export function useCreateValuationPolicy() {
  return useFinanceCommand<ValuationPolicyCreateBody, ValuationPolicyView>('valuation_policy', async (body, idempotencyKey) =>
    (await v2.post<ValuationPolicyView, '/api/v2/valuation-policies'>('/api/v2/valuation-policies', { body, idempotencyKey })).data,
  );
}

/** Finance sign-off (VAL01): 403 SEPARATION_OF_DUTIES for the author, 422 CURRENCY_UNDECIDED for XXX. */
export function useApproveValuationPolicy() {
  return useFinanceCommand<{ id: string }, ValuationPolicyView>('valuation_policy', async (input, idempotencyKey) =>
    (await v2Request<ValuationPolicyView>({ method: 'POST', path: `/valuation-policies/${input.id}/approve`, body: {}, idempotencyKey })).data,
  );
}
