import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateForChange } from '@/api/v2/queries/invalidation';
import { usePlanGenerationJob } from '@/api/v2/queries/plans';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { refusalTitle } from '@/features/ux-kit/errors';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

const TERMINAL = new Set(['completed', 'failed']);
const STATE_LABELS: Record<string, string> = { queued: 'waiting', running: 'running', completed: 'completed', failed: 'failed' };

/**
 * A 202 generation job followed until it completes or fails (API04); the server's result and error as is.
 * On a terminal state the cached plan reads refresh (cache invalidation only — nothing is written).
 */
export function GenerationProgress({ jobId }: { jobId: string }) {
  const { number } = useNumberFormat();
  const job = usePlanGenerationJob(jobId);
  const queryClient = useQueryClient();
  const tenantId = useV2TenantId();
  const state = job.data?.state;
  useEffect(() => {
    if (tenantId && state && TERMINAL.has(state)) void invalidateForChange(queryClient, { tenantId, entityType: 'production_plan', window: null });
  }, [state, tenantId, queryClient]);
  const view = job.data;
  if (!view) return <p className="text-sm" role="status">Generation accepted — waiting for the worker…</p>;
  return (
    <p className="text-sm" role="status" data-testid="generation-status" data-state={view.state}>
      Generation of version {view.version}: <strong>{STATE_LABELS[view.state] ?? 'running'}</strong>
      {view.result?.periods !== undefined ? ` · ${number(view.result.periods)} periods stored` : ''}
      {view.errorCode ? ` · ${refusalTitle(view.errorCode, null)}` : ''}
    </p>
  );
}
