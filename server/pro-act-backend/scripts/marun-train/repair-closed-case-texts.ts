/**
 * One-off text repair of a closed investigation (QA re-test round 3, owner go-ahead 2026-10-19): removes the
 * course wording (`case-text-plan.ts`) from the case's typed texts and from its child records (actions,
 * causes, evidence, recommendations, analyses: every `rca*` table keyed by the case). A closed case refuses
 * edits through the API, so this writes the database directly, in one transaction with the case's History
 * entry ("Data repair", actor System, `recordCaseRepair`); the case's `row_version` moves so open editors
 * reload. Figures, statuses and decisions are untouched. Idempotent: a second run finds nothing to change.
 *
 *   npx ts-node scripts/marun-train/repair-closed-case-texts.ts -- --case <uuid> [--dry-run]
 *
 * Env: the database of `.env` (DB_HOST, DB_PORT, DB_NAME, …).
 */
import { QueryRunner } from 'typeorm';
import { recordCaseRepair } from '../../src/database/case-repair-history';
import { AppDataSource } from '../../src/database/data-source';
import {
  parseCliArgs,
  stringFlag,
} from '../../src/common/cli/cli-args';
import { UUID_PATTERN } from '../../src/common/cli/cli-args';
import { CellChange, LEFTOVER_WORDING, rowChanges } from './case-text-plan';

const REPAIR = 'RemoveCourseWordingFromClosedCase20261019';
const REASON =
  'Course wording removed from the investigation texts ("Training extruder", "(fictional)", the guide run-hour ' +
  'note); facts, figures and decisions are unchanged';
const TEXT_TYPES = `('text', 'character varying', 'jsonb', 'json')`;

interface TableShape {
  table: string;
  key: string;
  columns: string[];
}

const quoted = (name: string) => `"${name.replace(/"/g, '""')}"`;

async function caseTables(runner: QueryRunner): Promise<TableShape[]> {
  const rows = (await runner.query(
    `SELECT c.table_name AS "table", k.column_name AS "key",
            array_agg(c.column_name::text ORDER BY c.ordinal_position) AS "columns"
       FROM information_schema.columns c
       JOIN information_schema.columns k
         ON k.table_schema = c.table_schema AND k.table_name = c.table_name
        AND (k.column_name IN ('rca_id', 'rcaId') OR (c.table_name = 'rcas' AND k.column_name = 'id'))
      WHERE c.table_schema = 'public' AND c.table_name LIKE 'rca%' AND c.data_type IN ${TEXT_TYPES}
        AND EXISTS (SELECT 1 FROM information_schema.columns i
                     WHERE i.table_schema = c.table_schema AND i.table_name = c.table_name AND i.column_name = 'id')
      GROUP BY c.table_name, k.column_name`,
  )) as TableShape[];
  return rows;
}

async function tableChanges(
  runner: QueryRunner,
  shape: TableShape,
  caseId: string,
): Promise<CellChange[]> {
  const cells = shape.columns
    .map((column) => `${quoted(column)}::text AS ${quoted(column)}`)
    .join(', ');
  const rows = (await runner.query(
    `SELECT "id"::text AS "__id", ${cells} FROM ${quoted(shape.table)} WHERE ${quoted(shape.key)}::text = $1`,
    [caseId],
  )) as Array<Record<string, string | null>>;
  return rows.flatMap(({ __id, ...rest }) =>
    rowChanges(shape.table, String(__id), rest),
  );
}

async function castOf(
  runner: QueryRunner,
  change: CellChange,
): Promise<string> {
  const [row] = (await runner.query(
    `SELECT udt_name AS udt FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [change.table, change.column],
  )) as Array<{ udt: string }>;
  return row.udt === 'jsonb' || row.udt === 'json' ? `::${row.udt}` : '';
}

async function apply(
  runner: QueryRunner,
  changes: readonly CellChange[],
  caseId: string,
): Promise<void> {
  for (const change of changes) {
    const cast = await castOf(runner, change);
    await runner.query(
      `UPDATE ${quoted(change.table)} SET ${quoted(change.column)} = $1${cast} WHERE "id"::text = $2`,
      [change.after, change.id],
    );
  }
  await runner.query(
    `UPDATE "rcas" SET "row_version" = "row_version" + 1, "updated_at" = now() WHERE "id" = $1`,
    [caseId],
  );
  const changedFields = [
    ...new Set(
      changes.map((change) =>
        change.table === 'rcas' ? change.column : change.table,
      ),
    ),
  ];
  await recordCaseRepair(
    runner,
    { name: REPAIR, reason: REASON, changedFields },
    `r."id" = $4`,
    [caseId],
  );
}

function report(changes: readonly CellChange[], dryRun: boolean): void {
  for (const change of changes) {
    process.stdout.write(
      `${change.table}.${change.column} ${change.id}\n  before: ${change.before}\n  after:  ${change.after}\n`,
    );
    const left = new RegExp(LEFTOVER_WORDING.source, 'gi');
    for (const match of change.after.matchAll(left)) {
      const from = Math.max(0, (match.index ?? 0) - 60);
      process.stdout.write(`  REVIEW: …${change.after.slice(from, from + 140)}…
`);
    }
  }
  process.stdout.write(
    `${dryRun ? 'Dry run: ' : ''}${changes.length} text(s) ${dryRun ? 'would change' : 'changed'}\n`,
  );
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  const caseId = stringFlag(args, 'case');
  if (!caseId || !UUID_PATTERN.test(caseId))
    throw new Error('--case <investigation uuid> is required');
  const dryRun = args.flags['dry-run'] === true;
  await AppDataSource.initialize();
  const runner = AppDataSource.createQueryRunner();
  try {
    await runner.startTransaction();
    const changes: CellChange[] = [];
    for (const shape of await caseTables(runner))
      changes.push(...(await tableChanges(runner, shape, caseId)));
    if (!dryRun && changes.length > 0) await apply(runner, changes, caseId);
    await runner.commitTransaction();
    report(changes, dryRun);
  } catch (error) {
    if (runner.isTransactionActive) await runner.rollbackTransaction();
    throw error;
  } finally {
    await runner.release();
    await AppDataSource.destroy();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `repair-closed-case-texts failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
