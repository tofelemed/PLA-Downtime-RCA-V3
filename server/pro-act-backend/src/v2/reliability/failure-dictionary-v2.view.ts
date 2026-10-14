import { DictionaryKind } from '../../domain/reliability/failure-dictionary';
import { FailureDictionaryEntry } from '../../reliability/entities/failure-dictionary-entry.entity';

/** `GET /api/v2/failure-dictionary` item: one version of a dictionary entry (SME D11). */
export interface FailureDictionaryEntryV2View {
  id: string;
  kind: DictionaryKind;
  /** class code of a maintainable item or failure mode; '' = valid for every class */
  equipmentClass: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  assetTypes: string[];
  isPending: boolean;
  effectiveFrom: string;
  /** null while the entry is in force */
  effectiveTo: string | null;
  rowVersion: number;
}

/** `POST /api/v2/failure-dictionary/import` result. */
export interface FailureDictionaryImportV2View {
  total: number;
  created: number;
  /** entries whose content changed: the old version ends, a new one starts */
  superseded: number;
  unchanged: number;
  dryRun: boolean;
}

export function toDictionaryView(
  entry: FailureDictionaryEntry,
): FailureDictionaryEntryV2View {
  return {
    id: entry.id,
    kind: entry.entryKind,
    equipmentClass: entry.equipmentClass,
    code: entry.code,
    name: entry.name,
    description: entry.description,
    category: entry.category,
    assetTypes: entry.assetTypes ?? [],
    isPending: entry.isPending,
    effectiveFrom: entry.effectiveFrom.toISOString(),
    effectiveTo: entry.effectiveTo ? entry.effectiveTo.toISOString() : null,
    rowVersion: entry.rowVersion,
  };
}
