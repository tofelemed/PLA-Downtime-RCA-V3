import { ApiProperty } from '@nestjs/swagger';
import { AuditLog } from '../../../audit-log/audit-log.entity';

/** `GET /v2/audit-logs` item: who did what to which record, when; the actor named on the server. */
export interface AuditEntryV2View {
  id: string;
  timestamp: string;
  actorId: string;
  /** directory name, else the name the client recorded, else null ("Unknown user") */
  actorName: string | null;
  /** CREATE, UPDATE, DELETE, READ, LOGIN, … (screens show a label) */
  action: string;
  entityType: string;
  entityId: string;
  /** one-line summary of the details */
  message: string | null;
  /** the details as stored (JSON pretty-printed), for the entry's detail page */
  details: string | null;
}

export class AuditCount {
  @ApiProperty() key: string;
  @ApiProperty() count: number;
}

export class AuditDayCount {
  @ApiProperty({
    description:
      "Plant-local day, YYYY-MM-DD (default site's timezone, else the tenant's, else UTC)",
  })
  day: string;
  @ApiProperty() count: number;
}

/** `GET /v2/audit-logs/summary`: counts of the filtered entries, computed on the server. */
export class AuditSummaryView {
  @ApiProperty() total: number;
  @ApiProperty({ type: [AuditCount] }) byAction: AuditCount[];
  @ApiProperty({ type: [AuditCount] }) byEntityType: AuditCount[];
  @ApiProperty({ type: [AuditDayCount] }) byDay: AuditDayCount[];
  @ApiProperty() asOf: string;
}

interface ParsedDetails {
  message: string | null;
  userName: string | null;
  pretty: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Details are free text or JSON (`{userName, message, …}` from client audit calls). */
export function parseAuditDetails(
  raw: string | null | undefined,
): ParsedDetails {
  if (!raw) return { message: null, userName: null, pretty: null };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return { message: raw, userName: null, pretty: raw };
    const message = typeof parsed.message === 'string' ? parsed.message : null;
    const userName =
      typeof parsed.userName === 'string' ? parsed.userName : null;
    return { message, userName, pretty: JSON.stringify(parsed, null, 2) };
  } catch {
    return { message: raw, userName: null, pretty: raw };
  }
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Verbs of the automatic entries (`CREATE Task "…" via API POST …`) in the words a screen uses. */
const AUTO_VERBS: Readonly<Record<string, string>> = {
  CREATE: 'Created',
  UPDATE: 'Changed',
  DELETE: 'Deleted',
  READ: 'Viewed',
};

/** Record types whose plain name differs from their split-up type name. */
const RECORD_NOUNS: Readonly<Record<string, string>> = {
  RCA: 'investigation',
  Tenant: 'plant',
  USER: 'user session',
  UserScope: 'access grant',
  AppSettings: 'application setting',
};

const AUTO_ENTRY = /^(CREATE|UPDATE|DELETE|READ) (\S+)(?: "([^"]*)")?(.*)$/;

const ACRONYMS = /\b(rca|oee|pla|fx|mqtt|pi|csv)\b/g;

/** `ProductionPlan` → "production plan", `Exports` (a route name) → "export", `RcaPolicies` → "RCA policy". */
function recordNoun(type: string): string {
  if (RECORD_NOUNS[type]) return RECORD_NOUNS[type];
  const words = type.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  const singular = words.endsWith('ies')
    ? `${words.slice(0, -3)}y`
    : /[^su]s$/.test(words)
      ? words.slice(0, -1)
      : words;
  return singular.replace(ACRONYMS, (word) => word.toUpperCase());
}

/**
 * An automatic entry in words (QA audit: `CREATE Exports "unknown"`): "Created export · Period summary
 * CSV"; an unknown or id-only name is left out.
 */
function autoEntryText(text: string): string {
  const match = AUTO_ENTRY.exec(text);
  if (!match) return text;
  const [, verb, type, label, rest] = match;
  const name =
    label && label !== 'unknown' && label !== '…' ? ` · ${label}` : '';
  return `${AUTO_VERBS[verb]} ${recordNoun(type)}${name}${rest}`;
}

/**
 * The one-line summary a screen shows: the automatic entries' technical tail (` via API PATCH /api/...`)
 * and record ids are left out (the full details stay on the entry's page and in the CSV export), and their
 * raw verb and type read as words.
 */
export function readableSummary(message: string | null): string | null {
  if (!message) return null;
  const text = message
    .split(' via API ')[0]
    .replace(new RegExp(` "${UUID.source}"`, 'gi'), '')
    .replace(UUID, '…')
    .trim();
  return text ? autoEntryText(text) : null;
}

export function toAuditEntryView(
  entry: AuditLog,
  names: ReadonlyMap<string, string>,
): AuditEntryV2View {
  const details = parseAuditDetails(entry.details);
  return {
    id: entry.id,
    timestamp: new Date(entry.timestamp).toISOString(),
    actorId: entry.userId,
    actorName: names.get(entry.userId) ?? details.userName,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    message: readableSummary(details.message),
    details: details.pretty,
  };
}
