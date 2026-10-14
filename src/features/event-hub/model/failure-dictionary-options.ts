import type { DictionaryKind, FailureDictionaryEntryView } from '@/api/v2/types/failure-dictionary';
import type { FailureField } from './failure-form';

/** The dictionary list behind each coded failure field (severity is a fixed list). */
export const KIND_OF_FIELD: Readonly<Partial<Record<FailureField, DictionaryKind>>> = {
  maintainableItem: 'maintainable_item',
  failureMode: 'failure_mode',
  failureMechanism: 'failure_mechanism',
  failureCause: 'failure_cause',
  detectionMethod: 'detection_method',
};

const CLASS_BOUND: ReadonlySet<DictionaryKind> = new Set(['maintainable_item', 'failure_mode']);

export interface DictionaryOption {
  value: string;
  label: string;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Equipment class of an asset type, as the server picks it (listed asset types, else code or name). */
export function equipmentClassOf(entries: readonly FailureDictionaryEntryView[], assetType: string | null): string | null {
  if (!assetType?.trim()) return null;
  const classes = entries.filter((e) => e.kind === 'equipment_class');
  const listed = classes.find((c) => c.assetTypes.some((t) => same(t, assetType)));
  const named = classes.find((c) => same(c.code, assetType) || same(c.name, assetType));
  return (listed ?? named)?.code ?? null;
}

/**
 * Choices of a failure field: the dictionary codes of its kind (items and modes of the asset's class plus
 * those valid for every class; pending choices first). `null` = the kind has no entries: free text.
 * A stored value that is no longer a choice stays selectable so an edit does not silently drop it.
 */
export function dictionaryOptions(
  entries: readonly FailureDictionaryEntryView[],
  field: FailureField,
  context: { assetClass: string | null; current: string },
): DictionaryOption[] | null {
  const kind = KIND_OF_FIELD[field];
  if (!kind) return null;
  const ofKind = entries.filter((e) => e.kind === kind);
  if (ofKind.length === 0) return null;
  const allowed = ofKind.filter(
    (e) => !CLASS_BOUND.has(kind) || context.assetClass === null || e.equipmentClass === '' || e.equipmentClass === context.assetClass,
  );
  const sorted = [...allowed].sort((a, b) => Number(b.isPending) - Number(a.isPending) || a.code.localeCompare(b.code));
  const options = sorted.map((e) => ({ value: e.code, label: `${e.code} — ${e.name}${e.isPending ? ' (pending)' : ''}` }));
  if (context.current && !options.some((o) => o.value === context.current)) {
    options.push({ value: context.current, label: `${context.current} (not in the dictionary)` });
  }
  return options;
}
