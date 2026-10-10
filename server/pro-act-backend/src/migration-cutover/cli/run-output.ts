import { RunCounts } from '../remediation/plan-filter';
import { AppliedRun, DryRunResult } from '../remediation/remediation-runner';
import { formatCounts } from '../report/markdown';

function countLines(counts: RunCounts, verb: string): string[] {
  return [
    `  findings:        ${formatCounts(counts.findings)}`,
    `  ${verb} rows:     ${formatCounts(counts.changes)}`,
    `  review items:    ${formatCounts(counts.reviews)}`,
    `  crosswalk:       ${formatCounts(counts.crosswalk)}`,
    `  legacy values:   ${formatCounts(counts.legacyValues)}`,
  ];
}

/** Text block of a dry run: counts plus the first planned row changes (before → after). */
export function formatDryRun(result: DryRunResult, sample = 10): string {
  const lines = [
    `[DRY RUN] ${result.job} (tenant: ${result.tenantId ?? 'all'}) — nothing written`,
    ...countLines(result.counts, 'would change'),
  ];
  for (const change of result.plan.changes.slice(0, sample)) {
    lines.push(
      `    ${change.kind} ${change.table} ${change.rowId}: ${JSON.stringify(change.before)} → ${JSON.stringify(change.after)}`,
    );
  }
  if (result.plan.changes.length > sample) {
    lines.push(`    … ${result.plan.changes.length - sample} more`);
  }
  return lines.join('\n');
}

export function formatApplied(run: AppliedRun, label = 'APPLIED'): string {
  return [
    `[${label}] ${run.job} — report ${run.reportId} (revert: --revert ${run.reportId})`,
    ...countLines(run.counts, 'changed'),
  ].join('\n');
}
