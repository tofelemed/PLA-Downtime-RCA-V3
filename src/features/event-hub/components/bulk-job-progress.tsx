import { isTerminalJob, useBulkJob } from '@/api/v2/queries/event-commands';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { ERROR_MESSAGES } from '@/features/ux-kit/errors';
import { BULK_JOB_STATE_LABELS, labelOf } from '@/features/ux-kit/labels';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

/** Plain text of a failed batch's refusal (the code itself is never shown). */
const batchError = (code: string | null | undefined) => (code ? ERROR_MESSAGES[code]?.title : undefined) ?? 'Not applied';

/** API04 job progress of a large bulk coding: processed / total, and a partial result made explicit. */
export function BulkJobProgress({ jobId }: { jobId: string }) {
  const { number } = useNumberFormat();
  const job = useBulkJob(jobId);
  const data = job.data;
  const percent = data && data.total > 0 ? Math.round((data.processed / data.total) * 100) : 0;
  const failedChunks = data?.chunks.filter((chunk) => chunk.state === 'failed') ?? [];
  return (
    <div className="space-y-2" data-testid="bulk-job">
      <DataState state={dataStateOf(job)} error={job.error}>
        {data && (
          <>
            <p className="text-sm" aria-live="polite">
              {labelOf(BULK_JOB_STATE_LABELS, data.state)}: {number(data.processed)} of {number(data.total)} processed{data.failed > 0 ? `, ${number(data.failed)} failed` : ''}
            </p>
            <Progress value={percent} aria-label="Bulk coding progress" />
            {isTerminalJob(data) && data.state !== 'completed' && (
              <Alert variant="destructive" data-testid="bulk-job-partial">
                <AlertTitle>{data.state === 'partial' ? 'Partly applied' : 'Not applied'}</AlertTitle>
                <AlertDescription>
                  {failedChunks.map((chunk) => (
                    <p key={chunk.index} className="text-xs">
                      Batch {number(chunk.index + 1)} ({number(chunk.size)} events): {batchError(chunk.errorCode)}
                    </p>
                  ))}
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </DataState>
    </div>
  );
}
