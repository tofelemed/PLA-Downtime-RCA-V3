import { RepeatMatch } from './rca-policy';

/** The failure fields of an event that identify "the same problem" (S7 columns; codes or free text). */
export interface FailureIdentity {
  failureMode: string | null;
  failureMechanism: string | null;
  reasonCodeId: string | null;
}

const normalized = (value: string | null): string | null => {
  const text = value?.trim().toLowerCase().replace(/\s+/g, ' ');
  return text ? text : null;
};

/**
 * CA8 repeat identity of an event: its failure mode (normalized: case and spacing ignored, so a code
 * written by the failure dictionary and the same free text match), else its reason code; refined by the
 * mechanism when the policy asks for it and the event has one. null = the event names no mode, so it
 * cannot be matched with another one. `asset` matching (versions before CA8) needs no mode: ''.
 */
export function failureModeKey(
  identity: FailureIdentity,
  match: RepeatMatch,
): string | null {
  if (match === 'asset') return '';
  const mode = normalized(identity.failureMode);
  const base = mode
    ? `mode:${mode}`
    : identity.reasonCodeId
      ? `reason:${identity.reasonCodeId}`
      : null;
  if (!base || match === 'asset_and_mode') return base;
  const mechanism = normalized(identity.failureMechanism);
  return mechanism ? `${base}|mechanism:${mechanism}` : base;
}

/** SQL expression of `failureModeKey` over `production_events` alias `e` (same normalization). */
export function failureModeKeySql(match: RepeatMatch): string {
  if (match === 'asset') return `''`;
  const norm = (column: string) =>
    `NULLIF(lower(btrim(regexp_replace(COALESCE(e."${column}", ''), '\\s+', ' ', 'g'))), '')`;
  const base = `COALESCE('mode:' || ${norm('failure_mode')}, 'reason:' || e."reason_code_id"::text)`;
  if (match === 'asset_and_mode') return base;
  return `(${base} || COALESCE('|mechanism:' || ${norm('failure_mechanism')}, ''))`;
}
