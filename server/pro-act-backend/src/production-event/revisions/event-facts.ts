/**
 * Field sets and value normalisation for event revisions (plan 1.2, spec ING06, §14.2). A "facts"
 * object is a flat JSON snapshot of event fields with canonical values, so two deliveries of the same
 * content compare equal whatever shape the source or the driver produced (Dates, numeric strings).
 */
export type FactScalar = string | number | boolean | null;
/** A structured fact: a digital state `{name, value, isSystem}` or one mapping diagnostic. */
export type FactRecord = { readonly [key: string]: FactScalar };
export type FactValue = FactScalar | FactRecord | readonly FactRecord[];
export type EventFacts = Record<string, FactValue>;

/**
 * Typed attribute facts a source delivers that have no event column (plan 1.3, ING04): the raw reason /
 * impact / OEE values as delivered (digital states keep Name and Value), a supplied duration, and the
 * mapping diagnostics. They live in `event_revisions.source_facts` only; codes are resolved from them.
 */
export const SOURCE_ATTRIBUTE_FACTS = [
  'reason',
  'impactCode',
  'oeeCode',
  'suppliedDurationSeconds',
  'mappingDiagnostics',
] as const;

/** Source facts stored as structures (compared by canonical JSON, never stringified). */
const STRUCTURED_FIELDS: ReadonlySet<string> = new Set([
  'reason',
  'impactCode',
  'oeeCode',
  'mappingDiagnostics',
]);

/** Fields a source system (PI, CMMS, ...) owns: raw timing and attributes. */
export const SOURCE_FIELDS = [
  'startTime',
  'endTime',
  'eventType',
  'description',
  'quantity',
  'cost',
  'value',
  'severity',
  'parameter',
  'limit',
  'limitType',
  'breachDuration',
  'solType',
  'apmType',
  'recommendedAction',
  'workOrderId',
  'failureMode',
  'defectiveQuantity',
  'shift',
  'crew',
  'lossCategory',
  'operatorName',
  'assetId',
  'planId',
  ...SOURCE_ATTRIBUTE_FACTS,
] as const;

/** Source fields backed by a `production_events` column (what a source revision may write). */
export const SOURCE_COLUMN_FIELDS: readonly string[] = SOURCE_FIELDS.filter(
  (field) => !(SOURCE_ATTRIBUTE_FACTS as readonly string[]).includes(field),
);

/** Fields a user codes (reason, impact, OEE, classification, comment). */
export const CODING_FIELDS = [
  'reasonCodeId',
  'originUnitId',
  'originAssetId',
  'plannedEndTime',
  'fromProductId',
  'toProductId',
  'recoveryOfEventId',
  'failureSeverity',
  'maintainableItem',
  'failureMechanism',
  'failureCause',
  'detectionMethod',
  'impactCodeId',
  'oeeCodeId',
  'scheduleClass',
  'oeeComponent',
  'impactMode',
  'impactFraction',
  'description',
] as const;

/** Derived classification and workflow state carried in every effective snapshot. */
export const STATE_FIELDS = [
  'physicalType',
  'physicalState',
  'codingState',
  'rcaState',
  'rcaId',
  'status',
] as const;

/** What the event looks like after a revision: source ∪ coding ∪ state. */
export const EFFECTIVE_FIELDS: readonly string[] = unique([
  ...SOURCE_FIELDS,
  ...CODING_FIELDS,
  ...STATE_FIELDS,
]);

/**
 * Fields a user edit can override against the source: what the source delivers, plus the
 * classification axes a source event-type change would re-derive. Codes and workflow states are the
 * user's own layer and never conflict with the source.
 */
export const OVERRIDABLE_FIELDS: readonly string[] = unique([
  ...SOURCE_FIELDS,
  'physicalType',
  'scheduleClass',
  'oeeComponent',
  'impactMode',
]);

const DATE_FIELDS: ReadonlySet<string> = new Set([
  'startTime',
  'endTime',
  'plannedEndTime',
]);
const NUMERIC_FIELDS: ReadonlySet<string> = new Set([
  'quantity',
  'cost',
  'value',
  'limit',
  'breachDuration',
  'defectiveQuantity',
  'impactFraction',
  'suppliedDurationSeconds',
]);

/**
 * Canonical value of one field: Dates (and date strings of date fields) → ISO with milliseconds,
 * numeric strings of numeric fields → numbers, '' → null; `undefined` stays undefined (dropped).
 */
export function normalizeValue(
  field: string,
  raw: unknown,
): FactValue | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;
  if (raw instanceof Date) return isoOrNull(raw);
  if (DATE_FIELDS.has(field) && typeof raw === 'string') {
    return isoOrNull(new Date(raw)) ?? raw;
  }
  if (STRUCTURED_FIELDS.has(field) && typeof raw === 'object') {
    return structuredOrNull(raw);
  }
  if (NUMERIC_FIELDS.has(field) && typeof raw === 'string') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : raw;
  }
  if (
    typeof raw === 'string' ||
    typeof raw === 'number' ||
    typeof raw === 'boolean'
  ) {
    return raw;
  }
  return JSON.stringify(raw);
}

/** `raw` restricted to `fields`, values normalised, undefined entries dropped. */
export function normalizeFacts(
  raw: Readonly<Record<string, unknown>>,
  fields: readonly string[],
): EventFacts {
  const facts: EventFacts = {};
  for (const field of fields) {
    const value = normalizeValue(field, raw[field]);
    if (value !== undefined) facts[field] = value;
  }
  return facts;
}

/** Snapshot of an entity (or any object) for `fields`. */
export function factsOf(event: object, fields: readonly string[]): EventFacts {
  return normalizeFacts(event as Record<string, unknown>, fields);
}

/** Every field of `fields` present, missing ones as null (a full source snapshot). */
export function completeFacts(
  facts: EventFacts,
  fields: readonly string[],
): EventFacts {
  const complete: EventFacts = {};
  for (const field of fields) complete[field] = facts[field] ?? null;
  return complete;
}

/** Fields whose value differs; a missing key counts as null. Order: `before` keys, then new keys. */
export function changedFields(before: EventFacts, after: EventFacts): string[] {
  const keys = unique([...Object.keys(before), ...Object.keys(after)]);
  return keys.filter(
    (key) => !sameFact(before[key] ?? null, after[key] ?? null),
  );
}

/** Equality of two fact values; structures compare by canonical (key-sorted) JSON. */
export function sameFact(a: FactValue, b: FactValue): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) {
    return false;
  }
  return canonicalJson(a) === canonicalJson(b);
}

function canonicalJson(value: FactRecord | readonly FactRecord[]): string {
  const records: readonly FactRecord[] = isRecordArray(value) ? value : [value];
  const sorted = records.map((record) =>
    Object.keys(record)
      .sort()
      .map((key) => [key, record[key]]),
  );
  return JSON.stringify(isRecordArray(value) ? sorted : sorted[0]);
}

function isRecordArray(
  value: FactRecord | readonly FactRecord[],
): value is readonly FactRecord[] {
  return Array.isArray(value);
}

/** A record of scalars, or an array of such records; anything else is stored as its JSON text. */
function structuredOrNull(raw: object): FactValue {
  if (Array.isArray(raw)) {
    const items: unknown[] = raw;
    return items.every(isScalarRecord) ? items : JSON.stringify(raw);
  }
  return isScalarRecord(raw) ? raw : JSON.stringify(raw);
}

function isScalarRecord(value: unknown): value is FactRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value as Record<string, unknown>).every(
    (entry) =>
      entry === null ||
      typeof entry === 'string' ||
      typeof entry === 'number' ||
      typeof entry === 'boolean',
  );
}

function isoOrNull(date: Date): string | null {
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
