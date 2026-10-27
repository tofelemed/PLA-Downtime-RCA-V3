import { useState } from 'react';
import { fetchAllStatementRows, type LossStatementQuery } from '@/api/v2/queries/loss-statement';
import { Button } from '@/components/ui/button';
import { withByteOrderMark } from '@/features/event-hub/model/csv-text';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { exportFileName, plantFileDay } from '@/features/ux-kit/format/export-file-name';
import { saveBlob } from '@/features/ux-kit/save-blob';
import { ActionIcon } from '@/lib/icons';
import { statementCsv } from '../model/statement-page';

export interface StatementExportProps {
  query: LossStatementQuery;
  /** why the export is not offered (not "Approved only", or provisional figures); null = offered */
  blockedReason: string | null;
  timezone: string;
}

/**
 * CSV of the window's statement rows, approved figures only like the other PLA exports: every page of the
 * server's rows, written as the server sent them (decimal strings).
 */
export function StatementExport({ query, blockedReason, timezone }: StatementExportProps) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const run = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const rows = await fetchAllStatementRows(query);
      const blob = new Blob([withByteOrderMark(statementCsv(rows))], { type: 'text/csv;charset=utf-8' });
      saveBlob(blob, exportFileName(['loss-statement', plantFileDay(query.from, timezone, '')]));
    } catch (error) {
      setFailure(error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-1" data-testid="statement-export">
      <Button size="sm" variant="outline" disabled={blockedReason !== null || busy} title={blockedReason ?? undefined} onClick={() => void run()} data-testid="statement-export-start">
        <ActionIcon.export className="mr-1 h-4 w-4" aria-hidden="true" />
        Export statement (CSV)
      </Button>
      {blockedReason && <p className="text-xs text-muted-foreground">{blockedReason}</p>}
      {failure ? <FriendlyErrorAlert error={failure} /> : null}
    </div>
  );
}
