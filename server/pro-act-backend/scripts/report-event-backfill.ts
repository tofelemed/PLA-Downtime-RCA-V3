/**
 * Plan 1.1 step 4: evidence for the EventIntervalModel backfill on the database in `.env`.
 *
 *   npx ts-node scripts/report-event-backfill.ts > ../../plans/evidence/backfill-0002.md
 *
 * Read-only. Prints a Markdown report: rows per classification and state, PI sentinels converted,
 * legacy durations assumed minutes vs. left for review, rows breaking the interval CHECK, rows without a
 * tenant.
 */
import { AppDataSource } from '../src/database/data-source';

type Row = Record<string, string | number | null>;

const SECTIONS: ReadonlyArray<[title: string, sql: string]> = [
  [
    'Totals',
    `SELECT count(*) AS rows,
            count(*) FILTER (WHERE end_time IS NULL) AS open_rows,
            count(*) FILTER (WHERE legacy_end_sentinel IS NOT NULL) AS pi_sentinels_converted,
            count(*) FILTER (WHERE tenant_id IS NULL) AS tenant_id_null,
            count(*) FILTER (WHERE end_time IS NOT NULL AND end_time <= start_time) AS interval_check_violations
       FROM production_events`,
  ],
  [
    'Interval CHECK',
    `SELECT conname AS constraint, convalidated AS validated
       FROM pg_constraint WHERE conname = 'CHK_production_events_interval'`,
  ],
  [
    'Legacy durations (MIG §18.2)',
    `SELECT coalesce(legacy_duration_unit_assumed, 'review') AS unit_assumed, count(*) AS rows
       FROM production_events WHERE legacy_duration IS NOT NULL GROUP BY 1 ORDER BY 1`,
  ],
  [
    'Classification by legacy event_type',
    `SELECT coalesce(event_type, '(null)') AS event_type, physical_type, oee_component, impact_mode, count(*) AS rows
       FROM production_events GROUP BY 1, 2, 3, 4 ORDER BY 1, 2`,
  ],
  [
    'States by legacy status',
    `SELECT coalesce(status, '(null)') AS status, physical_state, coding_state, rca_state, count(*) AS rows
       FROM production_events GROUP BY 1, 2, 3, 4 ORDER BY 1, 2, 3, 4`,
  ],
];

function table(rows: Row[]): string {
  if (rows.length === 0) {
    return '_no rows_';
  }
  const headers = Object.keys(rows[0]);
  const line = (cells: Array<string | number | null>) =>
    `| ${cells.map((cell) => String(cell ?? '')).join(' | ')} |`;
  return [
    line(headers),
    line(headers.map(() => '---')),
    ...rows.map((row) => line(headers.map((h) => row[h]))),
  ].join('\n');
}

async function query<T>(sql: string): Promise<T[]> {
  const rows: T[] = await AppDataSource.query(sql);
  return rows;
}

async function main(): Promise<void> {
  await AppDataSource.initialize();
  try {
    const [{ db }] = await query<{ db: string }>(
      'SELECT current_database() AS db',
    );
    const out = [
      `# EventIntervalModel backfill report`,
      '',
      `Database \`${db}\`, generated ${new Date().toISOString()}.`,
    ];
    for (const [title, sql] of SECTIONS) {
      out.push('', `## ${title}`, '', table(await query<Row>(sql)));
    }
    process.stdout.write(`${out.join('\n')}\n`);
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
