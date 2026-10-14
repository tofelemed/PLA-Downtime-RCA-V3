import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useImportFailureDictionary } from '@/api/v2/queries/failure-dictionary';
import { describeError } from '@/features/ux-kit/errors';
import { CSV_HEADER, importErrorsOf, importSummaryOf as summaryOf, type RowError } from './dictionary-import-model';

/**
 * CSV import of the maintenance code export (SME D11): "Check" counts without storing; "Import" stores all
 * rows or none. Changed entries get a new version; entries missing from the file are kept.
 */
export function DictionaryImportPanel() {
  const [csv, setCsv] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [errors, setErrors] = useState<RowError[]>([]);
  const command = useImportFailureDictionary();
  const run = async (dryRun: boolean) => {
    setResult(null);
    setErrors([]);
    try {
      setResult(summaryOf(await command.submit({ csv, dryRun })));
    } catch (error: unknown) {
      setErrors(importErrorsOf(error));
      setResult(describeError(error).message);
    }
  };
  return (
    <div className="space-y-2" data-testid="dictionary-import">
      <Label htmlFor="dictionary-csv">CSV ({CSV_HEADER})</Label>
      <Textarea id="dictionary-csv" rows={6} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={`${CSV_HEADER}\nequipment_class,,PU,Pumps,,,Pump,`} />
      <div className="flex gap-2">
        <Button type="button" variant="outline" disabled={!csv.trim() || command.isPending} onClick={() => void run(true)}>Check</Button>
        <Button type="button" disabled={!csv.trim() || command.isPending} onClick={() => void run(false)}>Import</Button>
      </div>
      {result && <p className="text-sm" role="status">{result}</p>}
      {errors.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-destructive">
          {errors.map((e) => <li key={`${e.line}-${e.message}`}>Line {e.line}: {e.message}</li>)}
        </ul>
      )}
    </div>
  );
}
