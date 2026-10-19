import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import type { TextRow } from './delimited-rows';
import { mapPastedRows, serverRowProblems, type MappedRow, type RowProblem } from './row-mapping';
import { plural } from '@/features/ux-kit/format/plural';

export interface RowsImportPanelProps<TRow, TResult> {
  id: string;
  /** the CSV columns in plain words, shown as help under the label (QA re-test N8: no internal field names) */
  columns: string;
  example: string;
  mapRow: (row: TextRow) => MappedRow<TRow>;
  submit: (rows: TRow[]) => Promise<TResult>;
  summary: (result: TResult) => string;
  pending: boolean;
}

interface Outcome {
  status: string | null;
  problems: RowProblem[];
  error: unknown;
}

const NONE: Outcome = { status: null, problems: [], error: null };

function ProblemList({ problems }: { problems: RowProblem[] }) {
  const { number } = useNumberFormat();
  if (problems.length === 0) return null;
  return (
    <ul className="list-disc pl-5 text-sm text-destructive" aria-label="Row problems">
      {problems.map((p) => <li key={`${p.line}-${p.message}`}>Row {number(p.line)}: {p.message}</li>)}
    </ul>
  );
}

/**
 * Paste CSV (first line = column names) or a JSON list: "Check" reads the rows here and lists the shaping
 * problems without sending anything; "Import" sends every row and the server stores all or none, listing
 * its own row problems when it refuses.
 */
export function RowsImportPanel<TRow, TResult>({ id, columns, example, mapRow, submit, summary, pending }: RowsImportPanelProps<TRow, TResult>) {
  const { text: digits, number } = useNumberFormat();
  const [text, setText] = useState('');
  const [outcome, setOutcome] = useState<Outcome>(NONE);
  const check = () => {
    const mapped = mapPastedRows(text, mapRow);
    if (mapped.error) return setOutcome({ ...NONE, status: mapped.error });
    const ok = mapped.problems.length === 0;
    setOutcome({ ...NONE, problems: mapped.problems, status: ok ? `${plural(mapped.rows.length, 'row', 'rows', number)} ready to import.` : 'Fix the rows below first.' });
  };
  const run = async () => {
    const mapped = mapPastedRows(text, mapRow);
    if (mapped.error || mapped.problems.length > 0) return check();
    try {
      setOutcome({ ...NONE, status: digits(summary(await submit(mapped.rows))) });
    } catch (error: unknown) {
      setOutcome({ status: null, problems: serverRowProblems(error), error });
    }
  };
  return (
    <div className="space-y-2" data-testid={`${id}-import`}>
      <Label htmlFor={id}>Rows to import (CSV or JSON list)</Label>
      <p id={`${id}-columns`} className="break-words text-xs text-muted-foreground">
        Columns: {columns}. The first line of a CSV names the columns exactly as in the example.
      </p>
      <Textarea id={id} rows={6} aria-describedby={`${id}-columns`} className="whitespace-pre-wrap break-all" value={text} onChange={(e) => setText(e.target.value)} placeholder={example} />
      <div className="flex gap-2">
        <Button type="button" variant="outline" disabled={!text.trim() || pending} onClick={check}>Check</Button>
        <Button type="button" disabled={!text.trim() || pending} onClick={() => void run()}>Import</Button>
      </div>
      {outcome.status && <p className="text-sm" role="status">{outcome.status}</p>}
      {outcome.error !== null && <FriendlyErrorAlert error={outcome.error} title="The server refused the import; nothing was stored" />}
      <ProblemList problems={outcome.problems} />
    </div>
  );
}
