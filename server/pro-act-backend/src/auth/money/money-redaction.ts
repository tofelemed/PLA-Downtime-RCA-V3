/**
 * Server-side money redaction (QA re-test decision 2026-10-19): what a response looks like for a caller
 * without the money capability. One rule for every route, applied by `MoneyRedactionInterceptor`:
 *
 * - a **money row** — an object with a `currency` and a figure (`amount`, `nativeAmount`, `value`, `delta`),
 *   or a change-set field formatted as money — is left out (from an array, or as a property);
 * - an array that held only money rows is left out as a whole (`values: [...]` disappears, not `[]`);
 * - the **money keys** below (claims, cost estimates, valuation snapshots and bases) are left out wherever
 *   they appear, plus the keys a route names with `@MoneyFields(...)` (generic names such as `cost` that
 *   are money on that route only).
 *
 * Quantities, durations, counts and states stay. The input is never mutated.
 */
export const MONEY_KEYS: readonly string[] = [
  'claimedAvoidedLoss',
  'claimedCurrency',
  'claimedAvoided',
  'estimatedCost',
  'valuation',
  'valuationTotals',
  'approvedValuation',
  'valueAfter',
  'valuationView',
  'nativeAmount',
  'fxRateIds',
  'fxProvisional',
  'costThreshold',
  'costCurrency',
  'costPerHour',
];

const FIGURE_KEYS = ['amount', 'nativeAmount', 'value', 'delta'] as const;

type Plain = Record<string, unknown>;

/** Left out of its parent (array element or property). */
const OMIT: unique symbol = Symbol('omit');

function isPlainObject(value: unknown): value is Plain {
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value) || value instanceof Date) return false;
  if (Buffer.isBuffer(value) || ArrayBuffer.isView(value)) return false;
  if (value instanceof Map || value instanceof Set) return false;
  // streams and objects that serialize themselves are not response data to walk
  const candidate = value as { pipe?: unknown; toJSON?: unknown };
  return (
    typeof candidate.pipe !== 'function' &&
    typeof candidate.toJSON !== 'function'
  );
}

export function isMoneyRow(value: Plain): boolean {
  if (value.format === 'money') return true;
  if (typeof value.currency !== 'string') return false;
  return FIGURE_KEYS.some((key) => key in value);
}

function redactArray(
  items: readonly unknown[],
  keys: ReadonlySet<string>,
): unknown[] | typeof OMIT {
  const kept: unknown[] = [];
  for (const item of items) {
    const next = redactValue(item, keys);
    if (next !== OMIT) kept.push(next);
  }
  return items.length > 0 && kept.length === 0 ? OMIT : kept;
}

function redactObject(
  value: Plain,
  keys: ReadonlySet<string>,
): Plain | typeof OMIT {
  if (isMoneyRow(value)) return OMIT;
  const out: Plain = {};
  for (const [key, child] of Object.entries(value)) {
    if (keys.has(key)) continue;
    const next = redactValue(child, keys);
    if (next !== OMIT) out[key] = next;
  }
  return out;
}

function redactValue(value: unknown, keys: ReadonlySet<string>): unknown {
  if (Array.isArray(value)) return redactArray(value, keys);
  if (isPlainObject(value)) return redactObject(value, keys);
  return value;
}

/** The response body without money; `routeKeys` adds the route's own money keys (`@MoneyFields`). */
export function withoutMoney(
  body: unknown,
  routeKeys: readonly string[] = [],
): unknown {
  const keys = new Set([...MONEY_KEYS, ...routeKeys]);
  const result = redactValue(body, keys);
  if (result !== OMIT) return result;
  return Array.isArray(body) ? [] : {};
}
