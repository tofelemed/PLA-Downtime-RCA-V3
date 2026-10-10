/**
 * Plan 3.10: run the §18.2 remediation jobs on the database in `.env` (DB_* variables).
 *
 *   npx ts-node scripts/cutover/remediate.ts --job all [--tenant <uuid>]                 # dry run (default)
 *   npx ts-node scripts/cutover/remediate.ts --job references --tenant <uuid> \
 *       --apply --actor "Jane Doe" --confirm-database proact                             # apply, audited
 *   npx ts-node scripts/cutover/remediate.ts --revert <reportId> --actor "Jane Doe" \
 *       --confirm-database proact                                                        # undo one applied run
 *
 * Jobs: references, sentinels, durations, duplicates, legacy-values, links, periods, reason-tree, rates,
 * units. A dry run uses a READ ONLY transaction. An applied run writes `migration_reports`,
 * `migration_changes` (before / after) and its review / crosswalk / legacy-value rows in one transaction.
 */
import { AppDataSource } from '../../src/database/data-source';
import {
  assertConfirmedDatabase,
  parseCliArgs,
  runMode,
  stringFlag,
  tenantFlag,
} from '../../src/migration-cutover/cli/cli-args';
import {
  formatApplied,
  formatDryRun,
} from '../../src/migration-cutover/cli/run-output';
import {
  findRemediationJob,
  REMEDIATION_JOBS,
} from '../../src/migration-cutover/remediation/job-registry';
import { RemediationRunner } from '../../src/migration-cutover/remediation/remediation-runner';
import { PlanSource } from '../../src/migration-cutover/remediation/remediation-types';

function selectJobs(name: string | null): PlanSource[] {
  if (name === null || name === 'all') return [...REMEDIATION_JOBS];
  const job = findRemediationJob(name);
  if (!job) {
    throw new Error(
      `Unknown job "${name}"; known: ${REMEDIATION_JOBS.map((j) => j.name).join(', ')}`,
    );
  }
  return [job];
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  const mode = runMode(args);
  const tenantId = tenantFlag(args);
  await AppDataSource.initialize();
  try {
    const [{ db }]: Array<{ db: string }> = await AppDataSource.query(
      'SELECT current_database() AS "db"',
    );
    process.stdout.write(`Database: ${db}\n`);
    assertConfirmedDatabase(mode, db);
    const runner = new RemediationRunner(AppDataSource);
    const revertId = stringFlag(args, 'revert');
    if (revertId) {
      if (mode.kind !== 'apply') {
        throw new Error(
          '--revert needs --apply --actor "<name>" --confirm-database <db>',
        );
      }
      const run = await runner.revert(revertId, mode.actor);
      process.stdout.write(`${formatApplied(run, 'REVERTED')}\n`);
      return;
    }
    for (const job of selectJobs(stringFlag(args, 'job'))) {
      const text =
        mode.kind === 'apply'
          ? formatApplied(await runner.apply(job, { tenantId }, mode.actor))
          : formatDryRun(await runner.dryRun(job, { tenantId }));
      process.stdout.write(`${text}\n`);
    }
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
