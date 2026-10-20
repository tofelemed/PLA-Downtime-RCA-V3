/**
 * Showcase demo data seeder (demo data only, isolated from product code): fills one plant with a month of
 * realistic, deterministic production history through the public API, as the persona users of
 * docs/DEMO_PERSONAS.md (authors and approvers are always different people).
 *
 *   npm run db:seed-demo-showcase -- --demo-plant [--days 30] [--seed <text>] [--dry-run]
 *   npm run db:seed-demo-showcase -- --tenant <uuid>   # Demo Plant 2 (small scenario) or Partner Plant
 *       [--only <step,step>] [--skip <step,step>]
 *
 * Steps: master-data, codes, rules, calendars, profiles, rca-policy, plans, events, rca-events, cleanup, accounting, rca, tasks,
 * integration, verify. Idempotent: rows that exist are kept and reported as such; a re-run on a later day
 * extends the window (new days, plan versions, periods). Env: PROACT_API_URL (default
 * http://localhost:$PORT). See docs/DEMO_SHOWCASE_DATA.md.
 */
import { Logger } from '@nestjs/common';
import * as dotenv from 'dotenv';
import {
  parseCliArgs,
  stringFlag,
  tenantFlag,
} from '../../src/common/cli/cli-args';
import {
  emailOf,
  PERSONA_PASSWORD,
  RESOLVER_PERSONA,
  SCENARIOS,
} from './catalog-plants';
import { runSteps } from './showcase-steps';
import { PersonaSession } from './showcase-client';
import { ShowcaseContext } from './showcase-context';
import { DEFAULT_SEED } from './showcase-random';
import { windowOf } from './showcase-window';

dotenv.config();

const logger = new Logger('DemoShowcase');

function apiUrl(): string {
  const explicit = process.env.PROACT_API_URL;
  if (explicit) return explicit.replace(/\/+$/, '').replace(/\/api$/, '');
  if (!process.env.PORT)
    throw new Error('set PROACT_API_URL or PORT (the API port) in the env');
  return `http://localhost:${process.env.PORT}`;
}

interface TenantRow {
  id: string;
  code: string;
  name: string;
  organizationId: string;
}

/** Resolves the plant (id and code) with a SuperAdmin persona, which writes nothing. */
async function resolvePlant(
  baseUrl: string,
  tenant: string | null,
  demoPlant: boolean,
): Promise<TenantRow> {
  if (tenant && demoPlant)
    throw new Error('give either --tenant <uuid> or --demo-plant, not both');
  if (!tenant && !demoPlant)
    throw new Error(
      'refusing to run without a plant: pass --tenant <uuid> or --demo-plant',
    );
  const resolver = new PersonaSession(
    emailOf(RESOLVER_PERSONA),
    PERSONA_PASSWORD,
    baseUrl,
    '',
    '',
  );
  await resolver.login();
  const tenants = await resolver.get<TenantRow[]>('/tenants');
  const found = tenants.find((t) =>
    tenant ? t.id === tenant : t.code === 'demo-plant',
  );
  if (!found) throw new Error(`plant ${tenant ?? 'demo-plant'} not found`);
  return found;
}

function stepList(value: string | null): Set<string> | null {
  return value ? new Set(value.split(',').map((s) => s.trim())) : null;
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  const baseUrl = apiUrl();
  const plant = await resolvePlant(
    baseUrl,
    tenantFlag(args),
    args.flags['demo-plant'] === true,
  );
  const scenario = SCENARIOS.find((s) => s.plantCode === plant.code);
  if (!scenario)
    throw new Error(
      `no showcase scenario for plant "${plant.code}" (known: ${SCENARIOS.map((s) => s.plantCode).join(', ')})`,
    );
  const days = Number(
    stringFlag(args, 'days') ?? (scenario.kind === 'full' ? 30 : 14),
  );
  if (!Number.isInteger(days) || days < 1 || days > 120)
    throw new Error('--days must be an integer from 1 to 120');
  const seed = stringFlag(args, 'seed') ?? DEFAULT_SEED;
  const dryRun = args.flags['dry-run'] === true;
  const ctx = new ShowcaseContext(
    baseUrl,
    plant.id,
    scenario,
    windowOf(Date.now(), days),
    seed,
    dryRun,
  );
  ctx.organizationId = plant.organizationId;
  logger.log(
    `${dryRun ? '[dry run] ' : ''}${plant.name} (${plant.id}), scenario ${scenario.kind}, ${days} days, seed "${seed}"`,
  );
  await ctx.loginCast();
  const started = Date.now();
  await runSteps(
    ctx,
    stepList(stringFlag(args, 'only')),
    stepList(stringFlag(args, 'skip')),
  );
  ctx.tally.lines().forEach((line) => logger.log(line));
  logger.log(
    `${ctx.requestCount()} API requests in ${Math.round((Date.now() - started) / 1000)} s`,
  );
}

main().catch((error: unknown) => {
  logger.error(
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
  process.exit(1);
});
