import { useImportStandbyRecords } from '@/api/v2/queries/reliability-standby';
import { useCapabilities } from '@/features/auth/use-capabilities';
import type { CsvImporter } from '@/features/ux-kit/csv-import';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { localRowCheck } from '../shared/local-row-check';
import { mapPastedRows, serverRowProblems } from '../shared/row-mapping';
import { standbyImportResult, standbyImportSummary, standbyRowOf } from './standby-import-model';

/**
 * The standby demand / test log on the shared import page (SME D9): "Check" shapes the rows here (the
 * server has no dry run for this log), "Import" sends them and the server stores all or none.
 */
export function useStandbyImporter(): CsvImporter {
  const { text: digits, number } = useNumberFormat();
  const capabilities = useCapabilities();
  const command = useImportStandbyRecords();
  const precheck = (text: string) => localRowCheck(text, standbyRowOf, (value) => number(value));
  return {
    check: async (text) => precheck(text),
    precheck,
    submit: async (text) => standbyImportResult(digits(standbyImportSummary(await command.submit(mapPastedRows(text, standbyRowOf).rows))), capabilities),
    problemsOf: serverRowProblems,
    pending: command.isPending,
  };
}
