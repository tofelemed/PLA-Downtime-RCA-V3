import { V2ApiError } from '@/api/v2/errors';
import type { FailureDictionaryImportResult } from '@/api/v2/types/failure-dictionary';

export const CSV_HEADER = 'kind,equipmentClass,code,name,description,category,assetTypes,isPending';

export interface RowError {
  line: number;
  message: string;
}

/** Row problems of a 422 DICTIONARY_IMPORT_INVALID (`details.errors`). */
export function importErrorsOf(error: unknown): RowError[] {
  if (!(error instanceof V2ApiError)) return [];
  const errors = error.details?.errors;
  return Array.isArray(errors) ? (errors as RowError[]) : [];
}

export const importSummaryOf = (r: FailureDictionaryImportResult) =>
  `${r.dryRun ? 'Check' : 'Import'}: ${r.total} row(s) — ${r.created} new, ${r.superseded} changed (new version), ${r.unchanged} unchanged.`;
