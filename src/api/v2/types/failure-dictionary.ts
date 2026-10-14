import type { components } from '../schema';

/** Lists of the plant's ISO 14224-aligned failure dictionary (SME D11). */
export type DictionaryKind =
  | 'equipment_class'
  | 'maintainable_item'
  | 'failure_mode'
  | 'failure_mechanism'
  | 'failure_cause'
  | 'detection_method';

/** `GET /v2/failure-dictionary` item (backend `failure-dictionary-v2.view.ts`). */
export interface FailureDictionaryEntryView {
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
  effectiveTo: string | null;
  rowVersion: number;
}

export interface FailureDictionaryImportResult {
  total: number;
  created: number;
  superseded: number;
  unchanged: number;
  dryRun: boolean;
}

export type FailureDictionaryCreateBody = components['schemas']['FailureDictionaryCreateDto'];
export type FailureDictionaryImportBody = components['schemas']['FailureDictionaryImportDto'];

export const DICTIONARY_KIND_LABELS: Readonly<Record<DictionaryKind, string>> = {
  equipment_class: 'Equipment class',
  maintainable_item: 'Maintainable item',
  failure_mode: 'Failure mode',
  failure_mechanism: 'Failure mechanism',
  failure_cause: 'Failure cause',
  detection_method: 'Detection method',
};
