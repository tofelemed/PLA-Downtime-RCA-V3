import { useQuery } from '@tanstack/react-query';
import { v2Request } from '../client';
import type { QueryParams } from '../request-url';
import type { AnalyticsResponse, ListResponse } from '../types/envelopes';
import type {
  ExportJobDetailView,
  GridWorkflowState,
  LedgerKind,
  LossValueReportView,
  PeriodSummaryView,
  RevisionSelector,
  WaterfallView,
} from '../types/period-overview';
import type { PlanView } from '../types/plans';
import type { ApprovalActionView, ChangeProposalView, ReconciliationView } from '../types/reconciliation';
import { sameEntityQuery, sameTenantQuery } from './placeholder';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { stabilizeWindowParams } from './time-window';
import { useV2InfiniteList } from './use-v2-list';
import { useV2TenantId } from './use-v2-tenant';

export interface PeriodGridFilters {
  unitIds: string[];
  from: string;
  to: string;
  workflowState?: GridWorkflowState[];
  view?: RevisionSelector;
}

/** Period grid of the Plan Dashboard (plan 3.5): figures computed by the server, keyset pages of 100. */
export function usePeriodSummaries(filters: PeriodGridFilters | null, tz?: string) {
  const { unitIds = [], from, to, ...rest } = filters ?? { unitIds: [], from: '', to: '' };
  return useV2InfiniteList<PeriodSummaryView>({
    resource: 'period-accounting',
    path: '/period-summaries',
    query: { ...(filters ?? {}), limit: 100 } as unknown as QueryParams,
    key: { scope: { unitIds }, window: { from, to, tz }, filters: { kind: 'period-summaries', ...rest } },
    enabled: filters !== null,
  });
}

/** One v2 GET of the period-accounting family, cached per tenant, period and variant. */
function usePeriodRead<T>(periodId: string | null, variant: string, path: string, query?: QueryParams) {
  const tenantId = useV2TenantId();
  return useQuery<T>({
    queryKey: v2Keys.detail(tenantId ?? '-', 'period-accounting', periodId ?? '-', variant),
    enabled: Boolean(tenantId && periodId),
    staleTime: STALE_TIME['period-accounting'],
    // a view toggle of the same period keeps the previous view on screen; another period never does
    placeholderData: (previous, previousQuery) => (sameEntityQuery(tenantId, periodId, previousQuery) ? previous : undefined),
    queryFn: async ({ signal }) => (await v2Request<T>({ method: 'GET', path, query, signal })).data,
  });
}

/** Reconciliation view of the period (2.8): `current` = open revision, else published; `approved` = published. */
export function useReconciliation(periodId: string | null, view: RevisionSelector = 'current') {
  return usePeriodRead<ReconciliationView>(periodId, `reconciliation:${view}`, `/production-periods/${periodId}/reconciliation`, { view });
}

export function useApprovalActions(periodId: string | null) {
  return usePeriodRead<ListResponse<ApprovalActionView>>(periodId, 'approval-actions', `/production-periods/${periodId}/approval-actions`, { limit: 100 });
}

export function useChangeProposals(periodId: string | null) {
  return usePeriodRead<ListResponse<ChangeProposalView>>(periodId, 'change-proposals', `/production-periods/${periodId}/change-proposals`, { limit: 20 });
}

/** Ledger waterfall of the periods (server bars with start / end that close to actual). */
export function useWaterfall(periodIds: string[], ledger: LedgerKind, view: RevisionSelector) {
  const tenantId = useV2TenantId();
  return useQuery<WaterfallView>({
    queryKey: v2Keys.list(tenantId ?? '-', 'period-accounting', { filters: { kind: 'waterfall', periodIds: [...periodIds].sort() }, ledger, revisionSelector: view }),
    enabled: Boolean(tenantId && periodIds.length),
    staleTime: STALE_TIME['period-accounting'],
    placeholderData: (previous, previousQuery) => (sameTenantQuery(tenantId, previousQuery) ? previous : undefined),
    queryFn: async ({ signal }) =>
      (await v2Request<WaterfallView>({ method: 'GET', path: '/reports/waterfall', query: { periodIds, ledger, view }, signal })).data,
  });
}

export interface LossValueQuery {
  unitIds: string[];
  from: string;
  to: string;
  ledger: LedgerKind;
  approvedOnly: boolean;
}

/** Loss value of a window (2.6 report): per kind and reporting currency, with valuation status and reasons. */
export function useLossValue(query: LossValueQuery | null) {
  const tenantId = useV2TenantId();
  return useQuery<AnalyticsResponse<LossValueReportView>>({
    queryKey: v2Keys.list(tenantId ?? '-', 'reports', {
      scope: { unitIds: query?.unitIds },
      window: { from: query?.from, to: query?.to },
      filters: { kind: 'loss-value', groupBy: 'kind', ledger: query?.ledger },
      revisionSelector: query?.approvedOnly ? 'approved' : 'shown',
    }),
    enabled: Boolean(tenantId && query),
    staleTime: STALE_TIME.reports,
    refetchOnWindowFocus: false,
    placeholderData: (previous, previousQuery) => (query && sameTenantQuery(tenantId, previousQuery) ? previous : undefined),
    queryFn: async ({ signal }) =>
      (await v2Request<AnalyticsResponse<LossValueReportView>>({
        method: 'GET',
        path: '/reports/loss-value',
        query: { ...stabilizeWindowParams(query as LossValueQuery), groupBy: 'kind' } as unknown as QueryParams,
        signal,
      })).data,
  });
}

/** One plan with its current version (2.3); 404 for v1-only plans that never got a v2 version. */
export function usePlan(planId: string | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'plans', planId ?? '-', 'plan'),
    enabled: Boolean(tenantId && planId),
    staleTime: STALE_TIME.plans,
    retry: false,
    queryFn: async ({ signal }) => (await v2Request<PlanView>({ method: 'GET', path: `/production-plans/${planId}`, signal })).data,
  });
}

/** Export job status (2.9), polled every 2 s until it is no longer queued or running. */
export function useExportJob(exportId: string | null) {
  const tenantId = useV2TenantId();
  return useQuery<ExportJobDetailView>({
    queryKey: v2Keys.detail(tenantId ?? '-', 'jobs', exportId ?? '-', 'export'),
    enabled: Boolean(tenantId && exportId),
    staleTime: STALE_TIME.jobs,
    refetchInterval: (query) => (['queued', 'running'].includes(query.state.data?.state ?? 'queued') ? 2000 : false),
    queryFn: async ({ signal }) => (await v2Request<ExportJobDetailView>({ method: 'GET', path: `/exports/${exportId}`, signal })).data,
  });
}

/** Recompute job status (2.4 actuals jobs: actuals, then both ledgers), polled while it runs. */
export interface ActualsJobStatusView {
  id: string;
  state: string;
  errorCode: string | null;
  errorMessage: string | null;
}

export function useActualsJob(jobId: string | null) {
  const tenantId = useV2TenantId();
  return useQuery<ActualsJobStatusView>({
    queryKey: v2Keys.detail(tenantId ?? '-', 'jobs', jobId ?? '-', 'actuals'),
    enabled: Boolean(tenantId && jobId),
    staleTime: STALE_TIME.jobs,
    refetchInterval: (query) => (['queued', 'running'].includes(query.state.data?.state ?? 'queued') ? 1500 : false),
    queryFn: async ({ signal }) =>
      (await v2Request<ActualsJobStatusView>({ method: 'GET', path: `/actuals-jobs/${jobId}`, signal })).data,
  });
}
