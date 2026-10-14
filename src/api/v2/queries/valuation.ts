import { useQuery, useQueryClient } from '@tanstack/react-query';
import { v2Request } from '../client';
import type { BodyOf } from '../schema-types';
import type { ListResponse } from '../types/envelopes';
import type { FxRateType, FxRateView, ValuationPolicyView, WithRevaluation } from '../types/valuation';
import type { VersionState } from '../types/profiles';
import { v2 } from '../v2';
import type { ChangeNotice } from './invalidation';
import { carryRevaluation } from './carry-revaluation';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { usePagedQuery } from './use-paged-query';
import { useV2Command } from './use-v2-command';
import { useV2TenantId } from './use-v2-tenant';

/** Safety stop of the approval probe (100 versions per page). */
const MAX_POLICY_PAGES = 10;

export type FxRateCreateBody = BodyOf<'/api/v2/fx-rates', 'post'>;
export type ValuationPolicyCreateBody = BodyOf<'/api/v2/valuation-policies', 'post'>;

export interface FxRateFilters {
  rateType?: FxRateType;
  fromCurrency?: string;
  toCurrency?: string;
  state?: VersionState;
}

const defined = (filters: FxRateFilters) =>
  Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== '')) as Record<string, string>;

/** FX rate versions of the tenant (plan 2.6), filtered on the server, keyset on effectiveFrom, 20 per page. */
export function useFxRates(filters: FxRateFilters) {
  const query = defined(filters);
  return usePagedQuery<FxRateView>({
    resource: 'valuation',
    path: '/fx-rates',
    query,
    key: { filters: { kind: 'fx-rates', ...query } },
  });
}

/** Valuation policy versions of the tenant, newest first, 20 per page (the server seeds IRR / USD on first use). */
export function useValuationPolicies() {
  return usePagedQuery<ValuationPolicyView>({
    resource: 'valuation',
    path: '/valuation-policies',
    query: {},
    key: { filters: { kind: 'valuation-policies' } },
  });
}

/**
 * Whether any valuation policy version carries the finance approval (none → every loss stays "unvalued,
 * policy pending"). Reads the version pages until one approved version is found (a tenant has a handful).
 */
export function useAnyApprovedPolicy() {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.list(tenantId ?? '-', 'valuation', { filters: { kind: 'valuation-policies', approvedProbe: true } }),
    enabled: Boolean(tenantId),
    staleTime: STALE_TIME.valuation,
    queryFn: async ({ signal }) => {
      let cursor: string | undefined;
      for (let page = 0; page < MAX_POLICY_PAGES; page += 1) {
        const response = await v2Request<ListResponse<ValuationPolicyView>>({ method: 'GET', path: '/valuation-policies', query: { limit: 100, cursor }, signal });
        if (response.data.items.some((policy) => policy.approved)) return true;
        if (!response.data.nextCursor) return false;
        cursor = response.data.nextCursor;
      }
      return false;
    },
  });
}

function useValuationDetail<T extends { id: string } & WithRevaluation>(path: 'fx-rates' | 'valuation-policies', id: string | null) {
  const tenantId = useV2TenantId();
  const client = useQueryClient();
  const queryKey = v2Keys.detail(tenantId ?? '-', 'valuation', id ?? '-', path);
  return useQuery({
    queryKey,
    enabled: Boolean(tenantId && id),
    staleTime: STALE_TIME.valuation,
    queryFn: async ({ signal }) => {
      const fresh = (await v2Request<T>({ method: 'GET', path: `/${path}/${id as string}`, signal })).data;
      return carryRevaluation(client.getQueryData<T>(queryKey), fresh);
    },
  });
}

/** One FX rate version (the detail page). */
export const useFxRate = (id: string | null) => useValuationDetail<FxRateView & WithRevaluation>('fx-rates', id);

/** One valuation policy version (the detail page and "new version from this"). */
export const useValuationPolicy = (id: string | null) => useValuationDetail<ValuationPolicyView & WithRevaluation>('valuation-policies', id);

/** A finance change: the FX / policy / demand lists refresh; an approval's revaluation runs on the server (SME V7). */
export function useFinanceCommand<TInput, TResult>(entityType: string, run: (input: TInput, idempotencyKey: string) => Promise<TResult>) {
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

/** Writes a command's answer into the version's detail cache, so its page shows the new state even if a refetch was already running. */
function useDetailWriter<T extends { id: string }>(path: 'fx-rates' | 'valuation-policies') {
  const tenantId = useV2TenantId();
  const client = useQueryClient();
  return (view: T): T => {
    client.setQueryData(v2Keys.detail(tenantId ?? '-', 'valuation', view.id, path), view);
    return view;
  };
}

/** Approve (409 VERSION_OVERLAP with `details.conflicts`) or retire an FX rate version; the server checks the role. */
export function useFxTransition() {
  const write = useDetailWriter<FxRateView & WithRevaluation>('fx-rates');
  return useFinanceCommand<FxTransition, FxRateView & WithRevaluation>('fx_rate', async (input, idempotencyKey) =>
    write((await v2Request<FxRateView & WithRevaluation>({
      method: 'POST',
      path: `/fx-rates/${input.id}/${input.action}`,
      body: input.action === 'approve' ? { supersede: input.supersede === true } : {},
      idempotencyKey,
    })).data),
  );
}

export function useCreateValuationPolicy() {
  return useFinanceCommand<ValuationPolicyCreateBody, ValuationPolicyView>('valuation_policy', async (body, idempotencyKey) =>
    (await v2.post<ValuationPolicyView, '/api/v2/valuation-policies'>('/api/v2/valuation-policies', { body, idempotencyKey })).data,
  );
}

/** Finance sign-off (VAL01): 403 SEPARATION_OF_DUTIES for the author, 422 CURRENCY_UNDECIDED for the placeholder. */
export function useApproveValuationPolicy() {
  const write = useDetailWriter<ValuationPolicyView & WithRevaluation>('valuation-policies');
  return useFinanceCommand<{ id: string }, ValuationPolicyView & WithRevaluation>('valuation_policy', async (input, idempotencyKey) =>
    write((await v2Request<ValuationPolicyView & WithRevaluation>({ method: 'POST', path: `/valuation-policies/${input.id}/approve`, body: {}, idempotencyKey })).data),
  );
}
