/**
 * QA re-test N3 (plans/DECISIONS.md "QA round 3: master data"): rewrites the course wording ("training",
 * "guide lesson 21", "student guide") out of HDPE-TRAIN's live finance texts — the FX rate source, the
 * demand status evidence and the valuation policy notes / backdate reason — through the public API as the
 * finance maintainer Darya (`PATCH …/source`, `…/evidence`, `…/text`: text only, figures and approvals
 * unchanged, nothing revalued, audited). Idempotent: a record whose text is already plain is left alone, so
 * a second run changes nothing. Requires the backend release that carries those PATCH routes.
 *
 *   MARUN_TRAIN_PASSWORD='<shared password>' npx ts-node scripts/marun-train/rewrite-finance-texts.ts [-- --dry-run]
 *
 * Env: MARUN_TRAIN_PASSWORD (required), PROACT_API_URL (default http://localhost:$PORT).
 */
import * as dotenv from 'dotenv';
import { parseCliArgs } from '../../src/common/cli/cli-args';
import {
  DemandRow,
  demandCorrections,
  fxCorrections,
  FxRow,
  policyCorrections,
  PolicyRow,
  TextCorrection,
} from './finance-text-plan';
import { emailOf, PLANT } from './train-catalog';
import { TrainContext } from './train-context';
import { TrainSession } from './train-session';

dotenv.config();

function apiUrl(): string {
  const explicit = process.env.PROACT_API_URL;
  if (explicit) return explicit.replace(/\/+$/, '').replace(/\/api$/, '');
  if (!process.env.PORT)
    throw new Error('set PROACT_API_URL or PORT (the API port) in the env');
  return `http://localhost:${process.env.PORT}`;
}

async function openPlant(ctx: TrainContext): Promise<void> {
  const home = ctx.homeAdmin();
  await home.login();
  const page = await home.get<{ items: Array<{ id: string; code: string }> }>(
    '/v2/tenants?limit=200',
  );
  const plant = page.items.find((row) => row.code === PLANT.code);
  if (!plant) throw new Error(`plant ${PLANT.code} not found; nothing changed`);
  await ctx.openAdmin(plant.id);
}

async function plannedCorrections(
  reader: TrainSession,
): Promise<TextCorrection[]> {
  const [rates, statuses, policies] = await Promise.all([
    reader.listAll<FxRow>('/v2/fx-rates'),
    reader.listAll<DemandRow>('/v2/demand-statuses'),
    reader.listAll<PolicyRow>('/v2/valuation-policies'),
  ]);
  return [
    ...fxCorrections(rates),
    ...demandCorrections(statuses),
    ...policyCorrections(policies),
  ];
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  const password = process.env.MARUN_TRAIN_PASSWORD ?? '';
  if (!password) throw new Error('MARUN_TRAIN_PASSWORD is required');
  const ctx = new TrainContext(
    apiUrl(),
    password,
    args.flags['dry-run'] === true,
  );
  await openPlant(ctx);
  const corrections = await plannedCorrections(ctx.admin());
  if (corrections.length === 0) ctx.tally.kept('finance texts');
  let darya: TrainSession | null = null;
  for (const correction of corrections) {
    ctx.tally.add('finance texts', 1, 0, correction.label);
    if (ctx.dryRun) continue;
    if (!darya) {
      darya = new TrainSession(
        emailOf('darya'),
        password,
        ctx.baseUrl,
        ctx.tenantId,
      );
      await darya.login();
    }
    await darya.call('PATCH', correction.path, correction.body);
  }
  ctx.tally.lines().forEach((entry) => ctx.logger.log(entry));
  ctx.logger.log(
    `${ctx.dryRun ? '[dry run] ' : ''}finance texts checked in ${PLANT.code}`,
  );
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`rewrite-finance-texts failed: ${message}\n`);
  process.exit(1);
});
