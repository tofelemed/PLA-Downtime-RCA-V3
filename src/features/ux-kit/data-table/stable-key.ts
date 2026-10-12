const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const byKey = ([a]: [string, unknown], [b]: [string, unknown]) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Order-independent string identity of a plain value (object keys sorted), e.g. a list's
 * resource + path + key + query. Two values that would produce the same request give the same string,
 * so a pager can reset when (and only when) the list it pages changes.
 */
export function stableKeyOf(value: unknown): string {
  const text = JSON.stringify(value, (_key, item: unknown) =>
    isPlainObject(item) ? Object.fromEntries(Object.entries(item).sort(byKey)) : item,
  );
  return text ?? '';
}
