import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useImportFailureDictionary } from '@/api/v2/queries/failure-dictionary';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { SaveFailureAlert, useSaveFeedback } from '@/features/ux-kit/save-result';
import { CSV_HEADER, importErrorsOf, importResultOf, importSummaryOf as summaryOf } from './dictionary-import-model';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

/**
 * CSV import of the maintenance code export (SME D11): "Check" counts without storing (the counts below the
 * buttons); "Import" stores all rows or none and ends in the result dialog with the counts, the text area
 * emptied. Changed entries get a new version; entries missing from the file are kept. A refusal of either is
 * the red alert at the top with the row problems under it, the text kept.
 */
export function DictionaryImportPanel() {
  const { text } = useNumberFormat();
  const capabilities = useCapabilities();
  const [csv, setCsv] = useState('');
  const [checked, setChecked] = useState<string | null>(null);
  const command = useImportFailureDictionary();
  const feedback = useSaveFeedback();
  const run = async (dryRun: boolean) => {
    setChecked(null);
    const result = await feedback.run(() => command.submit({ csv, dryRun }), dryRun ? null : (stored) => importResultOf(stored, capabilities, text)).catch(() => null);
    if (!result) return;
    if (dryRun) setChecked(summaryOf(result));
    else setCsv('');
  };
  const errors = importErrorsOf(feedback.failure);
  return (
    <div className="space-y-2" data-testid="dictionary-import">
      <SaveFailureAlert error={feedback.failure} title="The import was refused; nothing was stored" />
      {errors.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-destructive" aria-label="Row problems">
          {errors.map((e) => <li key={`${e.line}-${e.message}`}>Line {e.line}: {e.message}</li>)}
        </ul>
      )}
      <Label htmlFor="dictionary-csv">CSV ({CSV_HEADER})</Label>
      <Textarea id="dictionary-csv" rows={6} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={`${CSV_HEADER}\nequipment_class,,PU,Pumps,,,Pump,`} />
      <div className="flex gap-2">
        <Button type="button" variant="outline" disabled={!csv.trim() || command.isPending} onClick={() => void run(true)}>Check</Button>
        <Button type="button" disabled={!csv.trim() || command.isPending} onClick={() => void run(false)}>Import</Button>
      </div>
      {checked && <p className="text-sm" role="status">{text(checked)}</p>}
      {feedback.dialog}
    </div>
  );
}
