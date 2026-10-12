import { AuditEntryV2View } from './audit-entry-v2.view';

const HEADER = [
  'Time (UTC)',
  'User',
  'Action',
  'Entity type',
  'Entity id',
  'Details',
];

/** RFC 4180 field: quoted, inner quotes doubled; a leading = + - @ is neutralized (CSV injection). */
function field(value: string | null): string {
  const text = value ?? '';
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** The audit export as CSV text (ISO / UTC times, like every export). */
export function auditCsv(rows: readonly AuditEntryV2View[]): string {
  const lines = [HEADER.map(field).join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.timestamp,
        row.actorName ?? 'Unknown user',
        row.action,
        row.entityType,
        row.entityId,
        row.message ?? row.details,
      ]
        .map(field)
        .join(','),
    );
  }
  return `${lines.join('\r\n')}\r\n`;
}
