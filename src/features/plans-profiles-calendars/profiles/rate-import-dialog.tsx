import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCreateRateImport } from '@/api/v2/queries/profile-commands';
import { useRateImportJob } from '@/api/v2/queries/profiles';
import { FormField } from '../components/form-field';
import { NativeSelect } from '../components/native-select';
import { RefusalNotice } from '../components/refusal-notice';
import { refusalOf } from '../model/refusal';

const KINDS = [
  { value: 'budget', label: 'Budget (monthly)' },
  { value: 'forecast', label: 'Forecast (daily)' },
  { value: 'mpc', label: 'MPC (becomes sustained)' },
];
const HEADER = 'unitCode,productCode,operatingMode,rate,timebase,effectiveFrom,effectiveTo';

export interface RateImportDialogProps {
  open: boolean;
  timezone: string;
  onClose: () => void;
}

/** Live status of an accepted import: state, counts and the server's per-line report. */
function ImportStatus({ importId }: { importId: string }) {
  const job = useRateImportJob(importId);
  const view = job.data;
  if (!view) return <p className="text-sm">Import accepted — waiting for the worker…</p>;
  return (
    <div className="space-y-1 text-sm" data-testid="rate-import-status" data-state={view.state}>
      <p>
        {view.kind} {view.externalId} revision {view.revision}: <strong>{view.state}</strong>
      </p>
      {view.counts && <p className="text-xs">{Object.entries(view.counts).map(([key, count]) => `${key} ${count}`).join(' · ')}</p>}
      {view.report.length > 0 && (
        <ul className="max-h-40 list-disc overflow-auto pl-5 text-xs text-destructive">
          {view.report.map((line) => (
            <li key={`${line.line}-${line.code}`}>
              line {line.line}: {line.code} — {line.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Budget / forecast / MPC CSV → `POST /rate-imports` (202) → job; the file is sent as text, parsed by the server. */
export function RateImportDialog({ open, timezone, onClose }: RateImportDialogProps) {
  const [kind, setKind] = useState('forecast');
  const [externalId, setExternalId] = useState('');
  const [csv, setCsv] = useState('');
  const [fileRef, setFileRef] = useState<string | undefined>(undefined);
  const [importId, setImportId] = useState<string | null>(null);
  const create = useCreateRateImport();
  const fieldError = (key: string) => refusalOf(create.error)?.fieldErrors[key];

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setFileRef(file.name);
    setCsv(await file.text());
  };
  const submit = async () => {
    const accepted = await create.submit({ kind: kind as 'budget' | 'forecast' | 'mpc', externalId, csv, ...(fileRef ? { fileRef } : {}) }).catch(() => null);
    if (accepted) setImportId(accepted.jobId);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl" data-testid="rate-import-dialog">
        <DialogHeader>
          <DialogTitle>Import budget / forecast / MPC rates</DialogTitle>
          <DialogDescription>The server parses and validates the file and reports every refused line.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField id="importKind" label="Kind">
            <NativeSelect id="importKind" value={kind} options={KINDS} onChange={setKind} />
          </FormField>
          <FormField id="externalId" label="Document id" error={fieldError('externalId')} hint="A later file with the same id is a correction (next revision)">
            <Input id="externalId" value={externalId} onChange={(e) => setExternalId(e.target.value)} />
          </FormField>
        </div>
        <FormField id="csv" label="CSV" error={fieldError('csv')} hint={`Header: ${HEADER}; instants with an offset`}>
          <Input id="csvFile" type="file" accept=".csv,text/csv" aria-label="CSV file" onChange={(e) => readFile(e.target.files?.[0])} />
          <Textarea id="csv" rows={6} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={HEADER} />
        </FormField>
        <RefusalNotice error={create.error} timezone={timezone} />
        {importId && <ImportStatus importId={importId} />}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={submit} disabled={create.isPending || !externalId || !csv}>
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
