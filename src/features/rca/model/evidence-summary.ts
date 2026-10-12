import type { ApprovedImpactView } from '@/api/v2/types/rca';

/** Display rows of an evidence package snapshot (read as stored; nothing is computed here). */
export interface EvidenceSummary {
  revisions: number | null;
  reason: string | null;
  failureMode: string | null;
  recurrence: { windowDays: number; sameAsset: number | null; sameReason: number | null } | null;
  trendWindow: { from: string; to: string; signals: number } | null;
  approvedImpact: ApprovedImpactView | null;
}

type Bag = Record<string, unknown>;

const bag = (value: unknown): Bag | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Bag) : null;
const num = (value: unknown): number | null => (typeof value === 'number' ? value : null);
const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);

function codeText(value: unknown): string | null {
  const code = bag(value);
  if (!code) return null;
  return [str(code.code), str(code.name)].filter(Boolean).join(' ') || null;
}

function impactOf(value: unknown): ApprovedImpactView | null {
  const impact = bag(value);
  if (!impact || typeof impact.lines !== 'number' || !Array.isArray(impact.quantities) || !Array.isArray(impact.values)) {
    return null;
  }
  return impact as unknown as ApprovedImpactView;
}

export function summarizeEvidence(evidence: Bag | null): EvidenceSummary {
  const revisions = Array.isArray(evidence?.revisions) ? evidence.revisions.length : null;
  const codes = bag(evidence?.causeCodes);
  const recurrence = bag(evidence?.recurrence);
  const trend = bag(evidence?.trendWindow);
  return {
    revisions,
    reason: codeText(codes?.reasonCode),
    failureMode: str(codes?.failureMode),
    recurrence: recurrence
      ? { windowDays: num(recurrence.windowDays) ?? 0, sameAsset: num(recurrence.sameAsset), sameReason: num(recurrence.sameReason) }
      : null,
    trendWindow:
      trend && str(trend.from) && str(trend.to)
        ? { from: str(trend.from) as string, to: str(trend.to) as string, signals: Array.isArray(trend.signalIds) ? trend.signalIds.length : 0 }
        : null,
    approvedImpact: impactOf(evidence?.approvedImpact),
  };
}
