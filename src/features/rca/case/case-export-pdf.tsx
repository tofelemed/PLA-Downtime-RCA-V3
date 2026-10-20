import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useDisplayCurrency } from '@/features/display-currency/use-display-currency';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { ActionIcon } from '@/lib/icons';
import { useCaseWorkspace } from './case-context';
import { useCaseExportPdf } from './use-case-export-pdf';

const STATE_WORDS: Readonly<Record<string, string>> = {
  queued: 'PDF queued…',
  running: 'Preparing the PDF…',
  completed: 'PDF ready',
  failed: 'The PDF failed',
  cancelled: 'The PDF was cancelled',
};

function ExportButton({ ready, busy, onStart, onDownload }: { ready: boolean; busy: boolean; onStart: () => void; onDownload: () => void }) {
  if (ready)
    return (
      <Button size="sm" onClick={onDownload} data-testid="case-export-pdf-download">
        <ActionIcon.export aria-hidden="true" className="mr-1 h-4 w-4" />
        Download PDF
      </Button>
    );
  return (
    <Button variant="outline" size="sm" disabled={busy} onClick={onStart} data-testid="case-export-pdf-start">
      <ActionIcon.export aria-hidden="true" className="mr-1 h-4 w-4" />
      Export PDF
    </Button>
  );
}

function PdfExport() {
  const { rca } = useCaseWorkspace();
  const { currency } = useDisplayCurrency();
  const pdf = useCaseExportPdf(rca, currency === 'IRR' ? 'IRR' : 'USD');
  return (
    <span className="flex flex-col items-end gap-1 text-xs" data-testid="case-export-pdf" data-state={pdf.state ?? 'idle'}>
      <ExportButton ready={pdf.state === 'completed'} busy={pdf.busy} onStart={() => void pdf.start()} onDownload={() => void pdf.download()} />
      {pdf.state && (
        <span role="status" className="text-muted-foreground" data-testid="case-export-pdf-state">
          {STATE_WORDS[pdf.state] ?? pdf.state}
        </span>
      )}
      {pdf.jobError && <FriendlyErrorAlert error={pdf.jobError.message} title="The PDF failed" />}
      {pdf.failure !== null && <FriendlyErrorAlert error={pdf.failure} title="The PDF could not be made" />}
    </span>
  );
}

/**
 * Item 2.5: "Export PDF" of the case — a server export job (request → poll → download) rendered on the
 * plant clock with money in the display currency. Not offered to roles without money (the PDF carries
 * values and the server refuses them).
 */
export function CaseExportPdf() {
  const { canViewMoney } = useCapabilities();
  return canViewMoney ? <PdfExport /> : null;
}
