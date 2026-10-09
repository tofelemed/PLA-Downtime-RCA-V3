import { toDec, ZERO } from '../decimal';
import { SourceCandidate, Window } from './period-actuals.types';

/** One line of a certified external daily-production report (ACT08) for a unit and product. */
export interface ExternalLineInput {
  reportId: string;
  externalReportId: string;
  externalRevision: string;
  window: Window;
  basis: 'gross' | 'good';
  gross: string | null;
  good: string | null;
  reject: string | null;
  uom: string | null;
}

/**
 * A certified external record as a period source (ACT08, §3.1 "never count both shift and daily rows"):
 * it applies only when its UTC boundaries are exactly the period window (daily-leaf sites, D03); any
 * other grain is a problem finding and contributes nothing, so a daily total is never pro-rated over
 * shifts. A report that only knows good gives `basis good` with gross unknown (ACT07: no invented
 * quality factor). The record covers the whole window and counts as measured.
 */
export function externalLineCandidate(
  line: ExternalLineInput,
  window: Window,
): SourceCandidate {
  const sameGrain =
    line.window.from.getTime() === window.from.getTime() &&
    line.window.to.getTime() === window.to.getTime();
  const label = `external_report:${line.externalReportId}@${line.externalRevision}`;
  if (!sameGrain) return grainMismatch(line, label);
  const quantity = toDec(line.basis === 'gross' ? line.gross : line.good);
  const reject = toDec(line.reject);
  return {
    source: 'external_report',
    method: 'external_report',
    label,
    basis: line.basis,
    quantity,
    reject,
    measured: quantity ?? ZERO,
    estimated: ZERO,
    uom: line.uom,
    available: quantity !== null,
    observed: quantity ? [{ start: window.from, end: window.to }] : [],
    segments: [
      {
        source: label,
        from: window.from.toISOString(),
        to: window.to.toISOString(),
        quantity: line.basis === 'gross' ? line.gross : line.good,
        method: 'external_report',
        quality: quantity ? 'measured' : 'missing',
      },
    ],
    findings: [],
  };
}

function grainMismatch(
  line: ExternalLineInput,
  label: string,
): SourceCandidate {
  return {
    source: 'external_report',
    method: 'external_report',
    label,
    basis: line.basis,
    quantity: null,
    reject: null,
    measured: ZERO,
    estimated: ZERO,
    uom: line.uom,
    available: false,
    observed: [],
    segments: [],
    findings: [
      {
        code: 'external_report_grain_mismatch',
        severity: 'problem',
        from: line.window.from.toISOString(),
        to: line.window.to.toISOString(),
        detail: { reportId: line.reportId },
      },
    ],
  };
}
