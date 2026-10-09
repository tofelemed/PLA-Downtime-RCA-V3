import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useExportJob } from '@/api/v2/queries/period-overview';
import { downloadExportText, useExportApprovedRevision } from '@/api/v2/queries/period-workflow';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import { createLogger } from '@/lib/logger';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { EditorProblem } from '../editor/editor-problem';
import { periodRefOf } from '../hooks/use-draft-editor';
import { workflowProblemOf, WorkflowProblem } from '../model/workflow-errors';

const log = createLogger('planDashboardExport');

function saveText(text: string, name: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/** Immutable export of the approved revision (2.9 job): progress, the file's sha256 and the download (410 when expired). */
export function ExportPanel({ view, timezone }: { view: ReconciliationView; timezone: string }) {
  const create = useExportApprovedRevision();
  const [exportId, setExportId] = useState<string | null>(null);
  const [problem, setProblem] = useState<WorkflowProblem | null>(null);
  const job = useExportJob(exportId);
  const start = () =>
    create.submit({ period: periodRefOf(view), revisionId: view.revision.id }).then(
      (accepted) => setExportId(accepted.jobId),
      (error: unknown) => setProblem(workflowProblemOf(error)),
    );
  const download = async () => {
    if (!exportId) return;
    try {
      saveText(await downloadExportText(exportId), `proact-loss-lines-${exportId}.csv`);
    } catch (error) {
      log.warn('export download refused', { exportId });
      setProblem(workflowProblemOf(error));
    }
  };
  const data = job.data;
  return (
    <section className="space-y-2 text-sm" data-testid="export-panel">
      <h3 className="font-medium">Export (approved content only)</h3>
      <Button size="sm" variant="outline" data-testid="export-start" disabled={create.isPending} onClick={() => void start()}>
        Export approved loss lines (CSV)
      </Button>
      {data && (
        <div data-testid="export-job" data-state={data.state}>
          <p>
            Job {data.id.slice(0, 8)}: {data.state}
            {data.rowCount !== null ? ` · ${data.rowCount} rows` : ''}
            {data.expiresAt ? (
              <>
                {' '}
                · expires <PlantTime iso={data.expiresAt} tz={timezone} withDate />
              </>
            ) : null}
          </p>
          {data.contentHash && (
            <p className="break-all text-xs" data-testid="export-hash">
              sha256 {data.contentHash}
            </p>
          )}
          {data.state === 'completed' && (
            <Button size="sm" data-testid="export-download" onClick={() => void download()}>
              Download
            </Button>
          )}
          {data.error && <p className="text-destructive">{data.error.code}: {data.error.message}</p>}
        </div>
      )}
      {problem && <EditorProblem problem={problem} />}
    </section>
  );
}
