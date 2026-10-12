import { useState } from 'react';
import { fetchAuditCsv, type AuditFilters } from '@/api/v2/queries/administration-audit';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { friendlyToastContent } from '@/features/ux-kit/errors';
import { ActionIcon, StatusIcon } from '@/lib/icons';
import { exportFileName } from '../model/audit-filters';

function download(text: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Downloads the filtered entries as CSV, built by the server (newest first, at most 10 000 rows). */
export function ExportAuditButton({ filters }: { filters: AuditFilters }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      download(await fetchAuditCsv(filters), exportFileName(filters));
    } catch (error) {
      toast({ ...friendlyToastContent(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant="outline" onClick={() => void run()} disabled={busy} aria-busy={busy || undefined} title="At most 10,000 rows; times in UTC">
      {busy ? <StatusIcon.loading aria-hidden="true" className="animate-spin" /> : <ActionIcon.export aria-hidden="true" />}
      Export CSV
    </Button>
  );
}
