import { useQueryClient } from '@tanstack/react-query';
import { v2Request } from '../client';
import { ifMatchOf } from '../etag-cache';
import type { JobAccepted } from '../types/envelopes';
import type { ChangeProposalView, DraftLineInput, EvidenceType, ReconciliationView } from '../types/reconciliation';
import { invalidateForChange, type ChangeNotice } from './invalidation';
import { useV2Command } from './use-v2-command';
import { useV2TenantId } from './use-v2-tenant';

/**
 * Period workflow commands of plan 2.8 for the Plan Dashboard (plan 3.5): the atomic draft-lines save
 * (If-Match = the view's row version, `baseRunId` = the run the editor read), submit / approve with the
 * hashes the user read, reject, revise ("Unlock"), cancel, recompute (202 job) and change-proposal
 * decisions. Every POST carries the attempt's Idempotency-Key; refusals surface as `V2ApiError` with the
 * server's code (RUN_CHANGED, STALE_REVISION, SEPARATION_OF_DUTIES, MISSING_CODE, …), never retried.
 */
export interface PeriodRef {
  periodId: string;
  unitId: string;
  utcStart: string;
  utcEnd: string;
}

function periodNotice(tenantId: string | null, ref: PeriodRef): ChangeNotice | null {
  return tenantId ? { tenantId, entityType: 'production_period', entityId: ref.periodId, window: { from: ref.utcStart, to: ref.utcEnd } } : null;
}

/**
 * A period command whose result is returned as soon as the server answered: the related cached results
 * are invalidated in the background (not awaited), so the caller can show the response view at once
 * while the grid, ledgers and reports refresh.
 */
function usePeriodCommand<TInput extends { period: PeriodRef }, TResult>(run: (input: TInput, idempotencyKey: string) => Promise<TResult>) {
  const tenantId = useV2TenantId();
  const queryClient = useQueryClient();
  return useV2Command<TInput, TResult>({
    run: async ({ input, idempotencyKey }) => {
      const result = await run(input, idempotencyKey);
      const notice = periodNotice(tenantId, input.period);
      if (notice) void invalidateForChange(queryClient, notice);
      return result;
    },
    changes: () => null,
    retries: 0,
  });
}

const post = async <T>(path: string, body: unknown, idempotencyKey: string) =>
  (await v2Request<T>({ method: 'POST', path, body, idempotencyKey })).data;

export interface SaveDraftInput {
  period: PeriodRef;
  revision: number;
  rowVersion: number;
  baseRunId: string;
  lines: DraftLineInput[];
}

/** `PUT …/draft-lines`: the full set replaces the saved one atomically, or nothing changes (T33). */
export function useSaveDraftLines() {
  return usePeriodCommand<SaveDraftInput, ReconciliationView>(async (input) =>
    (await v2Request<ReconciliationView>({
      method: 'PUT',
      path: `/production-periods/${input.period.periodId}/draft-lines`,
      body: { revision: input.revision, baseRunId: input.baseRunId, lines: input.lines },
      ifMatch: ifMatchOf(input.rowVersion),
    })).data,
  );
}

export interface SubmitInput {
  period: PeriodRef;
  revision: number;
  runId: string;
  contentHash: string;
  comment?: string;
}

export function useSubmitRevision() {
  return usePeriodCommand<SubmitInput, ReconciliationView>(({ period, ...body }, key) =>
    post(`/production-periods/${period.periodId}/submit`, body, key),
  );
}

export interface ApproveInput {
  period: PeriodRef;
  revision: number;
  submittedHash: string;
  comment?: string;
}

export function useApproveRevision() {
  return usePeriodCommand<ApproveInput, ReconciliationView>(({ period, ...body }, key) =>
    post(`/production-periods/${period.periodId}/approve`, body, key),
  );
}

/** SME R8: the second independent review of bridges above the unit limit (same body as approve). */
export function useBridgeReview() {
  return usePeriodCommand<ApproveInput, ReconciliationView>(({ period, ...body }, key) =>
    post(`/production-periods/${period.periodId}/bridge-review`, body, key),
  );
}

export interface ReasonedInput {
  period: PeriodRef;
  action: 'reject' | 'cancel';
  revision: number;
  reason: string;
  /** reject only (SME R6): line ids or candidate auto keys that failed */
  failedLines?: string[];
}

export function useReasonedRevisionCommand() {
  return usePeriodCommand<ReasonedInput, ReconciliationView>(({ period, action, failedLines, ...body }, key) =>
    post(`/production-periods/${period.periodId}/${action}`, action === 'reject' && failedLines?.length ? { ...body, failedLines } : body, key),
  );
}

export interface ReviseInput {
  period: PeriodRef;
  approvedRevision: number;
  reason: string;
}

/** "Unlock" (WF04): a new draft over the published revision; the approved one stays published. */
export function useReviseRevision() {
  return usePeriodCommand<ReviseInput, ReconciliationView>(({ period, ...body }, key) =>
    post(`/production-periods/${period.periodId}/revise`, body, key),
  );
}

export interface RecomputeInput {
  period: PeriodRef;
  reason?: string;
}

export function useRecomputePeriod() {
  return usePeriodCommand<RecomputeInput, JobAccepted>(({ period, reason }, key) =>
    post(`/production-periods/${period.periodId}/recompute`, reason ? { reason } : {}, key),
  );
}

export interface ProposalDecisionInput {
  period: PeriodRef;
  proposalId: string;
  decision: 'accept' | 'dismiss';
  reason: string;
}

export function useProposalDecision() {
  return usePeriodCommand<ProposalDecisionInput, unknown>(({ proposalId, decision, reason }, key) =>
    post(`/period-change-proposals/${proposalId}/${decision}`, { reason }, key),
  );
}

export interface ProposeCorrectionInput {
  period: PeriodRef;
  approvedRevision: number;
  reason: string;
  evidenceType: EvidenceType;
  evidenceRef: string;
}

/** SME R4: a manual change proposal of an approved period of a closing or locked month. */
export function useProposeCorrection() {
  return usePeriodCommand<ProposeCorrectionInput, ChangeProposalView>(({ period, ...body }, key) =>
    post('/period-change-proposals', { periodId: period.periodId, ...body }, key),
  );
}

export interface ExportRevisionInput {
  period: PeriodRef;
  revisionId: string;
  /** csv (default) or pdf; a PDF prints money in `currency` (USD by default) */
  format?: 'csv' | 'pdf';
  currency?: 'USD' | 'IRR';
}

/** Export of an approved revision (2.9 `revision_ids`): approved content only, never a draft. */
export function useExportApprovedRevision() {
  return usePeriodCommand<ExportRevisionInput, JobAccepted>(({ revisionId, format = 'csv', currency }, key) =>
    post(
      '/exports',
      { reportType: 'loss_lines', format, revisionSelector: 'revision_ids', revisionIds: [revisionId], ...(format === 'pdf' && currency ? { currency } : {}) },
      key,
    ),
  );
}

/** Fetches the export file with the session (the download route is re-authorized) as text. */
export async function downloadExportText(exportId: string): Promise<string> {
  return (await v2Request<string>({ method: 'GET', path: `/exports/${exportId}/download` })).data;
}

/** Fetches an export file as a Blob of its own type (CSV text or PDF bytes) for saving. */
export async function downloadExportFile(exportId: string): Promise<Blob> {
  const data = (await v2Request<Blob | string>({ method: 'GET', path: `/exports/${exportId}/download` })).data;
  return typeof data === 'string' ? new Blob([data], { type: 'text/csv;charset=utf-8' }) : data;
}
