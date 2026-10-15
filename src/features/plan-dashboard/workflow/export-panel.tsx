import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useExportJob } from '@/api/v2/queries/period-overview';
import { downloadExportFile, useExportApprovedRevision } from '@/api/v2/queries/period-workflow';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import { createLogger } from '@/lib/logger';
import { labelOf } from '@/features/ux-kit/labels';
import { Section } from '@/features/ux-kit/page-layout';
import { exportFileName } from '@/features/ux-kit/format/export-file-name';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { saveBlob } from '@/features/ux-kit/save-blob';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { useDisplayCurrency } from '@/features/display-currency/use-display-currency';
import { ActionIcon } from '@/lib/icons';
import { EditorProblem } from '../editor/editor-problem';
import { issueText } from '../model/problem-text';
import { periodRefOf } from '../hooks/use-draft-editor';
import { workflowProblemOf, WorkflowProblem } from '../model/workflow-errors';

const log = createLogger('planDashboardExport');

const EXPORT_STATE_LABELS: Readonly<Record<string, string>> = { queued: 'Waiting', running: 'Running', completed: 'Ready', failed: 'Failed', expired: 'Expired', cancelled: 'Cancelled' };

type ExportFormat = 'csv' | 'pdf';

/**
 * Immutable export of the approved revision (background job), as CSV or as a PDF rendered on the server
 * (plant calendar, money in the user's display currency): progress, the download and the file checksum
 * behind "Details".
 */
export function ExportPanel({ view, timezone }: { view: ReconciliationView; timezone: string }) {
  const create = useExportApprovedRevision();
  const { currency } = useDisplayCurrency();
  const [exportId, setExportId] = useState<string | null>(null);
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [problem, setProblem] = useState<WorkflowProblem | null>(null);
  const job = useExportJob(exportId);
  const start = (next: ExportFormat) => {
    setFormat(next);
    return create.submit({ period: periodRefOf(view), revisionId: view.revision.id, format: next, currency }).then(
      (accepted) => setExportId(accepted.jobId),
      (error: unknown) => setProblem(workflowProblemOf(error)),
    );
  };
  const download = async () => {
    if (!exportId) return;
    try {
      saveBlob(await downloadExportFile(exportId), exportFileName(['loss-lines', exportId], format));
    } catch (error) {
      log.warn('export download refused', { exportId });
      setProblem(workflowProblemOf(error));
    }
  };
  const data = job.data;
  const { number } = useNumberFormat();
  return (
    <Section title="Export (approved figures only)" headingLevel={3}>
      <div className="space-y-2 text-sm" data-testid="export-panel">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" data-testid="export-start" disabled={create.isPending} onClick={() => void start('csv')}>
            <ActionIcon.export className="h-4 w-4" aria-hidden="true" />
            Export approved loss lines (CSV)
          </Button>
          <Button size="sm" variant="outline" data-testid="export-start-pdf" disabled={create.isPending} onClick={() => void start('pdf')}>
            <ActionIcon.export className="h-4 w-4" aria-hidden="true" />
            Export approved loss lines (PDF)
          </Button>
        </div>
        {data && (
          <div className="space-y-1" data-testid="export-job" data-state={data.state}>
            <p role="status">
              Export {labelOf(EXPORT_STATE_LABELS, data.state).toLowerCase()}
              {data.rowCount !== null ? ` · ${number(data.rowCount)} rows` : ''}
              {data.expiresAt ? (
                <>
                  {' '}
                  · available until <PlantTime iso={data.expiresAt} tz={timezone} withDate />
                </>
              ) : null}
            </p>
            {data.contentHash && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">Details</summary>
                <p className="break-all" data-testid="export-hash">
                  File checksum (SHA-256): {data.contentHash}
                </p>
              </details>
            )}
            {data.state === 'completed' && (
              <Button size="sm" data-testid="export-download" onClick={() => void download()}>
                <ActionIcon.export className="h-4 w-4" aria-hidden="true" />
                Download {format.toUpperCase()}
              </Button>
            )}
            {data.error && <p className="text-destructive">{issueText(data.error)}</p>}
          </div>
        )}
        {problem && <EditorProblem problem={problem} />}
      </div>
    </Section>
  );
}
