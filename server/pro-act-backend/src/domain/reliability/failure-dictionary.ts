/**
 * SME D11: ISO 14224-aligned failure-code dictionary of a plant. Equipment classes own their maintainable
 * items and failure modes (ISO 14224 Annex B lists both per equipment class); mechanism, cause and
 * detection method are plant-wide lists (ISO 14224 B.2–B.4). Every list may carry a "pending" entry
 * (unknown / investigation pending) so evidence gaps are recorded instead of forced into a code.
 */
export const DICTIONARY_KINDS = [
  'equipment_class',
  'maintainable_item',
  'failure_mode',
  'failure_mechanism',
  'failure_cause',
  'detection_method',
] as const;
export type DictionaryKind = (typeof DICTIONARY_KINDS)[number];

/** Kinds that belong to one equipment class ('' = valid for every class). */
export const CLASS_BOUND_KINDS: ReadonlySet<DictionaryKind> = new Set([
  'maintainable_item',
  'failure_mode',
]);

/** The event failure field each kind validates (S7 column names stay as they are). */
export const EVENT_FIELD_OF_KIND: Readonly<
  Partial<Record<DictionaryKind, EventFailureField>>
> = {
  maintainable_item: 'maintainableItem',
  failure_mode: 'failureMode',
  failure_mechanism: 'failureMechanism',
  failure_cause: 'failureCause',
  detection_method: 'detectionMethod',
};

export type EventFailureField =
  | 'failureMode'
  | 'maintainableItem'
  | 'failureMechanism'
  | 'failureCause'
  | 'detectionMethod';

/** One dictionary entry in force at the instant being checked. */
export interface DictionaryEntryRef {
  kind: DictionaryKind;
  /** class code of a class-bound entry; '' otherwise */
  equipmentClass: string;
  code: string;
  name: string;
  /** asset types (`assets.asset_type`) an equipment class covers */
  assetTypes: readonly string[];
}

export interface FieldProblem {
  field: EventFailureField;
  message: string;
}

const same = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/** The equipment class covering an asset type: listed in `assetTypes`, else the class code or name. */
export function classOfAssetType(
  entries: readonly DictionaryEntryRef[],
  assetType: string | null,
): string | null {
  if (!assetType?.trim()) return null;
  const classes = entries.filter((e) => e.kind === 'equipment_class');
  const listed = classes.find((c) =>
    c.assetTypes.some((t) => same(t, assetType)),
  );
  const named = classes.find(
    (c) => same(c.code, assetType) || same(c.name, assetType),
  );
  return (listed ?? named)?.code ?? null;
}

/**
 * Checks the failure fields an event write sets against the dictionary in force: a kind without entries
 * stays free text (existing data and plants without a dictionary keep working); otherwise the value must
 * be a code of that kind — for maintainable items and failure modes one of the event asset's class (or
 * valid for every class) when the asset's class is known. Null / absent fields are never checked.
 */
export function checkFailureCodes(
  values: Partial<Record<EventFailureField, string | null>>,
  entries: readonly DictionaryEntryRef[],
  assetClass: string | null,
): FieldProblem[] {
  const problems: FieldProblem[] = [];
  for (const [kind, field] of Object.entries(EVENT_FIELD_OF_KIND) as Array<
    [DictionaryKind, EventFailureField]
  >) {
    const value = values[field]?.trim();
    if (!value) continue;
    const ofKind = entries.filter((e) => e.kind === kind);
    if (ofKind.length === 0) continue;
    const allowed = ofKind.filter(
      (e) =>
        !CLASS_BOUND_KINDS.has(kind) ||
        assetClass === null ||
        e.equipmentClass === '' ||
        e.equipmentClass === assetClass,
    );
    if (allowed.some((e) => e.code === value)) continue;
    const scope =
      assetClass && CLASS_BOUND_KINDS.has(kind)
        ? ` for equipment class ${assetClass}`
        : '';
    problems.push({
      field,
      message: `${field} "${value}" is not a ${kind.replace(/_/g, ' ')} code of the failure dictionary${scope}`,
    });
  }
  return problems;
}
