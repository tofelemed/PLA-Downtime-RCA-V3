import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCreateRateImport } from '@/api/v2/queries/profile-commands';
import { Page, PageHeader, Section } from '@/features/ux-kit/page-layout';
import { FormField } from '../components/form-field';
import { NativeSelect } from '../components/native-select';
import { RefusalNotice } from '../components/refusal-notice';
import { usePlanningRefs } from '../hooks/use-planning-refs';
import { refusalOf } from '../model/refusal';
import { RateImportStatus } from './rate-import-status';

const KINDS = [
  { value: 'budget', label: 'Budget (monthly)' },
  { value: 'forecast', label: 'Forecast (daily)' },
  { value: 'mpc', label: 'MPC (becomes sustained)' },
];
const HEADER = 'unitCode,productCode,operatingMode,rate,timebase,effectiveFrom,effectiveTo';
type ImportKind = 'budget' | 'forecast' | 'mpc';

/**
 * `/planning/profiles/import`: budget / forecast / MPC rates from a CSV file. The file is sent as text;
 * the server parses and validates it in a background job and reports every refused line.
 */
export function RateImportPage() {
  const refs = usePlanningRefs();
  const [kind, setKind] = useState<ImportKind>('forecast');
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
    const accepted = await create.submit({ kind, externalId, csv, ...(fileRef ? { fileRef } : {}) }).catch(() => null);
    if (accepted) setImportId(accepted.jobId);
  };
  return (
    <Page>
      <PageHeader title="Import rates" description="Budget, forecast or MPC rates from a CSV file." back={{ to: '/planning?tab=profiles', label: 'Profiles & rates' }} />
      <Section title="File">
        <div className="space-y-3" data-testid="rate-import-dialog">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="importKind" label="Kind">
              <NativeSelect id="importKind" value={kind} options={KINDS} onChange={(v) => setKind(v as ImportKind)} />
            </FormField>
            <FormField id="externalId" label="Document reference" error={fieldError('externalId')} hint="A later file with the same reference is a correction (next revision)">
              <Input id="externalId" value={externalId} onChange={(e) => setExternalId(e.target.value)} />
            </FormField>
          </div>
          <FormField id="csv" label="CSV" error={fieldError('csv')} hint={`First line: ${HEADER}. Times with their UTC offset.`}>
            <Input id="csvFile" type="file" accept=".csv,text/csv" aria-label="CSV file" onChange={(e) => void readFile(e.target.files?.[0])} />
            <Textarea id="csv" rows={8} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={HEADER} />
          </FormField>
          <RefusalNotice error={create.error} timezone={refs.timezone} />
          <Button onClick={submit} disabled={create.isPending || !externalId || !csv}>
            Import
          </Button>
        </div>
      </Section>
      {importId && <RateImportStatus importId={importId} />}
    </Page>
  );
}
