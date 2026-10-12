import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { friendlyToastContent } from '@/features/ux-kit/errors';
import { useToast } from '@/hooks/use-toast';
import { ActionIcon } from '@/lib/icons';

export interface ImportExportButtonsProps {
  /** what is exported, e.g. "RCA templates" */
  what: string;
  onExport: () => Promise<void>;
  /** omitted for read-only users */
  onImport?: (file: File) => Promise<{ created: number; skipped: number }>;
}

/** Export to / import from a JSON file, with a toast that says what happened. */
export function ImportExportButtons({ what, onExport, onImport }: ImportExportButtonsProps) {
  const { toast } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const run = async (work: () => Promise<string>) => {
    setBusy(true);
    try {
      toast({ title: await work() });
    } catch (error) {
      toast({ ...friendlyToastContent(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };
  const importFile = (file: File | undefined) => {
    if (!file || !onImport) return;
    void run(async () => {
      const result = await onImport(file);
      return `Imported ${result.created} ${what}${result.skipped ? `; ${result.skipped} skipped (invalid or already used code)` : ''}`;
    });
    if (input.current) input.current.value = '';
  };
  return (
    <>
      <Button variant="outline" disabled={busy} onClick={() => void run(async () => (await onExport(), `${what} exported`))}>
        <ActionIcon.export aria-hidden="true" className="mr-2 h-4 w-4" />
        Export
      </Button>
      {onImport && (
        <>
          <Button variant="outline" disabled={busy} onClick={() => input.current?.click()}>
            <ActionIcon.import aria-hidden="true" className="mr-2 h-4 w-4" />
            Import
          </Button>
          <input
            ref={input}
            type="file"
            accept="application/json"
            className="hidden"
            aria-label={`Import ${what} from a JSON file`}
            onChange={(event) => importFile(event.target.files?.[0])}
          />
        </>
      )}
    </>
  );
}
