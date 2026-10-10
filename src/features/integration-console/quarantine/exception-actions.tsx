import { useReducer, useState } from 'react';
import { useReplayRun, useRequestReplay, useResolveException } from '@/api/v2/queries/ingestion-exceptions';
import type { IngestionExceptionDetailView } from '@/api/v2/types/integrations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConsoleRefusal } from '../components/console-refusal';
import { Field } from '../components/field';
import { ReplayRunStatus } from '../jobs/replay-run-status';
import { canReplayAfterDryRun, resolutionReducer } from '../model/exception-flow';

const isAccepted = (value: unknown): value is { jobId: string } => typeof (value as { jobId?: unknown } | null)?.jobId === 'string';

/**
 * Resolution of one open exception (ING05): fix the mapping first, then a dry-run replay of this record
 * (counts), then the replay that resolves it once it normalises; or close it as irrecoverable with a
 * reason. Commands need an integration administrator or manager approver.
 */
export function ExceptionActions({ exception }: { exception: IngestionExceptionDetailView }) {
  const [reason, setReason] = useState('');
  const [state, dispatch] = useReducer(resolutionReducer, { step: 'idle' });
  const request = useRequestReplay();
  const resolve = useResolveException();
  const dryRun = useReplayRun(state.step === 'dry-run' ? state.runId : null);
  const why = reason.trim();
  const runDry = async () => {
    const body = { reason: why || 'dry run before resolving', exceptionIds: [exception.id], dryRun: true };
    const accepted = await request.submit({ connectionId: exception.connectionId, body }).catch(() => null);
    if (accepted) dispatch({ type: 'dry-run-started', runId: accepted.jobId });
  };
  const close = async (action: 'replay' | 'irrecoverable') => {
    const outcome = await resolve.submit({ id: exception.id, action, reason: why }).catch(() => null);
    if (!outcome) return;
    dispatch(isAccepted(outcome) ? { type: 'replay-started', runId: outcome.jobId } : { type: 'closed' });
  };
  if (exception.state !== 'open') return <p className="text-sm text-muted-foreground">This item is {exception.state}.</p>;
  return (
    <div className="space-y-2" data-testid="exception-actions" data-step={state.step}>
      <Field id="resolve-reason" label="Reason (audited, required)">
        <Input id="resolve-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => void runDry()} disabled={request.isPending} data-testid="exception-dry-run">
          Dry-run replay
        </Button>
        <Button size="sm" onClick={() => void close('replay')} disabled={!why || !canReplayAfterDryRun(dryRun.data) || resolve.isPending} data-testid="exception-replay">
          Replay and resolve
        </Button>
        <Button size="sm" variant="destructive" onClick={() => void close('irrecoverable')} disabled={!why || resolve.isPending} data-testid="exception-irrecoverable">
          Mark irrecoverable
        </Button>
      </div>
      <ConsoleRefusal error={request.error ?? resolve.error} />
      {state.step === 'dry-run' && <ReplayRunStatus runId={state.runId} />}
      {state.step === 'replaying' && <ReplayRunStatus runId={state.runId} />}
      {state.step === 'closed' && <p role="status" className="text-sm">Closed as irrecoverable.</p>}
    </div>
  );
}
