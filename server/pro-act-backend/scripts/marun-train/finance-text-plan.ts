/**
 * Which live finance texts of HDPE-TRAIN still carry course wording (QA re-test N3) and the plain text that
 * replaces each: the FX source, the demand evidence and the valuation policy's notes / backdate reason.
 * Pure: the script reads the records, this decides, the script sends the corrections.
 */
import { DEMAND, FX_RATE, VALUATION_POLICY } from './train-catalog-setup';

/** Course wording that must not appear in the plant's live records. */
export const COURSE_WORDING = /training|lesson\s*\d+|student guide|\bguide\b/i;

export interface FxRow {
  id: string;
  source: string | null;
}
export interface DemandRow {
  id: string;
  evidence: string;
}
export interface PolicyRow {
  id: string;
  notes: string | null;
  backdateReason: string | null;
}

export interface TextCorrection {
  label: string;
  path: string;
  body: Record<string, string>;
}

const stale = (text: string | null | undefined): boolean =>
  Boolean(text && COURSE_WORDING.test(text));

export function fxCorrections(rows: readonly FxRow[]): TextCorrection[] {
  return rows
    .filter((row) => stale(row.source))
    .map((row) => ({
      label: `FX rate ${row.id} source`,
      path: `/v2/fx-rates/${row.id}/source`,
      body: { source: FX_RATE.source },
    }));
}

export function demandCorrections(
  rows: readonly DemandRow[],
): TextCorrection[] {
  return rows
    .filter((row) => stale(row.evidence))
    .map((row) => ({
      label: `demand status ${row.id} evidence`,
      path: `/v2/demand-statuses/${row.id}/evidence`,
      body: { evidence: DEMAND.evidence },
    }));
}

export function policyCorrections(
  rows: readonly PolicyRow[],
): TextCorrection[] {
  return rows.flatMap((row) => {
    const body: Record<string, string> = {};
    if (stale(row.notes)) body.notes = VALUATION_POLICY.notes;
    if (stale(row.backdateReason))
      body.backdateReason = VALUATION_POLICY.backdateReason;
    if (Object.keys(body).length === 0) return [];
    return [
      {
        label: `valuation policy ${row.id} text`,
        path: `/v2/valuation-policies/${row.id}/text`,
        body,
      },
    ];
  });
}
