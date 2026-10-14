import type { EvidenceType, ManualKind } from '@/api/v2/types/reconciliation';

/**
 * What a manual line must carry (SME R7 / R8 / R11), mirrored from the server's `line-evidence-rules.ts` so
 * the form offers only valid choices; the server still checks every line (422 with the line index).
 */
export const EVIDENCE_LABELS: Record<EvidenceType, string> = {
  log: 'Shift / stop log',
  work_order: 'Work order',
  rate_record: 'Rate record',
  totalizer: 'Totalizer reading',
  lot_sample: 'Lot / sample',
  movement_record: 'Stock movement record',
  measurement_record: 'Measurement record',
  investigation_note: 'Investigation note',
};

const ALLOWED_EVIDENCE: Record<ManualKind, readonly EvidenceType[]> = {
  availability: ['log', 'work_order'],
  performance: ['rate_record', 'totalizer'],
  quality: ['lot_sample'],
  gain: ['rate_record', 'totalizer', 'measurement_record'],
  bridge: ['movement_record', 'measurement_record'],
  unaccounted_classified: ['investigation_note'],
};

export const CATEGORY_LABELS: Record<string, string> = {
  measurement_adjustment: 'Measurement adjustment',
  timing_inventory: 'Timing / inventory',
  source_data_gap: 'Source data gap',
  unexplained_cause: 'Unexplained cause',
  inventory: 'Inventory',
  timing: 'Timing',
  measurement: 'Measurement',
};

const CATEGORIES: Partial<Record<ManualKind, readonly string[]>> = {
  unaccounted_classified: ['measurement_adjustment', 'timing_inventory', 'source_data_gap', 'unexplained_cause'],
  bridge: ['inventory', 'timing', 'measurement'],
};

export const evidenceTypesOf = (kind: ManualKind): readonly EvidenceType[] => ALLOWED_EVIDENCE[kind];

/** The categories a kind needs; empty when the kind has none. */
export const categoriesOf = (kind: ManualKind): readonly string[] => CATEGORIES[kind] ?? [];

/** Bridges and Unaccounted lines always cite their own record; other kinds only without a linked event. */
export const needsEvidence = (kind: ManualKind, eventCount: number): boolean =>
  kind === 'bridge' || kind === 'unaccounted_classified' || eventCount === 0;
