/**
 * Demo MQTT seeder (demo data only, isolated from product code): everything the publisher simulator
 * (`npm run mqtt:sim`) needs so its events and samples land in ONE tenant instead of the quarantine,
 * created through the public v2 API (validation, audit and idempotency apply). Idempotent: a re-run
 * reports every piece as "kept".
 *
 *   npm run db:seed-demo-mqtt -- --tenant <uuid> [--dry-run] [--unit <uuid|code>]
 *       [--connection <uuid>] [--measurements-connection <uuid>] [--broker-url mqtt://localhost:1884]
 *   npm run db:seed-demo-mqtt -- --demo-plant      # the demo manager account's own tenant
 *
 * What it seeds, in order: the unit of the simulated equipment (`--unit`, a unit coded `Extruder1`,
 * or a demo unit), the reason / impact / OEE codes the simulator names, the "Production Loss" alias
 * rules (catalog and contract attribute names), the MQTT placement rules (element path and topics →
 * the unit), the events and measurements connections (one payload profile each; the subscriber host
 * starts them within its next sweep) and the two measurement signals.
 *
 * Env: PROACT_API_URL (default http://localhost:$PORT from .env), DEMO_SEED_EMAIL / DEMO_SEED_PASSWORD
 * (default the demo manager of `db:seed-demo-users`), DEMO_MQTT_BROKER_URL (default the simulator's
 * `--url` default, overridden by `--broker-url`).
 */
import { Logger } from '@nestjs/common';
import * as dotenv from 'dotenv';
import {
  CliArgs,
  parseCliArgs,
  stringFlag,
  tenantFlag,
} from '../../src/migration-cutover/cli/cli-args';
import { DemoApiClient } from '../demo-valuation/api-client';
import {
  DEFAULT_BROKER_URL,
  SIM_ELEMENT_PATH,
  SIM_TOPICS,
} from './demo-mqtt-plan';
import { ensureAliasRules } from './seed-attribute-mapping';
import { ensureCodes } from './seed-codes';
import { ensureConnections } from './seed-connections';
import { ensurePlacements, ensureUnit } from './seed-placement';
import { ensureSignals } from './seed-signals';
import { Outcome, SeedContext, summarize } from './seed-support';

dotenv.config();

const logger = new Logger('DemoMqttSeed');

const DEMO_EMAIL = 'manager@acme.com';
const DEMO_PASSWORD = 'demo123';

function apiUrl(): string {
  const explicit = process.env.PROACT_API_URL;
  if (explicit) return explicit.replace(/\/+$/, '');
  if (!process.env.PORT) {
    throw new Error('set PROACT_API_URL or PORT (the API port) in the env');
  }
  return `http://localhost:${process.env.PORT}`;
}

/** The tenant to seed: `--tenant <uuid>`, or null for `--demo-plant` (the demo account's own tenant). */
function requestedTenant(args: CliArgs): string | null {
  const tenant = tenantFlag(args);
  if (tenant && args.flags['demo-plant'] === true) {
    throw new Error('give either --tenant <uuid> or --demo-plant, not both');
  }
  if (tenant) return tenant;
  if (args.flags['demo-plant'] === true) return null;
  throw new Error(
    'refusing to run without a tenant: pass --tenant <uuid> or --demo-plant',
  );
}

/** A logged-in client scoped to the requested tenant (or the account's own one). */
async function login(
  requested: string | null,
  dryRun: boolean,
): Promise<SeedContext> {
  const client = new DemoApiClient(apiUrl());
  const ownTenant = await client.login({
    email: process.env.DEMO_SEED_EMAIL ?? DEMO_EMAIL,
    password: process.env.DEMO_SEED_PASSWORD ?? DEMO_PASSWORD,
  });
  const tenantId = requested ?? ownTenant;
  if (!tenantId) throw new Error('the seed account has no tenant');
  client.useTenant(tenantId);
  return { client, tenantId, dryRun, logger };
}

async function seed(ctx: SeedContext, args: CliArgs): Promise<Outcome[]> {
  const unit = await ensureUnit(ctx, stringFlag(args, 'unit'));
  const codes = await ensureCodes(ctx);
  const aliases = await ensureAliasRules(ctx);
  const placements = await ensurePlacements(ctx, unit.id);
  const connections = await ensureConnections(ctx, {
    brokerUrl:
      stringFlag(args, 'broker-url') ??
      process.env.DEMO_MQTT_BROKER_URL ??
      DEFAULT_BROKER_URL,
    eventsId: stringFlag(args, 'connection'),
    measurementsId: stringFlag(args, 'measurements-connection'),
  });
  const signals = await ensureSignals(ctx, {
    connectionId: connections.measurements.id,
    unitId: unit.id,
  });
  return [
    unit.outcome,
    ...codes,
    aliases,
    ...placements,
    connections.events.outcome,
    connections.measurements.outcome,
    ...signals,
  ];
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  const dryRun = args.flags['dry-run'] === true;
  const ctx = await login(requestedTenant(args), dryRun);
  logger.log(
    `${dryRun ? '[dry run] ' : ''}tenant ${ctx.tenantId}: simulator events on ${SIM_TOPICS.events} ` +
      `(element path ${SIM_ELEMENT_PATH}), measurements on ${SIM_TOPICS.measurement('<attribute>')}`,
  );
  const outcomes = await seed(ctx, args);
  logger.log(`demo MQTT seed: ${summarize(outcomes)}`);
  if (!dryRun) {
    logger.log(
      'next: npm run mqtt:sim -- open-close --seed demo --hold 3; npm run mqtt:sim -- measurements --every 1 --count 3',
    );
  }
}

main().catch((error: unknown) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
