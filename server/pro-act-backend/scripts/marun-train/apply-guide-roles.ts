/**
 * Guide roles only (QA audit 2026-10-19, plans/DECISIONS.md "QA audit decisions"): gives each HDPE-TRAIN
 * person exactly the plant-wide roles of the guide (`PEOPLE` in train-catalog.ts) on an existing plant —
 * grants a missing guide role, then revokes every other plant-wide grant, which on the live plant is the
 * legacy-role mirror (production engineer for Kamran, Neda, Arman, Darya, Bahram, Sara, Mina and Farid).
 * Only `user_scopes` change, through the public API as the SuperAdmin (audited); no user, plant or other
 * record is created. Idempotent: a second run changes nothing. Requires the backend that carries the
 * `LegacyRoleMirrorBackfill` release (a mirror is revocable once another plant-wide role is held).
 *
 *   MARUN_TRAIN_PASSWORD='<shared password>' npx ts-node scripts/marun-train/apply-guide-roles.ts [-- --dry-run]
 *
 * Env: MARUN_TRAIN_PASSWORD (required), PROACT_API_URL (default http://localhost:$PORT).
 */
import * as dotenv from 'dotenv';
import { parseCliArgs } from '../../src/common/cli/cli-args';
import { ensureRoles, findUser, removeExtraRoles } from './step-people';
import { emailOf, PEOPLE, PLANT } from './train-catalog';
import { TrainContext } from './train-context';

dotenv.config();

interface PlantRow {
  id: string;
  code: string;
}

function apiUrl(): string {
  const explicit = process.env.PROACT_API_URL;
  if (explicit) return explicit.replace(/\/+$/, '').replace(/\/api$/, '');
  if (!process.env.PORT)
    throw new Error('set PROACT_API_URL or PORT (the API port) in the env');
  return `http://localhost:${process.env.PORT}`;
}

/** The plant must exist already: this script never creates one. */
async function openPlant(ctx: TrainContext): Promise<void> {
  const home = ctx.homeAdmin();
  await home.login();
  const page = await home.get<{ items: PlantRow[] }>('/v2/tenants?limit=200');
  const plant = page.items.find((row) => row.code === PLANT.code);
  if (!plant) throw new Error(`plant ${PLANT.code} not found; nothing changed`);
  await ctx.openAdmin(plant.id);
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
  for (const spec of PEOPLE) {
    const user = await findUser(ctx, emailOf(spec.key));
    if (!user) {
      ctx.tally.add('people missing', 0, 0, spec.key);
      continue;
    }
    await ensureRoles(ctx, spec, user.id);
    await removeExtraRoles(ctx, spec, user.id);
  }
  ctx.tally.lines().forEach((entry) => ctx.logger.log(entry));
  ctx.logger.log(
    `${ctx.dryRun ? '[dry run] ' : ''}guide roles applied in ${PLANT.code}`,
  );
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`apply-guide-roles failed: ${message}\n`);
  process.exit(1);
});
