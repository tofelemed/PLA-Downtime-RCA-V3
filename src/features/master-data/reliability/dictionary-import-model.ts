import { V2ApiError } from '@/api/v2/errors';
import type { FailureDictionaryImportResult } from '@/api/v2/types/failure-dictionary';
import type { Capabilities } from '@/features/auth/capabilities';
import { plural } from '@/features/ux-kit/format/plural';
import { nextSetupLink, type SaveResult } from '@/features/ux-kit/save-result';
import { sectionNameOf } from '../components/master-data-sections';

export const DICTIONARY_PAGE = '/master-data/failure-dictionary';

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

/** Result dialog of a stored import: the counts, then Back to Failure dictionary · Next: <setup page>. */
export function importResultOf(r: FailureDictionaryImportResult, capabilities: Capabilities, digits: (text: string) => string): SaveResult {
  return {
    title: 'Failure dictionary imported',
    recordLabel: digits(`${plural(r.total, 'row', 'rows')}: ${r.created} new, ${r.superseded} changed (new version), ${r.unchanged} unchanged`),
    message: 'Entries missing from the file are kept. New and changed entries can be chosen on stops now.',
    listPath: DICTIONARY_PAGE,
    listLabel: sectionNameOf(DICTIONARY_PAGE),
    next: nextSetupLink(DICTIONARY_PAGE, { capabilities }),
  };
}
