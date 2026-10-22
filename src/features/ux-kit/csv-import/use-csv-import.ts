import { useState } from 'react';
import { useSaveFeedback } from '../save-result';
import { useUnsavedChangesGuard } from '../use-unsaved-changes-guard';
import { importBlockedReason, type CsvCheck, type CsvImporter, type CsvRowProblem } from './csv-import-model';

/**
 * State of the shared CSV import page: file or pasted text, "Check" (dry run, nothing stored), "Import"
 * (result dialog with the counts). A refusal is the red alert with the row problems, the input kept; an
 * accepted import disables Import until the input changes (no double import).
 */
export function useCsvImport(importer: CsvImporter) {
  const [text, setTextState] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [checked, setChecked] = useState<CsvCheck | null>(null);
  const [accepted, setAccepted] = useState<string | null>(null);
  const feedback = useSaveFeedback();
  const blocked = importBlockedReason(text, accepted, importer.pending, feedback.failure !== null || Boolean(checked?.problems.length));
  useUnsavedChangesGuard(text.trim() !== '' && accepted !== text && !importer.pending);

  const setText = (next: string) => {
    setTextState(next);
    setChecked(null);
    feedback.clearFailure();
  };
  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setText(await file.text());
  };
  const check = async () => {
    setChecked(null);
    const outcome = await feedback.run(() => importer.check(text), null).catch(() => null);
    if (outcome) setChecked(outcome);
  };
  const submit = async () => {
    const local = importer.precheck?.(text);
    if (local && !local.ready) return setChecked(local);
    setChecked(null);
    const stored = await feedback.run(() => importer.submit(text), (result) => result).catch(() => null);
    if (stored) setAccepted(text);
  };
  const problems: readonly CsvRowProblem[] = feedback.failure !== null ? importer.problemsOf(feedback.failure) : (checked?.problems ?? []);
  return { text, setText, fileName, readFile, check, submit, checked, problems, blocked, feedback };
}
