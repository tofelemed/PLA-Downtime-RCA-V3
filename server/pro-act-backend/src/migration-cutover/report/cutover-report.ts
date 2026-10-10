import { DataSource, EntityManager } from 'typeorm';
import { compareScope, ComparisonResult } from '../compare/mig04-comparison';
import { REMEDIATION_JOBS } from '../remediation/job-registry';
import { bookkeepingPresent } from '../remediation/plan-filter';
import {
  DryRunResult,
  RemediationRunner,
} from '../remediation/remediation-runner';
import { formatCounts, markdownTable, Row } from './markdown';
import { withSavepoint } from './savepoint';
import {
  CARRIED_CHECKS,
  LEGACY_TABLES,
  pilotScope,
  tableCounts,
  tenantOverview,
  V2_TABLES,
} from './report-queries';

export interface CountSnapshot {
  database: string;
  generatedAt: string;
  counts: Record<string, number | null>;
}

export interface ReportOptions {
  tenantId: string | null;
  unitIds: string[] | null;
  /** snapshot taken before a cutover step: adds the before → after section and its row-count gate */
  before?: CountSnapshot;
  /** comparison rows printed per tenant (all differences are always counted) */
  maxRows?: number;
}

export interface CutoverReport {
  markdown: string;
  snapshot: CountSnapshot;
  comparisonGate: 'pass' | 'fail';
  sourceRowsLost: string[];
}

async function readOnly<T>(
  dataSource: DataSource,
  work: (manager: EntityManager) => Promise<T>,
): Promise<T> {
  return dataSource.transaction(async (manager) => {
    await manager.query('SET TRANSACTION READ ONLY');
    return work(manager);
  });
}

/** A job's dry run, or why it could not run on this database. */
export type JobOutcome = DryRunResult | { job: string; error: string };

function jobSection(results: JobOutcome[]): string {
  const rows: Row[] = results.map((r) =>
    'error' in r
      ? { job: r.job, findings: `not available: ${r.error}` }
      : jobRow(r),
  );
  return markdownTable(rows);
}

function jobRow(r: DryRunResult): Row {
  return {
    job: r.job,
    findings: formatCounts(r.counts.findings),
    'would change rows': formatCounts(r.counts.changes),
    'would add review items': formatCounts(r.counts.reviews),
    'would add crosswalk': formatCounts(r.counts.crosswalk),
    'would add legacy values': formatCounts(r.counts.legacyValues),
  };
}

function comparisonSection(
  result: ComparisonResult,
  name: string,
  maxRows: number,
): string {
  const count = (status: string) =>
    result.rows.filter((r) => r.status === status).length;
  const shown = result.rows
    .filter((r) => r.status !== 'equal')
    .slice(0, maxRows);
  const lines = [
    `### ${name}`,
    '',
    `Compared values: ${result.rows.length} — equal ${count('equal')}, explained ${count('explained')}, ` +
      `**unexplained ${result.unexplained}** → gate **${result.gate.toUpperCase()}**.`,
  ];
  if (shown.length === 0) return lines.join('\n');
  lines.push('', `Differences (first ${shown.length}):`, '');
  lines.push(
    markdownTable(
      shown.map((r) => ({
        metric: r.metric,
        scope: r.label,
        v1: r.legacy,
        v2: r.v2,
        delta: r.delta,
        status: r.status,
        explanation: r.explanation
          ? `${r.explanation.category}: ${r.explanation.note}`
          : '',
      })),
    ),
  );
  return lines.join('\n');
}

/** Legacy tables whose row count went down since `before` (must be empty: MIG05). */
export function lostSourceRows(
  before: CountSnapshot,
  after: CountSnapshot,
): string[] {
  return LEGACY_TABLES.filter((table) => {
    const was = before.counts[table];
    const now = after.counts[table];
    return typeof was === 'number' && typeof now === 'number' && now < was;
  });
}

function beforeAfterSection(
  before: CountSnapshot,
  after: CountSnapshot,
): string {
  const rows: Row[] = Object.keys(after.counts).map((table) => ({
    table,
    before: before.counts[table] ?? null,
    after: after.counts[table],
    change:
      typeof before.counts[table] === 'number' &&
      typeof after.counts[table] === 'number'
        ? after.counts[table] - before.counts[table]
        : null,
  }));
  const lost = lostSourceRows(before, after);
  return [
    `Before: \`${before.database}\` at ${before.generatedAt}. Legacy tables that lost rows: ` +
      (lost.length === 0 ? '**none (PASS)**' : `**${lost.join(', ')} (FAIL)**`),
    '',
    markdownTable(rows),
  ].join('\n');
}

interface Facts {
  database: string;
  migrations: Row[];
  counts: Record<string, number | null>;
  tenants: Row[];
  pilot: Row[];
  checks: Array<[string, Row[]]>;
  comparisons: Array<[string, ComparisonResult | string]>;
  bookkeeping: boolean;
}

async function carriedChecks(
  manager: EntityManager,
): Promise<Array<[string, Row[]]>> {
  const checks: Array<[string, Row[]]> = [];
  for (const [title, sql] of CARRIED_CHECKS) {
    const result = await withSavepoint(
      manager,
      (): Promise<Row[]> => manager.query(sql),
    );
    checks.push([
      title,
      result.ok ? result.value : [{ 'not available': result.error }],
    ]);
  }
  return checks;
}

async function comparisonsFor(
  manager: EntityManager,
  tenants: Row[],
  options: ReportOptions,
): Promise<Array<[string, ComparisonResult | string]>> {
  const scoped = tenants.filter((t) =>
    options.tenantId
      ? t.tenant === options.tenantId
      : Number(t.events) > 0 || Number(t.plans) > 0,
  );
  const comparisons: Array<[string, ComparisonResult | string]> = [];
  for (const t of scoped) {
    const scope = { tenantId: String(t.tenant), unitIds: options.unitIds };
    const result = await withSavepoint(manager, () =>
      compareScope(manager, scope),
    );
    comparisons.push([String(t.name), result.ok ? result.value : result.error]);
  }
  return comparisons;
}

async function gatherFacts(
  manager: EntityManager,
  options: ReportOptions,
): Promise<Facts> {
  const [{ db }]: Array<{ db: string }> = await manager.query(
    'SELECT current_database() AS "db"',
  );
  const tenants = await tenantOverview(manager);
  return {
    database: db,
    migrations: await manager.query(
      `SELECT "name" FROM "migrations" ORDER BY "timestamp" DESC LIMIT 3`,
    ),
    counts: await tableCounts(manager, [...LEGACY_TABLES, ...V2_TABLES]),
    tenants,
    pilot: await pilotScope(manager),
    checks: await carriedChecks(manager),
    comparisons: await comparisonsFor(manager, tenants, options),
    bookkeeping: await bookkeepingPresent(manager),
  };
}

function headerLines(
  facts: Facts,
  options: ReportOptions,
  snapshot: CountSnapshot,
): string[] {
  const scope =
    (options.tenantId ? `tenant \`${options.tenantId}\`` : 'all tenants') +
    (options.unitIds ? `, units ${options.unitIds.join(', ')}` : '');
  const bookkeeping = facts.bookkeeping
    ? '3.10 bookkeeping tables present.'
    : '**3.10 bookkeeping tables absent** (migration `MigrationCutover1793225600000` not applied): counts below ignore earlier runs.';
  return [
    '# Cutover report (plan 3.10)',
    '',
    `Database \`${facts.database}\`, generated ${snapshot.generatedAt}. **Read-only / dry run** — every query ran in a ` +
      `\`READ ONLY\` transaction; nothing was written. Scope: ${scope}.`,
    '',
    `Latest migrations: ${facts.migrations.map((m) => `\`${m.name}\``).join(', ')}. ${bookkeeping}`,
  ];
}

function section(title: string, body: string[]): string[] {
  return ['', `## ${title}`, '', ...body];
}

function bodyLines(
  facts: Facts,
  jobs: JobOutcome[],
  maxRows: number,
): string[] {
  const inventory = Object.entries(facts.counts).map(([table, rows]) => ({
    table,
    rows,
  }));
  const checks = facts.checks.flatMap(([title, rows]) => [
    `### ${title}`,
    '',
    markdownTable(rows),
    '',
  ]);
  const comparisons = facts.comparisons.flatMap(([name, result]) => [
    typeof result === 'string'
      ? `### ${name}\n\nnot available: ${result} → gate **FAIL**.`
      : comparisonSection(result, name, maxRows),
    '',
  ]);
  return [
    ...section('Tenants, flags and freeze', [markdownTable(facts.tenants)]),
    ...section('Pilot scope (A5: plant HDPE, unit100–unit500)', [
      markdownTable(facts.pilot),
    ]),
    ...section('Row inventory (null = table absent)', [
      markdownTable(inventory),
    ]),
    ...section('Remediation jobs (§18.2) — dry run', [jobSection(jobs)]),
    ...section('Follow-ups of earlier sub-phases', checks),
    ...section(
      'MIG04 comparison (v1 vs v2, epsilon 1e-6, no balancing adjustments)',
      comparisons,
    ),
  ];
}

function render(
  facts: Facts,
  jobs: JobOutcome[],
  options: ReportOptions,
  snapshot: CountSnapshot,
): string {
  const out = [
    ...headerLines(facts, options, snapshot),
    ...bodyLines(facts, jobs, options.maxRows ?? 40),
  ];
  if (options.before) {
    out.push(
      ...section('Before → after (row counts)', [
        beforeAfterSection(options.before, snapshot),
      ]),
    );
  }
  return `${out.join('\n')}\n`;
}

/** Builds the before/after cutover report (read-only): inventory, job dry runs, carried checks, MIG04. */
export async function buildCutoverReport(
  dataSource: DataSource,
  options: ReportOptions,
): Promise<CutoverReport> {
  const facts = await readOnly(dataSource, (manager) =>
    gatherFacts(manager, options),
  );
  const runner = new RemediationRunner(dataSource);
  const jobs: JobOutcome[] = [];
  for (const job of REMEDIATION_JOBS) {
    jobs.push(
      await runner
        .dryRun(job, { tenantId: options.tenantId })
        .catch((error: unknown) => ({
          job: job.name,
          error: error instanceof Error ? error.message : String(error),
        })),
    );
  }
  const snapshot: CountSnapshot = {
    database: facts.database,
    generatedAt: new Date().toISOString(),
    counts: facts.counts,
  };
  return {
    markdown: render(facts, jobs, options, snapshot),
    snapshot,
    comparisonGate: facts.comparisons.every(
      ([, r]) => typeof r !== 'string' && r.gate === 'pass',
    )
      ? 'pass'
      : 'fail',
    sourceRowsLost: options.before
      ? lostSourceRows(options.before, snapshot)
      : [],
  };
}
