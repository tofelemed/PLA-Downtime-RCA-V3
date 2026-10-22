import { useId, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ActionIcon } from '@/lib/icons';
import { DisabledReason } from '../disabled-reason';
import { FormField } from '../form-field';
import { Section } from '../page-layout';
import { SaveFailureAlert } from '../save-result';
import { useNumberFormat } from '../use-number-format';
import { csvTemplateText, downloadCsvTemplate, type CsvImporter, type CsvRowProblem } from './csv-import-model';
import { useCsvImport } from './use-csv-import';

export interface CsvImportFormProps {
  /** prefix of the ids and test ids (`<id>-import`, `<id>-csv`) */
  id: string;
  /** the header row of the file, exactly as the import reads it */
  columns: readonly string[];
  /** the columns in plain words (what each one holds, formats, choices) */
  columnHelp: ReactNode;
  /** file name of the downloadable template, e.g. `failure-dictionary-template.csv` */
  templateName: string;
  /** a sample data line for the paste box's placeholder (example only, never sent) */
  example?: string;
  importer: CsvImporter;
  /** the list the import belongs to: Cancel goes back there */
  listPath: string;
}

function ProblemList({ problems, label }: { problems: readonly CsvRowProblem[]; label: string }) {
  const { number } = useNumberFormat();
  if (problems.length === 0) return null;
  return (
    <ul className="list-disc pl-5 text-sm text-destructive" aria-label="Row problems">
      {problems.map((p) => <li key={`${p.line}-${p.message}`}>{label} {number(p.line)}: {p.message}</li>)}
    </ul>
  );
}

function ExpectedColumns({ id, columns, columnHelp, templateName }: Pick<CsvImportFormProps, 'id' | 'columns' | 'columnHelp' | 'templateName'>) {
  return (
    <Section title="Expected columns" description="The first line of the file names the columns exactly as below; their order does not matter.">
      <div className="space-y-2" id={`${id}-columns`}>
        <code className="block break-all rounded-md bg-muted px-3 py-2 text-xs">{csvTemplateText(columns).trim()}</code>
        <div className="text-sm text-muted-foreground">{columnHelp}</div>
        <Button type="button" variant="outline" size="sm" onClick={() => downloadCsvTemplate(templateName, columns)} data-testid={`${id}-template`}>
          <ActionIcon.export aria-hidden="true" />
          Download template
        </Button>
      </div>
    </Section>
  );
}

/**
 * The one CSV import of the Setup pages (SETUP_UX_FIXES Phase 4), for an import sub-page under the list's
 * header, area tabs and Back: the expected columns with a template, a .csv file or pasted rows, "Check"
 * (nothing stored, row problems listed) and "Import" (all rows or none; the result dialog with the counts).
 * A refusal is the red alert at the top with the row problems, the input kept.
 */
export function CsvImportForm({ id, columns, columnHelp, templateName, example, importer, listPath }: CsvImportFormProps) {
  const form = useCsvImport(importer);
  const reasonId = useId();
  const label = importer.lineLabel ?? 'Row';
  const disabled = importer.pending || form.blocked !== null;
  return (
    <>
      <ExpectedColumns id={id} columns={columns} columnHelp={columnHelp} templateName={templateName} />
      <Section title="Rows to import">
        <div className="space-y-3" data-testid={`${id}-import`}>
          <SaveFailureAlert error={form.feedback.failure} title="The rows were refused; nothing was stored" />
          <FormField id={`${id}-file`} label="CSV file" hint={form.fileName ? `Read from ${form.fileName}; the rows are shown below.` : undefined}>
            <Input id={`${id}-file`} type="file" accept=".csv,text/csv" onChange={(e) => void form.readFile(e.target.files?.[0])} />
          </FormField>
          <FormField id={`${id}-csv`} label="Or paste the rows" hint="CSV with the header line first.">
            <Textarea id={`${id}-csv`} rows={8} className="whitespace-pre-wrap break-all font-mono text-xs" value={form.text} onChange={(e) => form.setText(e.target.value)} placeholder={example ? `${columns.join(',')}\n${example}` : columns.join(',')} />
          </FormField>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={!form.text.trim() || importer.pending} onClick={() => void form.check()} data-testid={`${id}-check`}>Check</Button>
            <Button type="button" disabled={disabled} aria-describedby={form.blocked ? reasonId : undefined} onClick={() => void form.submit()} data-testid={`${id}-submit`}>Import</Button>
            <Button asChild variant="ghost"><Link to={listPath}>Cancel</Link></Button>
          </div>
          <DisabledReason id={reasonId} reason={form.blocked} />
          {form.checked && <p className="text-sm" role="status">{form.checked.status}</p>}
          <ProblemList problems={form.problems} label={label} />
        </div>
      </Section>
      {form.feedback.dialog}
    </>
  );
}
