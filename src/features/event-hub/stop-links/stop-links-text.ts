import type { StopReconciliationView } from '@/api/v2/types/stop-events';

/** Who recorded a stop, in plain words. */
export const SOURCE_KIND_LABELS: Readonly<Record<string, string>> = {
  derived: 'State engine',
  source: 'Source system (PI / MQTT)',
  imported: 'Import',
  manual: 'Manual entry',
};

export const PAIR_STATE_LABELS: Readonly<Record<StopReconciliationView['state'], string>> = {
  suggested: 'Possible duplicate',
  merged: 'Merged duplicate',
  rejected: 'Not a duplicate',
  undone: 'Merge undone',
  expired: 'No longer matching',
};

export const SUGGESTION_LABELS: Readonly<Record<NonNullable<StopReconciliationView['suggestionReason']>, string>> = {
  same_source: 'both from the same source',
  cause_conflict: 'the causes differ',
  ambiguous: 'it matches more than one stop',
};

/** Plain names of the cause fields a merge copies or a conflict names. */
export const CAUSE_FIELD_LABELS: Readonly<Record<string, string>> = {
  reasonCodeId: 'reason',
  assetId: 'asset',
  impactCodeId: 'impact code',
  oeeCodeId: 'OEE code',
  originUnitId: 'origin unit',
  originAssetId: 'origin asset',
  failureMode: 'failure mode',
  failureSeverity: 'failure severity',
  maintainableItem: 'maintainable item',
  failureMechanism: 'failure mechanism',
  failureCause: 'failure cause',
  detectionMethod: 'detection method',
  workOrderId: 'work order',
};

export const fieldList = (fields: readonly string[]) =>
  fields.map((field) => CAUSE_FIELD_LABELS[field] ?? field).join(', ');
