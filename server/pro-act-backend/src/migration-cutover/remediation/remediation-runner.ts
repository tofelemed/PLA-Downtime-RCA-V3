import { BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  affectedRows,
  applyChange,
  bulkInsert,
  undoChange,
} from './change-writer';
import { countPlan, filterNew, RunCounts } from './plan-filter';
import {
  CrosswalkDraft,
  JobScope,
  LegacyValueDraft,
  PlanSource,
  RemediationPlan,
  ReviewItemDraft,
  RowChange,
} from './remediation-types';

export interface DryRunResult {
  job: string;
  tenantId: string | null;
  counts: RunCounts;
  plan: RemediationPlan;
}

export interface AppliedRun {
  reportId: string;
  job: string;
  counts: RunCounts;
}

/**
 * Dry-runs, applies and reverts remediation jobs and cutover operations (plan 3.10, D11).
 *
 * - **dry run**: the plan is computed in a `READ ONLY` transaction — nothing can be written.
 * - **apply**: plan, filter what earlier runs recorded, then write the report row, every guarded row
 *   change with its before / after trail, review items, crosswalk and legacy values — one transaction.
 * - **revert**: undoes an applied run's row changes in reverse order (refused when a row moved or a
 *   review item was already decided) and removes the bookkeeping rows it added.
 */
export class RemediationRunner {
  constructor(private readonly dataSource: DataSource) {}

  async dryRun(source: PlanSource, scope: JobScope): Promise<DryRunResult> {
    return this.readOnly(async (manager) => {
      const plan = await filterNew(
        manager,
        source.name,
        await source.plan(manager, scope),
      );
      return {
        job: source.name,
        tenantId: scope.tenantId,
        counts: countPlan(plan),
        plan,
      };
    });
  }

  async apply(
    source: PlanSource,
    scope: JobScope,
    actor: string,
  ): Promise<AppliedRun> {
    requireActor(actor);
    return this.dataSource.transaction(async (manager) => {
      const startedAt = new Date();
      const plan = await filterNew(
        manager,
        source.name,
        await source.plan(manager, scope),
      );
      const reportId = await insertReport(manager, {
        job: source.name,
        tenantId: scope.tenantId,
        actor,
        startedAt,
      });
      await writeChanges(manager, reportId, plan.changes);
      await writeBookkeeping(manager, { reportId, job: source.name }, plan);
      const counts = countPlan(plan);
      await finishReport(manager, reportId, counts);
      return { reportId, job: source.name, counts };
    });
  }

  async revert(reportId: string, actor: string): Promise<AppliedRun> {
    requireActor(actor);
    return this.dataSource.transaction(async (manager) => {
      const startedAt = new Date();
      const report = await lockAppliedReport(manager, reportId);
      const changes = await recordedChanges(manager, reportId);
      for (const change of changes) await undoChange(manager, change);
      const removed = await removeBookkeeping(manager, reportId);
      await manager.query(
        `UPDATE "migration_reports" SET "status" = 'reverted' WHERE "id" = $1`,
        [reportId],
      );
      const revertId = await insertReport(manager, {
        job: report.job,
        tenantId: report.tenant_id,
        actor,
        startedAt,
        revertsReportId: reportId,
      });
      const counts: RunCounts = {
        findings: {},
        changes: { reverted: changes.length },
        reviews: { removed: removed.reviews },
        crosswalk: { removed: removed.crosswalk },
        legacyValues: { removed: removed.legacyValues },
      };
      await finishReport(manager, revertId, counts);
      return { reportId: revertId, job: report.job, counts };
    });
  }

  private async readOnly<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SET TRANSACTION READ ONLY');
      return work(manager);
    });
  }
}

function requireActor(actor: string): void {
  if (!actor || actor.trim().length < 3) {
    throw new BadRequestException({
      code: 'ACTOR_REQUIRED',
      message: 'An applied run needs the operator name (--actor)',
    });
  }
}

interface ReportHeader {
  job: string;
  tenantId: string | null;
  actor: string;
  startedAt: Date;
  revertsReportId?: string;
}

async function insertReport(
  manager: EntityManager,
  header: ReportHeader,
): Promise<string> {
  const rows: Array<{ id: string }> = await manager.query(
    `INSERT INTO "migration_reports" ("job", "tenant_id", "status", "actor", "database_name", "summary",
            "reverts_report_id", "started_at", "finished_at")
     VALUES ($1, $2, $3, $4, current_database(), '{}'::jsonb, $5, $6, now()) RETURNING "id"`,
    [
      header.job,
      header.tenantId,
      header.revertsReportId ? 'revert' : 'applied',
      header.actor.trim(),
      header.revertsReportId ?? null,
      header.startedAt,
    ],
  );
  return rows[0].id;
}

async function finishReport(
  manager: EntityManager,
  reportId: string,
  counts: RunCounts,
): Promise<void> {
  await manager.query(
    `UPDATE "migration_reports" SET "summary" = $2::jsonb, "finished_at" = clock_timestamp() WHERE "id" = $1`,
    [reportId, JSON.stringify(counts)],
  );
}

async function writeChanges(
  manager: EntityManager,
  reportId: string,
  changes: readonly RowChange[],
): Promise<void> {
  let seq = 0;
  for (const change of changes) {
    await applyChange(manager, change);
    seq += 1;
    await manager.query(
      `INSERT INTO "migration_changes" ("report_id", "seq", "kind", "table_name", "row_id", "before", "after")
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
      [
        reportId,
        seq,
        change.kind,
        change.table,
        change.rowId,
        change.before ? JSON.stringify(change.before) : null,
        JSON.stringify(change.after),
      ],
    );
  }
}

const REVIEW_COLUMNS = [
  'tenant_id',
  'job',
  'legacy_table',
  'legacy_id',
  'issue',
  'details',
  'report_id',
];
const CROSSWALK_COLUMNS = [
  'tenant_id',
  'legacy_table',
  'legacy_id',
  'new_table',
  'new_id',
  'relation',
  'report_id',
];
const VALUE_COLUMNS = [
  'tenant_id',
  'legacy_table',
  'legacy_id',
  'plan_id',
  'period_label',
  'metric',
  'value',
  'method',
  'report_id',
];

type Run = { reportId: string; job: string };

const reviewRow = (r: ReviewItemDraft, run: Run) => [
  r.tenantId,
  run.job,
  r.legacyTable,
  r.legacyId,
  r.issue,
  JSON.stringify(r.details),
  run.reportId,
];
const crosswalkRow = (c: CrosswalkDraft, run: Run) => [
  c.tenantId,
  c.legacyTable,
  c.legacyId,
  c.newTable,
  c.newId,
  c.relation,
  run.reportId,
];
const valueRow = (v: LegacyValueDraft, run: Run) => [
  v.tenantId,
  v.legacyTable,
  v.legacyId,
  v.planId,
  v.periodLabel,
  v.metric,
  v.value,
  'UnknownLegacy',
  run.reportId,
];

/** Review items, crosswalk rows and legacy values of a run, each tagged with its report id. */
async function writeBookkeeping(
  manager: EntityManager,
  run: Run,
  plan: RemediationPlan,
): Promise<void> {
  await bulkInsert(
    manager,
    'migration_review',
    REVIEW_COLUMNS,
    plan.reviews.map((r) => reviewRow(r, run)),
  );
  await bulkInsert(
    manager,
    'legacy_id_crosswalk',
    CROSSWALK_COLUMNS,
    plan.crosswalk.map((c) => crosswalkRow(c, run)),
  );
  await bulkInsert(
    manager,
    'legacy_reported_values',
    VALUE_COLUMNS,
    plan.legacyValues.map((v) => valueRow(v, run)),
  );
}

interface ReportRow {
  job: string;
  tenant_id: string | null;
  status: string;
}

async function lockAppliedReport(
  manager: EntityManager,
  reportId: string,
): Promise<ReportRow> {
  const rows: ReportRow[] = await manager.query(
    `SELECT "job", "tenant_id", "status" FROM "migration_reports" WHERE "id" = $1 FOR UPDATE`,
    [reportId],
  );
  if (rows.length === 0 || rows[0].status !== 'applied') {
    throw new ConflictException({
      code: 'MIGRATION_NOT_REVERTIBLE',
      message: `Report ${reportId} is not an applied run (missing, already reverted or itself a revert)`,
    });
  }
  const decided: Array<{ n: number }> = await manager.query(
    `SELECT count(*)::int AS "n" FROM "migration_review" WHERE "report_id" = $1 AND "status" <> 'open'`,
    [reportId],
  );
  if (decided[0].n > 0) {
    throw new ConflictException({
      code: 'MIGRATION_REVIEW_DECIDED',
      message: `${decided[0].n} review item(s) of this run were already resolved or dismissed; revert refused`,
    });
  }
  return rows[0];
}

async function recordedChanges(
  manager: EntityManager,
  reportId: string,
): Promise<RowChange[]> {
  const rows: Array<{
    kind: RowChange['kind'];
    table_name: RowChange['table'];
    row_id: string;
    before: RowChange['before'];
    after: RowChange['after'];
  }> = await manager.query(
    `SELECT "kind", "table_name", "row_id", "before", "after" FROM "migration_changes"
      WHERE "report_id" = $1 ORDER BY "seq" DESC`,
    [reportId],
  );
  return rows.map((row) => ({
    kind: row.kind,
    table: row.table_name,
    rowId: row.row_id,
    before: row.before,
    after: row.after,
  }));
}

async function removeBookkeeping(
  manager: EntityManager,
  reportId: string,
): Promise<{ reviews: number; crosswalk: number; legacyValues: number }> {
  const remove = async (table: string): Promise<number> => {
    const result: unknown = await manager.query(
      `DELETE FROM "${table}" WHERE "report_id" = $1`,
      [reportId],
    );
    return affectedRows(result);
  };
  return {
    reviews: await remove('migration_review'),
    crosswalk: await remove('legacy_id_crosswalk'),
    legacyValues: await remove('legacy_reported_values'),
  };
}
