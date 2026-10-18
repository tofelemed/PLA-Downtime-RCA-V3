import {
  ChangeField,
  ChangeRow,
  ChangeSet,
  ChangeSource,
  FieldSpec,
} from './change-types';

/** The value as sent to the client: decimal strings, ISO instants, `true` / `false`, JSON for the rest. */
export function valueText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  if (typeof value === 'bigint') return value.toString();
  return JSON.stringify(value);
}

/** Numbers compare by value (`28.00000000` equals `28`), everything else by text. */
function sameValue(a: string | null, b: string | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  const left = Number(a);
  const right = Number(b);
  return a.trim() !== '' && b.trim() !== '' && !Number.isNaN(left)
    ? left === right
    : false;
}

function unitOf(spec: FieldSpec, row: ChangeRow): string | null {
  if (typeof spec.unit === 'function') return spec.unit(row);
  return spec.unit ?? null;
}

function fieldOf(
  spec: FieldSpec,
  after: ChangeRow,
  before: ChangeRow | null,
  diff: boolean,
): ChangeField {
  const next = valueText(after[spec.key]);
  const previous = before ? valueText(before[spec.key]) : null;
  return {
    key: spec.key,
    label: spec.label,
    before: previous,
    after: next,
    unit: unitOf(spec, after) ?? (before ? unitOf(spec, before) : null),
    currency:
      spec.currency?.(after) ?? (before && spec.currency?.(before)) ?? null,
    format: spec.format ?? 'text',
    group: spec.group ?? null,
    changed: diff && !spec.informational && !sameValue(previous, next),
  };
}

/**
 * The field list of one pending record: every field the kind declares, with the predecessor's value when
 * there is one (`diff`, `changed` per field) or the pending content alone (`full`). Fields empty on both
 * sides are left out.
 */
export function changeSetOf(source: ChangeSource): ChangeSet {
  const mode = source.mode ?? (source.before ? 'diff' : 'full');
  const diff = mode === 'diff';
  const fields = source.specs
    .map((spec) => fieldOf(spec, source.after, source.before, diff))
    .filter((field) => field.after !== null || field.before !== null);
  return {
    mode,
    beforeLabel:
      mode === 'full' ? null : (source.beforeLabel ?? 'Approved now'),
    afterLabel: source.afterLabel ?? 'Pending',
    fields,
  };
}

/** The one field an inbox row shows: the first changed one, else (no predecessor) the first filled one. */
export function headlineOf(set: ChangeSet): ChangeField | null {
  if (set.mode === 'diff')
    return set.fields.find((field) => field.changed) ?? null;
  return set.fields.find((field) => field.after !== null) ?? null;
}

/** Leaf values of a JSON document by dotted path (arrays of plain values are joined). */
export function flattenJson(value: unknown, prefix = ''): ChangeRow {
  if (value === null || typeof value !== 'object')
    return prefix ? { [prefix]: value } : {};
  if (
    Array.isArray(value) &&
    value.every((entry) => entry === null || typeof entry !== 'object')
  )
    return { [prefix]: value.map((entry) => String(entry)).join(', ') };
  return Object.entries(value).reduce<ChangeRow>(
    (row, [key, entry]) => ({
      ...row,
      ...flattenJson(entry, prefix ? `${prefix}.${key}` : key),
    }),
    {},
  );
}

const words = (part: string) =>
  part
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .toLowerCase();

/** `materiality.reviewerRoles` → `Materiality › reviewer roles`. */
export function pathLabel(path: string): string {
  const text = path.split('.').map(words).join(' › ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Field specs of two JSON documents: every leaf path of either, in the pending document's order first. */
export function jsonSpecs(
  after: ChangeRow,
  before: ChangeRow | null,
  labels: Readonly<Record<string, string>> = {},
): FieldSpec[] {
  const keys = [
    ...new Set([...Object.keys(after), ...Object.keys(before ?? {})]),
  ];
  return keys.map((key) => ({ key, label: labels[key] ?? pathLabel(key) }));
}
