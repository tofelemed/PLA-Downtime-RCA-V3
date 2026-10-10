import { useState } from 'react';
import { useCreateExport } from '@/api/v2/queries/exports';
import { useExportJob } from '@/api/v2/queries/period-overview';
import { downloadExportText } from '@/api/v2/queries/period-workflow';
import type { ExportRequest } from '@/api/v2/queries/reports';
import { Button } from '@/components/ui/button';
import { createLogger } from '@/lib/logger';
import { PlantTime } from '@/features/ux-kit/plant-time';

const log = createLogger('plaAnalyticsExport');

function saveText(text: string, name: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export interface ScopeExportProps {
  /** the export of exactly the shown scope, or null while the figures are provisional */
  request: ExportRequest | null;
  label: string;
  timezone: string;
  testId?: string;
}

/**
 * Asynchronous export of the shown scope (2.9 job, AN03): queued with the page's window and units, polled
 * until done, then the CSV (header: generated time, status, revision and run per row) is downloaded. PDF is
 * not offered: the API renders CSV only (decision 2.9).
 */
export function ScopeExport({ request, label, timezone, testId = 'scope-export' }: ScopeExportProps) {
  const exporter = useCreateExport();
  const [jobId, setJobId] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const job = useExportJob(jobId);
  const start = async () => {
    if (!request) return;
    setFailed(null);
    try {
      setJobId((await exporter.submit(request)).jobId);
    } catch (error) {
      log.warn('export refused', { reportType: request.reportType });
      setFailed(error instanceof Error ? error.message : 'Export could not be started');
    }
  };
  const download = async () => {
    if (!jobId) return;
    try {
      saveText(await downloadExportText(jobId), `proact-${request?.reportType ?? 'export'}-${jobId}.csv`);
    } catch (error) {
      setFailed(error instanceof Error ? error.message : 'Download refused');
    }
  };
  const data = job.data;
  return (
    <div className="space-y-1 text-sm" data-testid={testId} data-request={request ? JSON.stringify(request) : ''}>
      <Button
        size="sm"
        variant="outline"
        disabled={!request || exporter.isPending}
        title={request ? undefined : 'Exports contain approved figures only: tick “Approved only” and wait until the scope is approved'}
        onClick={() => void start()}
        data-testid={`${testId}-start`}
      >
        {label} (CSV)
      </Button>
      {data && (
        <p data-testid={`${testId}-job`} data-state={data.state}>
          Export {data.state}
          {data.rowCount !== null ? ` · ${data.rowCount} rows` : ''}
          {data.finishedAt && (
            <>
              {' '}
              · generated <PlantTime iso={data.finishedAt} tz={timezone} withDate />
            </>
          )}
          {data.state === 'completed' && (
            <Button size="sm" variant="link" onClick={() => void download()} data-testid={`${testId}-download`}>
              Download
            </Button>
          )}
        </p>
      )}
      {data?.error && <p className="text-destructive">{data.error.code}: {data.error.message}</p>}
      {failed && <p className="text-destructive">{failed}</p>}
    </div>
  );
}
