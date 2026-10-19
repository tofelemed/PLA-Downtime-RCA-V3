import { useId, useState } from 'react';
import { useCreateExport } from '@/api/v2/queries/exports';
import { useExportJob } from '@/api/v2/queries/period-overview';
import { downloadExportFile } from '@/api/v2/queries/period-workflow';
import type { ExportRequest } from '@/api/v2/queries/reports';
import { Button } from '@/components/ui/button';
import { createLogger } from '@/lib/logger';
import { ActionIcon } from '@/lib/icons';
import { DisabledReason } from '@/features/ux-kit/disabled-reason';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { labelOf } from '@/features/ux-kit/labels';
import { exportFileName, plantFileDay } from '@/features/ux-kit/format/export-file-name';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { saveBlob } from '@/features/ux-kit/save-blob';
import { useDisplayCurrency } from '@/features/display-currency/use-display-currency';
import { EXPORT_STATE_LABELS } from '../model/display';

const log = createLogger('plaAnalyticsExport');

export interface ScopeExportProps {
  /** the export of exactly the shown scope, or null while the figures are provisional */
  request: ExportRequest | null;
  label: string;
  timezone: string;
  /** csv (default): every column; pdf: a printable report in the plant calendar and the display currency */
  format?: 'csv' | 'pdf';
  testId?: string;
  /** why there is no request (`exportBlockedReason`), shown under the disabled button */
  disabledReason?: string | null;
  /** id of a reason the page shows once for several exports (then none is shown here) */
  reasonShownAt?: string;
}

const DISABLED_HINT = 'Exports contain approved figures only: choose approved revisions only, for dates whose periods are all approved.';

/**
 * Asynchronous export of the shown scope (2.9 job, AN03): queued with the page's window and units, polled
 * until done, then the file is downloaded: CSV (header: generated time, status, revision and run per row) or
 * PDF (rendered on the server in the plant calendar, money in the user's display currency). Failures read
 * in plain language.
 */
export function ScopeExport({ request: base, label, timezone, format = 'csv', testId = 'scope-export', disabledReason, reasonShownAt }: ScopeExportProps) {
  const ownId = useId();
  const reasonId = reasonShownAt ?? ownId;
  const reason = base ? null : (disabledReason ?? DISABLED_HINT);
  const { currency } = useDisplayCurrency();
  const request: ExportRequest | null = base && format === 'pdf' ? { ...base, format: 'pdf', currency } : base;
  const exporter = useCreateExport();
  const [jobId, setJobId] = useState<string | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const job = useExportJob(jobId);
  const start = async () => {
    if (!request) return;
    setFailure(null);
    try {
      setJobId((await exporter.submit(request)).jobId);
    } catch (error) {
      log.warn('export refused', { reportType: request.reportType });
      setFailure(error);
    }
  };
  const download = async () => {
    if (!jobId) return;
    try {
      saveBlob(await downloadExportFile(jobId), exportFileName([request?.reportType ?? 'export', plantFileDay(request?.from, timezone, '')], format));
    } catch (error) {
      setFailure(error);
    }
  };
  const data = job.data;
  const { number } = useNumberFormat();
  return (
    <div className="space-y-1 text-sm" data-testid={testId} data-request={request ? JSON.stringify(request) : ''}>
      <Button size="sm" variant="outline" disabled={!request || exporter.isPending} aria-describedby={reason ? reasonId : undefined} onClick={() => void start()} data-testid={`${testId}-start`}>
        <ActionIcon.export className="mr-1 h-4 w-4" aria-hidden="true" />
        {label} ({format.toUpperCase()})
      </Button>
      {!reasonShownAt && <DisabledReason id={reasonId} reason={reason} />}
      {data && (
        <p data-testid={`${testId}-job`} data-state={data.state} role="status">
          Export {labelOf(EXPORT_STATE_LABELS, data.state)}
          {data.rowCount !== null ? ` · ${number(data.rowCount)} rows` : ''}
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
      {data?.error && <FriendlyErrorAlert error={data.error.message} title="The export failed" />}
      {failure !== null && <FriendlyErrorAlert error={failure} title="The export could not be started" />}
    </div>
  );
}
