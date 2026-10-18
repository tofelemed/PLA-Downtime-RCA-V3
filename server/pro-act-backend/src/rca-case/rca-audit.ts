import { createHash } from 'crypto';
import { EntityManager } from 'typeorm';
import { appendAudit, AuditDraft } from '../common/audit/audit-trail';
import { canonicalJson } from '../common/idempotency/idempotency.service';
import { RcaScope } from './rca-scope';

/** Entity types of the RCA field history (`audit_log.entity_type`); every row carries its case id. */
export const RCA_AUDIT_ENTITIES = [
  'rca_case',
  'rca_action',
  'rca_case_link',
  'rca_analysis',
  'rca_cause',
] as const;
export type RcaAuditEntity = (typeof RCA_AUDIT_ENTITIES)[number];

/** A row's persisted fields before or after a command (entity objects are fine: relations are skipped). */
export type RcaSnapshot = object;

export interface RcaAuditEntry {
  entityType: RcaAuditEntity;
  entityId: string;
  caseId: string;
  /** verb of the command (`created`, `updated`, `closed`, …); stored as `<entityType>.<verb>` */
  action: string;
  before: RcaSnapshot | null;
  after: RcaSnapshot | null;
  reason?: string | null;
  revision?: number | null;
  /** small extra facts (tool name, file name, link target) — never a full JSON document */
  detail?: Record<string, unknown>;
}

/** Bookkeeping the database moves on every write, and relation objects: never reported as changed. */
const IGNORED = new Set([
  'rowVersion',
  'updatedAt',
  'updatedBy',
  'createdAt',
  'lastUpdated',
  'rca',
  'tenant',
  'event',
  'events',
  'teamLead',
  'template',
]);

/** Small scalar fields whose before / after values are kept in the detail (beside the hashes). */
const SCALARS = new Set([
  'status',
  'ownerId',
  'dueDate',
  'teamLeadId',
  'priority',
  'targetCloseDate',
  'unitId',
  'kind',
  'causeCodeId',
  'recommendationId',
]);

/** Text fields reported by their length only (the narrative itself stays in its row). */
const LENGTHS = new Set(['rootCause', 'statement']);

type Fields = Readonly<Record<string, unknown>>;

const fieldsOf = (snapshot: RcaSnapshot | null): Fields =>
  (snapshot ?? {}) as Fields;

const comparable = (value: unknown): string => canonicalJson(value ?? null);

const scalar = (value: unknown): unknown =>
  value instanceof Date ? value.toISOString() : (value ?? null);

const lengthOf = (value: unknown): number | null =>
  typeof value === 'string' ? value.trim().length : null;

/** Top-level fields whose stored value differs (undefined and null are the same: "no value"). */
export function changedFields(
  before: RcaSnapshot | null,
  after: RcaSnapshot | null,
): string[] {
  const from = fieldsOf(before);
  const to = fieldsOf(after);
  const keys = new Set([...Object.keys(from), ...Object.keys(to)]);
  return [...keys]
    .filter((key) => !IGNORED.has(key))
    .filter((key) => comparable(from[key]) !== comparable(to[key]))
    .sort();
}

/** Before / after of the small scalar fields among `fields` (text fields as their length). */
export function changedValues(
  fields: readonly string[],
  before: RcaSnapshot | null,
  after: RcaSnapshot | null,
): Record<string, { from: unknown; to: unknown }> {
  const from = fieldsOf(before);
  const to = fieldsOf(after);
  const values: Record<string, { from: unknown; to: unknown }> = {};
  for (const field of fields) {
    if (SCALARS.has(field))
      values[field] = { from: scalar(from[field]), to: scalar(to[field]) };
    if (LENGTHS.has(field))
      values[`${field}Length`] = {
        from: lengthOf(from[field]),
        to: lengthOf(to[field]),
      };
  }
  return values;
}

/** sha256 of the canonical snapshot without bookkeeping and empty fields (null for no row). */
export function snapshotHash(snapshot: RcaSnapshot | null): string | null {
  if (!snapshot) return null;
  const kept = Object.entries(fieldsOf(snapshot)).filter(
    ([key, value]) =>
      !IGNORED.has(key) && value !== undefined && value !== null,
  );
  return createHash('sha256')
    .update(canonicalJson(Object.fromEntries(kept)))
    .digest('hex');
}

function draftOf(scope: RcaScope, entry: RcaAuditEntry): AuditDraft {
  const fields = changedFields(entry.before, entry.after);
  return {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    service: scope.userId ? null : 'rca',
    action: `${entry.entityType}.${entry.action}`,
    entityType: entry.entityType,
    entityId: entry.entityId,
    revision: entry.revision ?? null,
    beforeHash: snapshotHash(entry.before),
    afterHash: snapshotHash(entry.after),
    reason: entry.reason?.trim() || null,
    detail: {
      ...(entry.detail ?? {}),
      caseId: entry.caseId,
      changedFields: fields,
      values: changedValues(fields, entry.before, entry.after),
    },
  };
}

/**
 * RCA field history (item 2): every case command appends `audit_log` rows in its own transaction — who,
 * what, the changed top-level fields, hashes of the row before and after, small scalar values (status,
 * owner, due date, root-cause length) and the reason when the command has one. Large JSON content is
 * never copied: its hash and field name are enough to prove what changed. Rows are append-only.
 */
export function recordRcaAudit(
  manager: EntityManager,
  scope: RcaScope,
  entries: readonly RcaAuditEntry[],
): Promise<void> {
  return appendAudit(
    manager,
    entries.map((entry) => draftOf(scope, entry)),
  );
}

/** A child row of a case (action, cause) as the history needs it. */
interface CaseChild {
  id: string;
  rcaId: string;
  rowVersion: number;
}

/** History entry of a command on a child row of a case (`after` is the row as saved). */
export function childAudit<T extends CaseChild>(
  entityType: Exclude<RcaAuditEntity, 'rca_case'>,
  action: string,
  rows: { before: T | null; after: T | null },
  reason?: string | null,
): RcaAuditEntry {
  const row = (rows.after ?? rows.before) as T;
  return {
    entityType,
    entityId: row.id,
    caseId: row.rcaId,
    action,
    before: rows.before ? { ...rows.before } : null,
    after: rows.after ? { ...rows.after } : null,
    reason: reason ?? null,
    revision: rows.after?.rowVersion ?? null,
  };
}

/** History entry of a command on the case row itself (`after` is the row as saved, null once deleted). */
export function caseAudit(
  action: string,
  rows: { before: CaseRow | null; after: CaseRow | null },
  reason?: string | null,
): RcaAuditEntry {
  const row = (rows.after ?? rows.before) as CaseRow;
  return {
    entityType: 'rca_case',
    entityId: row.id,
    caseId: row.id,
    action,
    before: rows.before ? { ...rows.before } : null,
    after: rows.after ? { ...rows.after } : null,
    reason: reason ?? null,
    revision: rows.after?.rowVersion ?? null,
  };
}

interface CaseRow {
  id: string;
  rowVersion: number;
}
