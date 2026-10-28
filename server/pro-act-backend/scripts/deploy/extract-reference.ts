/**
 * Reference and user extraction from the dev database (TF-PREP-001 task 4). Reads one tenant and its
 * organisation from `proact` (DB_* of the backend `.env`, read-only transaction) and writes the seed:
 *
 *   npm run deploy:extract-reference -- --tenant-code HDPE-TRAIN --out ../../db/seed
 *
 * → reference/R0x0__*.sql (committed), generated/U010__users.sql (git-ignored; the dev password hashes
 * are carried over) and manifest.json. The same source rows give byte-identical SQL files.
 */
import 'dotenv/config';
import { join, resolve } from 'path';
import { Client, TypeOverrides } from 'pg';
import { dbUser } from '../../src/database/connection-env';
import { extractReference } from './extract/extractor';
import { writeManifest } from './extract/manifest';

interface Args {
  tenantCode: string;
  out: string;
}

// json/jsonb, timestamps and dates stay text so values round-trip exactly (key order, microseconds).
const RAW_TEXT_OIDS = [114, 3802, 1082, 1114, 1184];
const typeParsers = new TypeOverrides();
for (const oid of RAW_TEXT_OIDS) {
  typeParsers.setTypeParser(oid, 'text', (value: string): string => value);
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const tenantCode = get('--tenant-code');
  const out = get('--out');
  if (!tenantCode || !out) {
    throw new Error(
      'usage: deploy:extract-reference -- --tenant-code <code> --out <seed dir>',
    );
  }
  return { tenantCode, out: resolve(out) };
}

function connect(env: NodeJS.ProcessEnv): Client {
  if (env.DB_NAME !== 'proact') {
    throw new Error(
      `DB_NAME must be the dev database proact, got ${env.DB_NAME ?? '(unset)'}`,
    );
  }
  return new Client({
    host: env.DB_HOST || 'localhost',
    port: parseInt(env.DB_PORT || '5432', 10),
    user: dbUser(env),
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME,
    options:
      '-c default_transaction_read_only=on -c TimeZone=UTC -c search_path=public',
    types: typeParsers,
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const db = connect(process.env);
  await db.connect();
  try {
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const manifest = await extractReference(db, {
      ...args,
      report: (line) => process.stdout.write(`${line}\n`),
    });
    await db.query('COMMIT');
    writeManifest(join(args.out, 'manifest.json'), manifest);
    process.stdout.write(
      `users: ${manifest.tables.users} (password hashes carried over)\n`,
    );
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `error: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
