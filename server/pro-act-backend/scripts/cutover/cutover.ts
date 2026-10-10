/**
 * Plan 3.10 (MIG05): cutover operations for one tenant on the database in `.env`. Dry run unless
 * `--apply --actor "<name>" --confirm-database <db>` is given; every applied step is a
 * `migration_reports` row that `remediate.ts --revert <reportId>` can undo.
 *
 *   npx ts-node scripts/cutover/cutover.ts freeze    --tenant <uuid> --reason "cutover HDPE"
 *   npx ts-node scripts/cutover/cutover.ts flags-on  --tenant <uuid> --screens all|v2.eventHub,...
 *   npx ts-node scripts/cutover/cutover.ts release   --tenant <uuid>
 *   npx ts-node scripts/cutover/cutover.ts flags-off --tenant <uuid> --screens all          # rollback
 *   npx ts-node scripts/cutover/cutover.ts explain   --tenant <uuid> --metric plan_target \
 *       --scope-key plan:<id> --legacy 100 --v2 98.5 --category formula_change --note "..."
 *
 * Screens switch in the cutover order (codes → integration → plans → events → analysis → dashboard →
 * reports → RCA) and back in reverse.
 */
import { AppDataSource } from '../../src/database/data-source';
import {
  assertConfirmedDatabase,
  CliArgs,
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
  explanationOperation,
  flagSwitchOperation,
  freezeOperation,
  releaseOperation,
} from '../../src/migration-cutover/cutover/cutover-operations';
import { resolveScreenKeys } from '../../src/migration-cutover/cutover/screen-order';
import { RemediationRunner } from '../../src/migration-cutover/remediation/remediation-runner';
import { PlanSource } from '../../src/migration-cutover/remediation/remediation-types';

const DRY_RUN_ACTOR = '(dry run)';

function required(args: CliArgs, key: string): string {
  const value = stringFlag(args, key);
  if (value === null) throw new Error(`--${key} is required`);
  return value;
}

function operation(args: CliArgs, actor: string): PlanSource {
  switch (args.command) {
    case 'freeze':
      return freezeOperation(
        stringFlag(args, 'reason') ?? 'cutover to v2',
        actor,
      );
    case 'release':
      return releaseOperation(actor);
    case 'flags-on':
    case 'flags-off': {
      const enabling = args.command === 'flags-on';
      return flagSwitchOperation(
        resolveScreenKeys(required(args, 'screens'), enabling),
        enabling,
      );
    }
    case 'explain':
      return explanationOperation({
        metric: required(args, 'metric'),
        scopeKey: required(args, 'scope-key'),
        legacyValue: stringFlag(args, 'legacy'),
        v2Value: stringFlag(args, 'v2'),
        category: required(args, 'category'),
        note: required(args, 'note'),
        author: actor,
      });
    default:
      throw new Error(
        'Command: freeze | release | flags-on | flags-off | explain',
      );
  }
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  const mode = runMode(args);
  const tenantId = tenantFlag(args);
  if (!tenantId) throw new Error('--tenant <uuid> is required');
  const source = operation(
    args,
    mode.kind === 'apply' ? mode.actor : DRY_RUN_ACTOR,
  );
  await AppDataSource.initialize();
  try {
    const [{ db }]: Array<{ db: string }> = await AppDataSource.query(
      'SELECT current_database() AS "db"',
    );
    process.stdout.write(`Database: ${db}\n`);
    assertConfirmedDatabase(mode, db);
    const runner = new RemediationRunner(AppDataSource);
    const text =
      mode.kind === 'apply'
        ? formatApplied(await runner.apply(source, { tenantId }, mode.actor))
        : formatDryRun(await runner.dryRun(source, { tenantId }));
    process.stdout.write(`${text}\n`);
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
