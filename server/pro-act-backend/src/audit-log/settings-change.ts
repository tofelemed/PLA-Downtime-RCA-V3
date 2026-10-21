/** One changed field of a settings record: the stored value before and after the request. */
export interface FieldChange {
  from: unknown;
  to: unknown;
}

export type FieldChanges = Record<string, FieldChange>;

/** A value as an auditor reads it: images and long text are shortened, an absent value is "(none)". */
function shown(value: unknown): string {
  if (value === null || value === undefined || value === '') return '(none)';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (text.startsWith('data:')) return '(image)';
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

/**
 * The fields of `after` whose value differs from `before` (compared as JSON, so `undefined` and a missing
 * key are equal). Only the `fields` named are compared.
 */
export function changedFields(
  before: object,
  after: object,
  fields: readonly string[],
): FieldChanges {
  const changes: FieldChanges = {};
  const was = before as Record<string, unknown>;
  const now = after as Record<string, unknown>;
  for (const field of fields) {
    const from = was[field] ?? null;
    const to = now[field] ?? null;
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      changes[field] = { from, to };
    }
  }
  return changes;
}

/**
 * "Changed plant settings of Marun HDPE: week start monday → wednesday; digits latin → persian" — the
 * audit summary of a settings change, with each field's label from `labels` (the field name otherwise).
 */
export function changeSummary(
  subject: string,
  changes: FieldChanges,
  labels: Readonly<Record<string, string>> = {},
): string {
  const parts = Object.entries(changes).map(
    ([field, change]) =>
      `${labels[field] ?? field} ${shown(change.from)} → ${shown(change.to)}`,
  );
  return `${subject}: ${parts.join('; ')}`;
}
