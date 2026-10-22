import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SaveFailureAlert, useSaveFeedback, type SaveResult } from '@/features/ux-kit/save-result';
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
  /**
   * The result dialog of a stored import (DECISIONS 2026-10-22: imports end in the dialog, the box is
   * cleared). Without it the summary stays as a status line under the box and the rows stay.
   */
  saved?: (message: string, result: TResult) => SaveResult;
  pending: boolean;
}

interface Outcome {
  status: string | null;
  problems: RowProblem[];
}

const NONE: Outcome = { status: null, problems: [] };

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
export function RowsImportPanel<TRow, TResult>({ id, columns, example, mapRow, submit, summary, saved, pending }: RowsImportPanelProps<TRow, TResult>) {
  const { text: digits, number } = useNumberFormat();
  const [text, setText] = useState('');
  const [outcome, setOutcome] = useState<Outcome>(NONE);
  const feedback = useSaveFeedback();
  const check = () => {
    feedback.clearFailure();
    const mapped = mapPastedRows(text, mapRow);
    if (mapped.error) return setOutcome({ ...NONE, status: mapped.error });
    const ok = mapped.problems.length === 0;
    setOutcome({ ...NONE, problems: mapped.problems, status: ok ? `${plural(mapped.rows.length, 'row', 'rows', number)} ready to import.` : 'Fix the rows below first.' });
  };
  const stored = (result: TResult) => {
    if (saved) setText('');
    setOutcome(saved ? NONE : { ...NONE, status: digits(summary(result)) });
  };
  const run = async () => {
    const mapped = mapPastedRows(text, mapRow);
    if (mapped.error || mapped.problems.length > 0) return check();
    setOutcome(NONE);
    const dialog = saved ? (result: TResult) => saved(digits(summary(result)), result) : null;
    // a refusal stays in the red alert with the server's row problems; the pasted rows are kept
    const result = await feedback.run(() => submit(mapped.rows), dialog).then((value) => ({ value }), () => null);
    if (result) stored(result.value);
  };
  const refused = feedback.failure !== null;
  return (
    <div className="space-y-2" data-testid={`${id}-import`}>
      <SaveFailureAlert error={feedback.failure} title="The server refused the import; nothing was stored" />
      {refused && <ProblemList problems={serverRowProblems(feedback.failure)} />}
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
      {!refused && <ProblemList problems={outcome.problems} />}
      {feedback.dialog}
    </div>
  );
}
