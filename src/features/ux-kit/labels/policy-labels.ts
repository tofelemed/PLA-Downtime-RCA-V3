import { labelOf } from './humanize';

/**
 * Names of accounting policy kinds (backend enum `accounting_policy_kind`, plus `loss_policy` of reports).
 * Runs cite them as `<kind>@<version>`, e.g. `oee_policy@3`; screens show "OEE policy v3".
 */
export const POLICY_LABELS: Readonly<Record<string, string>> = {
  oee_policy: 'OEE policy',
  loss_policy: 'Loss policy',
  reconciliation_tolerance: 'Reconciliation tolerance',
  valuation_basis: 'Valuation basis',
  coverage_gate: 'Data coverage rule',
  source_authority: 'Source priority',
  rca_policy: 'RCA policy',
};

const POLICY_REF = /^\s*([A-Za-z][\w.-]*)@(\d+)\s*$/;

/** `oee_policy@1` → "OEE policy v1"; `valuation_basis` → "Valuation basis"; unknown kinds are humanized. */
export function policyLabel(ref: string | null | undefined): string {
  if (!ref || ref.trim() === '') return '—';
  const match = POLICY_REF.exec(ref);
  if (!match) return labelOf(POLICY_LABELS, ref.trim());
  return `${labelOf(POLICY_LABELS, match[1])} v${match[2]}`;
}

/** `oee_policy@3,loss_policy@2` (or an array of refs) → "OEE policy v3 · Loss policy v2". */
export function policyVersionsLabel(refs: string | readonly string[] | null | undefined): string {
  const list = typeof refs === 'string' ? refs.split(',') : refs ?? [];
  const labels = list.map((ref) => ref.trim()).filter((ref) => ref.length > 0).map(policyLabel);
  return labels.length > 0 ? labels.join(' · ') : '—';
}

/** `{ kind, version }` refs as the API sends them in `policyVersions`. */
export function policyRefsLabel(refs: ReadonlyArray<{ kind: string; version: number | string }>): string {
  return policyVersionsLabel(refs.map((ref) => `${ref.kind}@${ref.version}`));
}
