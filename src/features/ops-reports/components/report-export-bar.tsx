import { useState } from 'react';
import { useExportJob } from '@/api/v2/queries/period-overview';
import { downloadReportExport, useCreateReportExport, type ReportExportFormat } from '@/api/v2/queries/report-exports';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDisplayCurrency } from '@/features/display-currency/use-display-currency';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { exportFileName, plantFileDay } from '@/features/ux-kit/format/export-file-name';
import { labelOf } from '@/features/ux-kit/labels';
import { saveBlob } from '@/features/ux-kit/save-blob';
import { EXPORT_STATE_LABELS } from '@/features/pla-analytics/model/display';
import { ActionIcon } from '@/lib/icons';

export interface ReportExportBarProps {
  /** the Reports page view key */
  kind: string;
  /** the report's query, as its GET takes it; null while the report cannot be read yet */
  query: object | null;
  /** formats offered (default PDF and Excel) */
  formats?: readonly ReportExportFormat[];
  /** the figures are provisional: the file will say so on every page */
  provisional?: boolean;
  timezone: string;
}

const LABELS: Record<ReportExportFormat, string> = { pdf: 'PDF', xlsx: 'Excel' };

/** One export in flight: started, polled, then downloaded once the worker finished it. */
function ExportJobStatus({ jobId, format, onDownload }: { jobId: string; format: ReportExportFormat; onDownload: () => void }) {
  const job = useExportJob(jobId);
  const state = job.data?.state ?? 'queued';
  return (
    <span className="flex items-center gap-2 text-sm" role="status" data-testid={`report-export-${format}-job`} data-state={state}>
      {LABELS[format]}: {labelOf(EXPORT_STATE_LABELS, state)}
      {state === 'completed' && (
        <Button size="sm" variant="link" className="h-auto p-0" onClick={onDownload} data-testid={`report-export-${format}-download`}>
          Download
        </Button>
      )}
      {job.data?.error && <FriendlyErrorAlert error={job.data.error.message} title="The export failed" />}
    </span>
  );
}

/**
 * PDF and Excel export of an operating report (owner 2026-10-20): the server renders the same figures as the
 * page — a designed PDF with the Marun logo, or a workbook with a sheet per table — in the background;
 * provisional figures are exported and stamped. Money is printed in the user's display currency.
 */
export function ReportExportBar({ kind, query, formats = ['pdf', 'xlsx'], provisional = false, timezone }: ReportExportBarProps) {
  const { currency } = useDisplayCurrency();
  const exporter = useCreateReportExport();
  const [jobs, setJobs] = useState<Partial<Record<ReportExportFormat, string>>>({});
  const [failure, setFailure] = useState<unknown>(null);
  const start = async (format: ReportExportFormat) => {
    if (!query) return;
    setFailure(null);
    try {
      const { jobId } = await exporter.submit({ kind, query, format, currency });
      setJobs((current) => ({ ...current, [format]: jobId }));
    } catch (error) {
      setFailure(error);
    }
  };
  const download = async (format: ReportExportFormat, jobId: string) => {
    try {
      const from: unknown = query ? Reflect.get(query, 'from') : null;
      saveBlob(await downloadReportExport(jobId, format), exportFileName([kind, plantFileDay(typeof from === 'string' ? from : null, timezone, '')], format));
    } catch (error) {
      setFailure(error);
    }
  };
  return (
    <div className="space-y-2 print:hidden" data-testid={`report-export-${kind}`}>
      <div className="flex flex-wrap items-center gap-2">
        {formats.map((format) => (
          <Button key={format} size="sm" variant="outline" disabled={!query || exporter.isPending} onClick={() => void start(format)} data-testid={`report-export-${format}`}>
            <ActionIcon.export className="mr-1 h-4 w-4" aria-hidden="true" />
            {LABELS[format]}
          </Button>
        ))}
        {provisional && <Badge variant="outline">Exports will be stamped provisional</Badge>}
        {formats.map((format) => {
          const jobId = jobs[format];
          return jobId ? <ExportJobStatus key={format} jobId={jobId} format={format} onDownload={() => void download(format, jobId)} /> : null;
        })}
      </div>
      {failure !== null && <FriendlyErrorAlert error={failure} title="The export could not be started" />}
    </div>
  );
}
