/**
 * Configuration seeder of the Marun HDPE training plant (owner's student guide, plans/DECISIONS.md
 * 2026-10-18): organization MPC-TRAIN, plant HDPE-TRAIN, the guide's people, master data, codes, calendar,
 * profiles and rates, stop policy, MQTT intake, source authority, finance inputs and the approved plan of
 * 17 Oct 2026. Configuration only: no production events, samples, dispositions, reconciliations or RCA
 * cases. Everything goes through the public API, authored by the responsible person and approved by an
 * independent one; only the bootstrap, the plant and the users need the SuperAdmin. Re-runnable: existing
 * records are kept. No payload may contain the word "demo" (owner rule; enforced before every request).
 *
 *   MARUN_TRAIN_PASSWORD='<shared password, ≥ 12 characters>' npm run db:seed-marun-train [-- --dry-run | --verify-only]
 *
 * Env: MARUN_TRAIN_PASSWORD (required for a real run; never printed), PROACT_API_URL (default
 * http://localhost:$PORT), MARUN_TRAIN_MQTT_URL / _USER / _PASSWORD (default: the Compose broker's password
 * listener mqtt://mqtt:1885 as seen from the backend container). The bootstrap step reads the database
 * settings from .env like scripts/bootstrap-admin.ts.
 */
import * as dotenv from 'dotenv';
import { parseCliArgs } from '../../src/migration-cutover/cli/cli-args';
import { seedCalendar } from './step-calendar';
import { seedCodes } from './step-codes';
import { ensurePlant, ensureSuperAdmin } from './step-admin';
import { seedFinance } from './step-finance';
import { seedIntegration } from './step-integration';
import { seedMasterData } from './step-master-data';
import { seedPeople } from './step-people';
import { seedPlan } from './step-plan';
import { seedPolicies } from './step-policies';
import { seedProfiles } from './step-profiles';
import { seedSourceAuthority } from './step-authority';
import * as catalog from './train-catalog';
import * as codes from './train-catalog-codes';
import * as setup from './train-catalog-setup';
import { TrainContext } from './train-context';
import { assertNoForbiddenWord } from './train-guard';
import { verifyTrain } from './verify-train';

dotenv.config();

const MIN_PASSWORD_LENGTH = 12;

/** Plant steps in dependency order; the plan is last (periods block later policy backdates). */
const STEPS: ReadonlyArray<[string, (ctx: TrainContext) => Promise<void>]> = [
  ['people', seedPeople],
  ['master-data', seedMasterData],
  ['codes', seedCodes],
  ['calendar', seedCalendar],
  ['profiles', seedProfiles],
  ['policies', seedPolicies],
  ['integration', seedIntegration],
  ['source-authority', seedSourceAuthority],
  ['finance', seedFinance],
  ['plan', seedPlan],
];

function apiUrl(): string {
  const explicit = process.env.PROACT_API_URL;
  if (explicit) return explicit.replace(/\/+$/, '').replace(/\/api$/, '');
  if (!process.env.PORT)
    throw new Error('set PROACT_API_URL or PORT (the API port) in the env');
  return `http://localhost:${process.env.PORT}`;
}

function sharedPassword(): string {
  const password = process.env.MARUN_TRAIN_PASSWORD ?? '';
  if (password.length < MIN_PASSWORD_LENGTH)
    throw new Error(
      `MARUN_TRAIN_PASSWORD is required (at least ${MIN_PASSWORD_LENGTH} characters)`,
    );
  if (/demo/i.test(password))
    throw new Error(
      'MARUN_TRAIN_PASSWORD must not contain the word "demo" (owner rule)',
    );
  return password;
}

/** The whole catalogue passes the owner's guard before anything runs. */
function checkCatalogue(): void {
  assertNoForbiddenWord('the HDPE-TRAIN catalogue', {
    catalog,
    codes,
    setup,
    broker: setup.brokerSettings(),
  });
}

async function run(ctx: TrainContext, verifyOnly: boolean): Promise<boolean> {
  if (!(await ensureSuperAdmin(ctx))) {
    ctx.logger.log(
      '[dry run] empty database: the SuperAdmin, plant and every record below would be created',
    );
    return true;
  }
  if (!(await ensurePlant(ctx))) return true;
  if (!verifyOnly) {
    for (const [name, step] of STEPS) {
      const started = Date.now();
      ctx.logger.log(`step ${name} …`);
      await step(ctx);
      ctx.logger.log(
        `step ${name} done in ${Math.round((Date.now() - started) / 1000)} s`,
      );
    }
  }
  return verifyTrain(ctx);
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  const dryRun = args.flags['dry-run'] === true;
  const verifyOnly = args.flags['verify-only'] === true;
  checkCatalogue();
  if (dryRun && !process.env.MARUN_TRAIN_PASSWORD) {
    process.stdout.write(
      'catalogue passed the "no demo" guard; set MARUN_TRAIN_PASSWORD to compare it with the running API (nothing is written)\n',
    );
    return;
  }
  const ctx = new TrainContext(
    apiUrl(),
    sharedPassword(),
    dryRun || verifyOnly,
  );
  ctx.logger.log(
    `${dryRun ? '[dry run] ' : ''}${verifyOnly ? '[verify only] ' : ''}${catalog.PLANT.code} at ${ctx.baseUrl}`,
  );
  const passed = await run(ctx, verifyOnly);
  ctx.tally.lines().forEach((entry) => ctx.logger.log(entry));
  ctx.logger.log(`${ctx.requestCount()} API requests`);
  if (!passed && !dryRun) process.exitCode = 1;
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`seed-marun-train failed: ${message}\n`);
  process.exit(1);
});
