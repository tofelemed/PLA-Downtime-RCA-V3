/**
 * Demo persona seeder (demo data only, isolated from product code): 4–5 realistic users for every
 * persona the application defines (legacy roles and scope roles, see persona-catalog.ts), plus the
 * plants they need: "Demo Plant 2" in Demo Org (units, products and Demo Plant's feature flags) and
 * "Partner Org" / "Partner Plant" for cross-tenant isolation tests.
 *
 *   npm run db:seed-demo-personas             # idempotent: reports created / kept
 *   npm run db:seed-demo-personas -- --verify # also logs every persona in and probes its rights
 *
 * Env: DB_* from .env (as seed-demo-users), PROACT_API_URL (default http://localhost:$PORT) for --verify.
 * The shared password is documented in docs/DEMO_PERSONAS.md.
 */
import { Logger } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { Client } from 'pg';
import { parseCliArgs } from '../../src/migration-cutover/cli/cli-args';
import {
  DemoWorld,
  ensureDemoWorld,
  flagValues,
  WorldSummary,
} from './demo-world';
import { DEMO_PERSONAS, FLAG_PROBE_KEY } from './persona-catalog';
import { seedPersonaUsers } from './seed-users';
import { formatVerifyTable, verifyPersonas } from './verify-personas';

dotenv.config();

const logger = new Logger('DemoPersonasSeed');

function apiUrl(): string {
  const explicit = process.env.PROACT_API_URL;
  if (explicit) return explicit.replace(/\/+$/, '');
  if (!process.env.PORT) {
    throw new Error('set PROACT_API_URL or PORT (the API port) in the env');
  }
  return `http://localhost:${process.env.PORT}`;
}

function connect(): Client {
  return new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'proact',
  });
}

function logWorld(summary: WorldSummary, world: DemoWorld): void {
  for (const item of summary.created) logger.log(`created ${item}`);
  logger.log(
    `world: ${summary.created.length} created, ${summary.kept.length} kept`,
  );
  for (const plant of Object.values(world.plants)) {
    logger.log(`plant ${plant.name} (${plant.code}) id=${plant.id}`);
  }
}

async function verify(client: Client, world: DemoWorld): Promise<boolean> {
  const rows = await verifyPersonas({
    apiUrl: apiUrl(),
    world,
    personas: DEMO_PERSONAS,
    flagValues: await flagValues(client, world, FLAG_PROBE_KEY),
  });
  process.stdout.write(`${formatVerifyTable(rows)}\n`);
  const failed = rows.filter((row) => !row.ok);
  logger.log(
    `verify: ${rows.length - failed.length}/${rows.length} users as expected`,
  );
  for (const row of failed)
    logger.error(`FAIL ${row.email}: ${row.probes.join('; ')}`);
  return failed.length === 0;
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  const client = connect();
  await client.connect();
  try {
    const worldSummary: WorldSummary = { created: [], kept: [] };
    const world = await ensureDemoWorld(client, worldSummary);
    logWorld(worldSummary, world);
    const users = await seedPersonaUsers(client, world, DEMO_PERSONAS);
    logger.log(
      `users: ${users.usersCreated} created, ${users.usersUpdated} kept (password/role/plant reset); ` +
        `scopes: ${users.scopesCreated} created, ${users.scopesKept} kept, ${users.scopesRemoved} removed`,
    );
    if (args.flags.verify === true && !(await verify(client, world))) {
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  logger.error(
    `Seeding demo personas failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
