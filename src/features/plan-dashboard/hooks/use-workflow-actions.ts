import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useActualsJob } from '@/api/v2/queries/period-overview';
import {
  useApproveRevision,
  useReasonedRevisionCommand,
  useRecomputePeriod,
  useReviseRevision,
  useSubmitRevision,
} from '@/api/v2/queries/period-workflow';
import { v2Keys } from '@/api/v2/queries/query-keys';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import { workflowProblemOf, WorkflowProblem } from '../model/workflow-errors';
import { periodRefOf, reconciliationKey } from './use-draft-editor';

export type WorkflowCommand = 'submit' | 'approve' | 'reject' | 'cancel' | 'revise' | 'recompute';

/** Polls a recompute job (202) and refreshes the period's figures when it ends. */
function useRecomputeJob(view: ReconciliationView) {
  const tenantId = useV2TenantId();
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);
  const job = useActualsJob(jobId);
  const state = job.data?.state ?? (jobId ? 'queued' : null);
  useEffect(() => {
    if (state === 'completed' || state === 'failed') {
      void queryClient.invalidateQueries({ queryKey: v2Keys.resource(tenantId ?? '-', 'period-accounting') });
    }
  }, [state, queryClient, tenantId, view.periodId]);
  return { jobId, setJobId, state, error: job.data?.errorMessage ?? null };
}

/**
 * Workflow commands of the shown revision (plan 3.5 step 3, WF01–WF04) with the hashes the user read:
 * submit (run + content hash), approve (submitted hash), reject / cancel (reason), revise ("Unlock"),
 * recompute (202 job with progress). The response view replaces the cached one; refusals keep the code.
 */
export function useWorkflowActions(view: ReconciliationView) {
  const tenantId = useV2TenantId();
  const queryClient = useQueryClient();
  const submit = useSubmitRevision();
  const approve = useApproveRevision();
  const reasoned = useReasonedRevisionCommand();
  const revise = useReviseRevision();
  const recompute = useRecomputePeriod();
  const job = useRecomputeJob(view);
  const [problem, setProblem] = useState<WorkflowProblem | null>(null);
  const [pending, setPending] = useState<WorkflowCommand | null>(null);
  const period = periodRefOf(view);
  const revision = view.revision.revision;

  /** resolves true when the command succeeded; a refusal is kept in `problem` and resolves false */
  const run = async (command: WorkflowCommand, action: () => Promise<ReconciliationView | null>): Promise<boolean> => {
    setPending(command);
    setProblem(null);
    try {
      const next = await action();
      if (next) queryClient.setQueryData(reconciliationKey(tenantId, view.periodId), next);
      return true;
    } catch (error) {
      setProblem(workflowProblemOf(error));
      return false;
    } finally {
      setPending(null);
    }
  };

  return {
    problem,
    pending,
    recomputeState: job.state,
    recomputeError: job.error,
    submit: (comment?: string) => run('submit', () => submit.submit({ period, revision, runId: view.baseRunId ?? '', contentHash: view.contentHash, ...(comment ? { comment } : {}) })),
    approve: (comment?: string) => run('approve', () => approve.submit({ period, revision, submittedHash: view.revision.submittedHash ?? '', ...(comment ? { comment } : {}) })),
    reject: (reason: string, failedLines: string[] = []) => run('reject', () => reasoned.submit({ period, action: 'reject', revision, reason, failedLines })),
    cancel: (reason: string) => run('cancel', () => reasoned.submit({ period, action: 'cancel', revision, reason })),
    revise: (reason: string) => run('revise', () => revise.submit({ period, approvedRevision: revision, reason })),
    recompute: (reason?: string) =>
      run('recompute', async () => {
        const accepted = await recompute.submit({ period, ...(reason ? { reason } : {}) });
        job.setJobId(accepted.jobId);
        return null;
      }),
  };
}
