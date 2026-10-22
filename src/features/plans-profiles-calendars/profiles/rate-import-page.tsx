import { useId } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DisabledReason } from '@/features/ux-kit/disabled-reason';
import { Page, PageHeader, Section } from '@/features/ux-kit/page-layout';
import { FormField } from '../components/form-field';
import { NativeSelect } from '../components/native-select';
import { ProfilesAreaTabs } from '../components/profiles-area-tabs';
import { SaveRefusalAlert } from '../components/save-refusal-alert';
import { usePlanningRefs } from '../hooks/use-planning-refs';
import { useProfilesBack } from '../hooks/use-profiles-back';
import { useRateImportForm, type ImportKind } from '../hooks/use-rate-import-form';
import { refusalOf } from '../model/refusal';
import { RateImportStatus } from './rate-import-status';

const KINDS = [
  { value: 'budget', label: 'Budget (monthly)' },
  { value: 'forecast', label: 'Forecast (daily)' },
  { value: 'mpc', label: 'MPC (becomes sustained)' },
];
const HEADER = 'unitCode,productCode,operatingMode,rate,timebase,effectiveFrom,effectiveTo';

/**
 * `/planning/profiles/import`: budget / forecast / MPC rates from a CSV file. The file is sent as text;
 * the server parses and validates it in a background job and reports every refused line. When the job has
 * stored the rates the result dialog shows its counts and the form is cleared.
 */
export function RateImportPage() {
  const refs = usePlanningRefs();
  const back = useProfilesBack();
  // the result dialog's "Back to Profiles & rates" returns to the list as the user left it
  const form = useRateImportForm(back.to);
  const reasonId = useId();
  const { fields, blocked } = form;
  const fieldError = (key: string) => refusalOf(form.failure)?.fieldErrors[key];
  return (
    <Page>
      <PageHeader title="Import rates" description="Budget, forecast or MPC rates from a CSV file." back={back} />
      <ProfilesAreaTabs current="profiles" unitId={back.unitId} />
      <Section title="File">
        <div className="space-y-3" data-testid="rate-import-dialog">
          <SaveRefusalAlert error={form.failure} timezone={refs.timezone} />
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="importKind" label="Kind">
              <NativeSelect id="importKind" value={fields.kind} options={KINDS} onChange={(v) => form.set({ kind: v as ImportKind })} />
            </FormField>
            <FormField id="externalId" label="Document reference" required error={fieldError('externalId')} hint="A later file with the same reference is a correction (next revision)">
              <Input id="externalId" value={fields.externalId} onChange={(e) => form.set({ externalId: e.target.value })} />
            </FormField>
          </div>
          <FormField id="csv" label="CSV" required error={fieldError('csv')} hint={`First line: ${HEADER}. Times with their UTC offset.`}>
            <Input key={form.fileKey} id="csvFile" type="file" accept=".csv,text/csv" aria-label="CSV file" onChange={(e) => void form.readFile(e.target.files?.[0])} />
            <Textarea id="csv" rows={8} value={fields.csv} onChange={(e) => form.set({ csv: e.target.value })} placeholder={HEADER} />
          </FormField>
          <div className="flex gap-2">
            <Button onClick={() => void form.submit()} disabled={form.pending || blocked !== null} aria-describedby={blocked ? reasonId : undefined} data-testid="rate-import-submit">
              Import
            </Button>
            <Button asChild variant="outline">
              <Link to={back.to}>Cancel</Link>
            </Button>
          </div>
          <DisabledReason id={reasonId} reason={blocked} />
        </div>
      </Section>
      {form.importId && <RateImportStatus importId={form.importId} />}
      {form.dialog}
    </Page>
  );
}
