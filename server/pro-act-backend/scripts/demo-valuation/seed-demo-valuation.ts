/**
 * Demo valuation seeder (demo data only, isolated from product code): random-but-deterministic USD
 * valuation rates for ONE tenant, created and approved through the public v2 API, plus — unless
 * `--skip-impact-coding` — default impact codes on the reason codes its stop events use, so cost-per-hour
 * lines are not `impact_code_missing`.
 *
 *   npm run db:seed-demo-valuation -- --tenant <uuid> [--dry-run] [--seed <text>] [--skip-impact-coding]
 *   npm run db:seed-demo-valuation -- --demo-plant      # the demo manager account's own tenant
 *
 * Env: PROACT_API_URL (default http://localhost:$PORT from .env), DEMO_SEED_EMAIL / DEMO_SEED_PASSWORD
 * (the author of the drafts; default the demo manager of `db:seed-demo-users`) and DEMO_APPROVER_EMAIL /
 * DEMO_APPROVER_PASSWORD (a second account with manager_approver rights on the tenant that approves them —
 * the author never approves its own draft, 403 SEPARATION_OF_DUTIES; default the demo admin).
 * Idempotent: keys that already have an approved version are kept, and every value is reproducible from
 * the seed. Recalculate the periods afterwards (POST /api/v2/production-periods/recalculate).
 */
import { Logger } from '@nestjs/common';
import * as dotenv from 'dotenv';
import {
  CliArgs,
  parseCliArgs,
  stringFlag,
  tenantFlag,
} from '../../src/migration-cutover/cli/cli-args';
import { DemoApiClient } from './api-client';
import { DEFAULT_SEED, DEMO_RANGES } from './demo-random';
import { seedImpactCoding } from './seed-impact-coding';
import { seedValuationRates } from './seed-rates';

dotenv.config();

const logger = new Logger('DemoValuationSeed');

/** D08 reporting currency the demo rates are entered in; IRR comes from the approved FX rate. */
const CURRENCY = 'USD';
const EFFECTIVE_FROM = '2026-10-01T00:00:00Z';
const DEMO_EMAIL = 'manager@acme.com';
const DEMO_PASSWORD = 'demo123';
const DEMO_APPROVER_EMAIL = 'admin@acme.com';
const DEMO_APPROVER_PASSWORD = 'demo123';

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

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  const requested = requestedTenant(args);
  const seed = stringFlag(args, 'seed') ?? DEFAULT_SEED;
  const dryRun = args.flags['dry-run'] === true;
  const client = new DemoApiClient(apiUrl());
  const ownTenant = await client.login({
    email: process.env.DEMO_SEED_EMAIL ?? DEMO_EMAIL,
    password: process.env.DEMO_SEED_PASSWORD ?? DEMO_PASSWORD,
  });
  const tenantId = requested ?? ownTenant;
  if (!tenantId) throw new Error('the seed account has no tenant');
  client.useTenant(tenantId);
  const approver = new DemoApiClient(apiUrl());
  await approver.login({
    email: process.env.DEMO_APPROVER_EMAIL ?? DEMO_APPROVER_EMAIL,
    password: process.env.DEMO_APPROVER_PASSWORD ?? DEMO_APPROVER_PASSWORD,
  });
  approver.useTenant(tenantId);
  logger.log(
    `${dryRun ? '[dry run] ' : ''}tenant ${tenantId}, seed "${seed}", ${CURRENCY} from ${EFFECTIVE_FROM}`,
  );
  const rates = await seedValuationRates({
    client,
    approver,
    tenantId,
    seed,
    currency: CURRENCY,
    effectiveFrom: EFFECTIVE_FROM,
    dryRun,
  });
  logger.log(
    `valuation rates: ${rates.planned.length} planned, ${rates.created} created+approved, ` +
      `${rates.approvedDrafts} drafts approved, ${rates.kept} kept (already approved), ` +
      `${rates.skippedNoUom} profiles without quantity unit skipped`,
  );
  logger.log(`ranges (${CURRENCY}): ${JSON.stringify(DEMO_RANGES)}`);
  if (args.flags['skip-impact-coding'] === true) return;
  const coding = await seedImpactCoding({ client, tenantId, seed, dryRun });
  logger.log(
    `impact coding: ${coding.reasonDefaultsSet} reason code defaults set, ${coding.eventsCoded} events ` +
      `re-coded, ${coding.eventsWithoutReason} stop events without a reason code left uncoded`,
  );
  coding.failedGroups.forEach((failure) => logger.warn(failure));
}

main().catch((error: unknown) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
