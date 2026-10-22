import { useImportFailureDictionary } from '@/api/v2/queries/failure-dictionary';
import { useCapabilities } from '@/features/auth/use-capabilities';
import type { CsvImporter } from '@/features/ux-kit/csv-import';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { importErrorsOf, importResultOf, importSummaryOf } from './dictionary-import-model';

/**
 * The failure dictionary's CSV import on the shared import page (SME D11): "Check" is the server's dry
 * run (counts, nothing stored), "Import" stores all rows or none. Row problems come as file lines.
 */
export function useDictionaryImporter(): CsvImporter {
  const { text } = useNumberFormat();
  const capabilities = useCapabilities();
  const command = useImportFailureDictionary();
  return {
    check: async (csv) => ({ status: text(importSummaryOf(await command.submit({ csv, dryRun: true }))), problems: [], ready: true }),
    submit: async (csv) => importResultOf(await command.submit({ csv, dryRun: false }), capabilities, text),
    problemsOf: importErrorsOf,
    lineLabel: 'Line',
    pending: command.isPending,
  };
}
