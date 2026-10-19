import { V2ApiError } from '@/api/v2/errors';
import type { FailureDictionaryImportResult } from '@/api/v2/types/failure-dictionary';
import { plural } from '@/features/ux-kit/format/plural';

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
  `${r.dryRun ? 'Check' : 'Import'}: ${plural(r.total, 'row', 'rows')} — ${r.created} new, ${r.superseded} changed (new version), ${r.unchanged} unchanged.`;
