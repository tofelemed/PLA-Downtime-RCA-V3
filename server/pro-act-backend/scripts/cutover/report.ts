/**
 * Plan 3.10: before / after cutover report of the database in `.env` (read-only).
 *
 *   npx ts-node scripts/cutover/report.ts --out ../../plans/evidence/cutover-dry-run.md \
 *       --snapshot-out before.json [--tenant <uuid>] [--units unit100,unit200]
 *   npx ts-node scripts/cutover/report.ts --before before.json --out after.md --strict
 *
 * Every query runs in a READ ONLY transaction: row inventory, tenants / flags / freeze, pilot scope,
 * dry run of every remediation job, follow-ups of earlier sub-phases, MIG04 v1 vs v2 comparison and —
 * with `--before` — the before → after row counts. `--strict` exits 2 when the MIG04 gate fails or a
 * legacy table lost rows.
 */
import { readFileSync, writeFileSync } from 'fs';
import { AppDataSource } from '../../src/database/data-source';
import {
  parseCliArgs,
  stringFlag,
  tenantFlag,
} from '../../src/migration-cutover/cli/cli-args';
import {
  buildCutoverReport,
  CountSnapshot,
} from '../../src/migration-cutover/report/cutover-report';

async function unitIds(
  tenantId: string | null,
  codes: string | null,
): Promise<string[] | null> {
  if (codes === null) return null;
  const wanted = codes.split(',').map((code) => code.trim().toLowerCase());
  const rows: Array<{ id: string }> = await AppDataSource.query(
    `SELECT "id"::text FROM "units" WHERE lower("code") = ANY($1) AND ($2::uuid IS NULL OR "tenant_id" = $2::uuid)`,
    [wanted, tenantId],
  );
  if (rows.length === 0) throw new Error(`No unit matches --units ${codes}`);
  return rows.map((row) => row.id);
}

function readSnapshot(path: string | null): CountSnapshot | undefined {
  if (path === null) return undefined;
  return JSON.parse(readFileSync(path, 'utf8')) as CountSnapshot;
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  const tenantId = tenantFlag(args);
  await AppDataSource.initialize();
  try {
    const report = await buildCutoverReport(AppDataSource, {
      tenantId,
      unitIds: await unitIds(tenantId, stringFlag(args, 'units')),
      before: readSnapshot(stringFlag(args, 'before')),
    });
    const out = stringFlag(args, 'out');
    if (out) writeFileSync(out, report.markdown, 'utf8');
    else process.stdout.write(report.markdown);
    const snapshotOut = stringFlag(args, 'snapshot-out');
    if (snapshotOut)
      writeFileSync(
        snapshotOut,
        JSON.stringify(report.snapshot, null, 2),
        'utf8',
      );
    process.stderr.write(
      `MIG04 gate: ${report.comparisonGate}; legacy tables that lost rows: ${report.sourceRowsLost.join(', ') || 'none'}\n`,
    );
    const failed =
      report.comparisonGate === 'fail' || report.sourceRowsLost.length > 0;
    if (args.flags.strict === true && failed) process.exitCode = 2;
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
