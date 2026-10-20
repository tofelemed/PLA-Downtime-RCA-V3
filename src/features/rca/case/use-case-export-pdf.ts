import { useState } from 'react';
import { useExportJob } from '@/api/v2/queries/period-overview';
import { downloadExportFile } from '@/api/v2/queries/period-workflow';
import { useCreateRcaCaseExport } from '@/api/v2/queries/rca-case-export';
import type { RcaCaseView } from '@/api/v2/types/rca';
import { exportFileName } from '@/features/ux-kit/format/export-file-name';
import { saveBlob } from '@/features/ux-kit/save-blob';
import { createLogger } from '@/lib/logger';

const log = createLogger('rcaCaseExport');

/** File name of the case PDF: product prefix, case title words and the export id (ISO, Latin). */
function fileNameOf(title: string, jobId: string): string {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return exportFileName(['investigation', words || null, jobId.slice(0, 8)], 'pdf');
}

/**
 * Item 2.5: the server PDF of one case as an export job — `start` requests it in `currency`, the job is
 * polled until it finishes, `download` saves the file. `state` is null before a request.
 */
export function useCaseExportPdf(rca: Pick<RcaCaseView, 'id' | 'title'>, currency: 'USD' | 'IRR') {
  const exporter = useCreateRcaCaseExport();
  const [jobId, setJobId] = useState<string | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const job = useExportJob(jobId);
  const state = job.data?.state ?? (jobId ? 'queued' : null);
  const start = async () => {
    setFailure(null);
    try {
      setJobId((await exporter.submit({ reportType: 'rca_case', format: 'pdf', revisionSelector: 'case', rcaId: rca.id, currency })).jobId);
    } catch (error) {
      log.warn('case export refused', { rcaId: rca.id });
      setFailure(error);
    }
  };
  const download = async () => {
    if (!jobId) return;
    try {
      saveBlob(await downloadExportFile(jobId), fileNameOf(rca.title, jobId));
    } catch (error) {
      setFailure(error);
    }
  };
  const busy = exporter.isPending || state === 'queued' || state === 'running';
  return { state, busy, start, download, failure, jobError: job.data?.error ?? null };
}
