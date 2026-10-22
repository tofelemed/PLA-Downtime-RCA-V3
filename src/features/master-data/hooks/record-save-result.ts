import type { Capabilities } from '@/features/auth/capabilities';
import { nextSetupLink, type SaveResult } from '@/features/ux-kit/save-result';
import type { RecordResource } from '../api/record-resource';

/** The list a record belongs to ("Back to Production units"). */
export interface RecordListLink {
  to: string;
  label: string;
}

/** "Unit" → "unit"; acronyms stay ("RCA template"). */
export function nounOf(kind: string): string {
  return /^[A-Z]{2}/.test(kind) ? kind : kind.charAt(0).toLowerCase() + kind.slice(1);
}

const textOf = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

/** "Extruder 3 (EXT-3)" from the record's name and code, whichever it has. */
export function recordLabelOf(record: unknown): string | undefined {
  if (typeof record !== 'object' || record === null) return undefined;
  const { name, code } = record as { name?: unknown; code?: unknown };
  const [label, key] = [textOf(name), textOf(code)];
  return label && key ? `${label} (${key})` : label ?? key;
}

/** The production unit a created record is about (the unit itself, an asset's unit): unit-scoped Next links open it. */
function unitIdOf(source: RecordResource, created: { id: string }): string | undefined {
  if (source.entityType === 'unit') return created.id;
  return textOf((created as { unitId?: unknown }).unitId);
}

export interface CreatedRecordResult {
  source: RecordResource;
  kind: string;
  created: { id: string };
  detailPath: (id: string) => string;
  list: RecordListLink;
  capabilities: Capabilities;
  onAddAnother: () => void;
  onDismiss: () => void;
}

/** The result dialog of a master-data create: View <kind> · Add another · Back to <list> · Next: <setup page>. */
export function createdRecordResult(input: CreatedRecordResult): SaveResult {
  const { source, kind, created, list } = input;
  return {
    title: `${kind} created`,
    recordLabel: recordLabelOf(created),
    message: 'It is saved and can be chosen in other records now.',
    viewPath: input.detailPath(created.id),
    viewLabel: `View ${nounOf(kind)}`,
    listPath: list.to,
    listLabel: list.label,
    onAddAnother: input.onAddAnother,
    next: nextSetupLink(list.to, { unitId: unitIdOf(source, created), capabilities: input.capabilities }),
    onDismiss: input.onDismiss,
  };
}
