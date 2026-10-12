import { useRateImportJob } from '@/api/v2/queries/profiles';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { ERROR_MESSAGES, isHumanMessage } from '@/features/ux-kit/errors';
import { humanize } from '@/features/ux-kit/labels';
import { Section } from '@/features/ux-kit/page-layout';

const STATE_LABELS: Record<string, string> = { queued: 'Waiting', running: 'Running', completed: 'Completed', failed: 'Failed', partial: 'Completed with refused lines' };
const KIND_LABELS: Record<string, string> = { budget: 'Budget', forecast: 'Forecast', mpc: 'MPC' };

interface ReportLine {
  line: number;
  code: string;
  message: string;
}

/** The server's message when it reads as a sentence, the mapped text of its code otherwise. */
const problemOf = (r: ReportLine) => ERROR_MESSAGES[r.code]?.text ?? (isHumanMessage(r.message, r.code) ? r.message : 'This line was not accepted.');

const COLUMNS: DataTableColumn<ReportLine>[] = [
  { id: 'line', header: 'Line', align: 'right', width: '5rem', cell: (r) => String(r.line) },
  { id: 'problem', header: 'Problem', cell: problemOf },
];

/** Live status of an accepted import: state, counts and the server's per-line report (20 lines per page). */
export function RateImportStatus({ importId }: { importId: string }) {
  const job = useRateImportJob(importId);
  const view = job.data;
  return (
    <Section title="Import status">
      {!view ? (
        <p className="text-sm" role="status">
          Import accepted — waiting for the worker…
        </p>
      ) : (
        <div className="space-y-2 text-sm" data-testid="rate-import-status" data-state={view.state}>
          <p role="status">
            {KIND_LABELS[view.kind] ?? humanize(view.kind)} {view.externalId}, revision {view.revision}: <strong>{STATE_LABELS[view.state] ?? humanize(view.state)}</strong>
          </p>
          {view.counts && <p className="text-xs">{Object.entries(view.counts).map(([key, count]) => `${humanize(key)}: ${count}`).join(' · ')}</p>}
          {view.report.length > 0 && <DataTable caption="Refused lines" columns={COLUMNS} rows={view.report} getRowKey={(r) => `${r.line}-${r.code}`} density="compact" />}
        </div>
      )}
    </Section>
  );
}
