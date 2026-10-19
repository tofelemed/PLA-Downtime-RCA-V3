import type { RcaHistoryEntryView } from '@/api/v2/types/rca-history';
import { humanize, labelOf, looksLikeRawId } from '@/features/ux-kit/labels';
import {
  RCA_ACTION_STATUS_LABELS,
  RCA_CAUSE_KIND_LABELS,
  RCA_HISTORY_ACTION_LABELS,
  RCA_HISTORY_ENTITY_LABELS,
  RCA_HISTORY_FIELD_LABELS,
} from '@/features/ux-kit/labels/rca-labels';
import { statusLabel } from './rca-labels';

/** Names for the ids and dates a history value may carry (never shown raw). */
export interface HistoryResolvers {
  user: (id: string) => string;
  unit: (id: string) => string;
  /** a stored instant or calendar day as the plant's day */
  day: (value: string) => string;
  /** title of a recommendation of the case, null when it is gone */
  recommendation: (id: string) => string | null;
  /** "CODE — name" of a cause-library code, null when it is not readable */
  causeCode: (id: string) => string | null;
}

/**
 * Bookkeeping fields of a history entry that mean nothing to a reader (QA L8): record ids, the tenant, who
 * created the row and the derived investigator list. They are never listed under "Changed".
 */
const INTERNAL_FIELDS = new Set(['id', 'rcaId', 'tenantId', 'targetId', 'targetRevision', 'investigatorIds', 'createdBy', 'createdAt', 'linkedAt']);

/** The changed fields a reader is shown (internal bookkeeping fields left out). */
export const visibleChangedFields = (fields: readonly string[]): string[] => fields.filter((field) => !INTERNAL_FIELDS.has(field));

/** Services that act without a user, in words ("System (data repair)"). */
const SERVICE_LABELS: Readonly<Record<string, string>> = { data_repair: 'data repair', rca: 'RCA automation' };

export interface HistoryValueLine {
  field: string;
  label: string;
  from: string;
  to: string;
}

const USER_FIELDS = new Set(['ownerId', 'teamLeadId']);
const DAY_FIELDS = new Set(['dueDate', 'targetCloseDate']);

/** Plain words of an audit action: known actions by name, others as "<record> <verb>". */
export function historyActionLabel(action: string): string {
  const known = RCA_HISTORY_ACTION_LABELS[action];
  if (known) return known;
  const [entity, verb] = action.split('.', 2);
  if (!verb) return humanize(action);
  return `${labelOf(RCA_HISTORY_ENTITY_LABELS, entity)} ${humanize(verb).toLowerCase()}`;
}

export const historyFieldLabel = (field: string): string => labelOf(RCA_HISTORY_FIELD_LABELS, field);

function statusText(entityType: string, value: string): string {
  return entityType === 'rca_action' ? labelOf(RCA_ACTION_STATUS_LABELS, value) : statusLabel(value);
}

function tokenText(entityType: string, field: string, value: string, resolve: HistoryResolvers): string {
  if (field === 'status') return statusText(entityType, value);
  if (field === 'kind') return labelOf(RCA_CAUSE_KIND_LABELS, value);
  if (DAY_FIELDS.has(field)) return resolve.day(value);
  return idText(field, value, resolve);
}

function idText(field: string, value: string, resolve: HistoryResolvers): string {
  if (USER_FIELDS.has(field)) return resolve.user(value);
  if (field === 'unitId') return resolve.unit(value);
  if (field === 'recommendationId') return resolve.recommendation(value) ?? 'a removed recommendation';
  if (field === 'causeCodeId') return resolve.causeCode(value) ?? 'a removed cause code';
  return looksLikeRawId(value) ? 'set' : value;
}

/** One before / after value in words: names for ids, plant days for dates, labels for tokens. */
export function historyValueText(entry: Pick<RcaHistoryEntryView, 'entityType'>, field: string, value: unknown, resolve: HistoryResolvers): string {
  if (value === null || value === undefined || value === '') return 'none';
  if (field.endsWith('Length') && typeof value === 'number') return `${value} characters`;
  if (typeof value === 'string') return tokenText(entry.entityType, field, value, resolve);
  return typeof value === 'number' || typeof value === 'boolean' ? String(value) : 'set';
}

/** The small before / after values of an entry, labelled, in the server's order. */
export function historyValueLines(entry: RcaHistoryEntryView, resolve: HistoryResolvers): HistoryValueLine[] {
  return Object.entries(entry.values).map(([field, change]) => ({
    field,
    label: historyFieldLabel(field),
    from: historyValueText(entry, field, change.from, resolve),
    to: historyValueText(entry, field, change.to, resolve),
  }));
}

/** Who acted: the person's name, the service, or "Former user" when the user is not readable any more. */
export function historyActor(entry: Pick<RcaHistoryEntryView, 'actorName' | 'actorId' | 'service'>): string {
  if (entry.actorName) return entry.actorName;
  if (!entry.actorId && entry.service) return `System (${SERVICE_LABELS[entry.service] ?? humanize(entry.service).toLowerCase()})`;
  return entry.actorId ? 'Former user' : 'System';
}
