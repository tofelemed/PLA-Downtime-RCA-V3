/**
 * SuperAdmin-only set-up: the first SuperAdmin through the existing bootstrap path
 * (scripts/bootstrap-admin.ts, which also creates organization MPC-TRAIN and plant HDPE-TRAIN on an empty
 * database), the plant's time zone and display settings, and the people of guide lesson 22 with their
 * plant-wide scope roles.
 */
import { spawnSync } from 'child_process';
import { join } from 'path';
import { ApiError } from '../demo-showcase/showcase-client';
import { ORGANIZATION, PLANT, SUPER_ADMIN } from './train-catalog';
import { TrainContext } from './train-context';
import { assertNoForbiddenWord } from './train-guard';
import { TrainSession } from './train-session';

interface PlantRow {
  id: string;
  code: string;
  organizationId: string;
  timezone: string | null;
  calendarSystem: string;
  digits: string;
  weekStart: string;
}

interface OrganizationRow {
  id: string;
  code: string;
}

interface Page<T> {
  items: T[];
}

const BACKEND_ROOT = join(__dirname, '..', '..');

/** Runs scripts/bootstrap-admin.ts (refuses when users already exist); the password is never printed. */
function runBootstrap(password: string): void {
  const args = [
    '--email',
    SUPER_ADMIN.email,
    '--name',
    SUPER_ADMIN.name,
    '--org-code',
    ORGANIZATION.code,
    '--org-name',
    ORGANIZATION.name,
    '--tenant-code',
    PLANT.code,
    '--tenant-name',
    PLANT.name,
  ];
  assertNoForbiddenWord('bootstrap-admin arguments', args);
  const result = spawnSync(
    process.execPath,
    [
      '-r',
      'ts-node/register',
      join(BACKEND_ROOT, 'scripts', 'bootstrap-admin.ts'),
      ...args,
      '--password',
      password,
    ],
    {
      cwd: BACKEND_ROOT,
      stdio: ['ignore', 'inherit', 'inherit'],
      env: { ...process.env, TS_NODE_TRANSPILE_ONLY: 'true' },
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `bootstrap-admin failed (exit ${result.status ?? 'signal'}). If users already exist, create ${SUPER_ADMIN.email} with ` +
        'npm run db:bootstrap-admin -- --force (same organization / plant codes) and run this seeder again.',
    );
  }
}

async function canLogIn(session: TrainSession): Promise<boolean> {
  try {
    await session.login();
    return true;
  } catch (error: unknown) {
    if (error instanceof ApiError && error.status === 401) return false;
    throw error;
  }
}

/** Returns false in a dry run on an empty database (nothing can be read yet). */
export async function ensureSuperAdmin(ctx: TrainContext): Promise<boolean> {
  if (await canLogIn(ctx.homeAdmin())) {
    ctx.tally.kept('super admin');
    return true;
  }
  ctx.tally.add(
    'super admin',
    1,
    0,
    `${SUPER_ADMIN.email} via bootstrap-admin`,
  );
  if (ctx.dryRun) return false;
  runBootstrap(ctx.password);
  if (!(await canLogIn(ctx.homeAdmin())))
    throw new Error(`${SUPER_ADMIN.email} cannot log in after the bootstrap`);
  return true;
}

async function ensureOrganization(
  home: TrainSession,
  ctx: TrainContext,
): Promise<string> {
  const page = await home.get<Page<OrganizationRow>>(
    '/v2/organizations?limit=200',
  );
  const found = page.items.find((o) => o.code === ORGANIZATION.code);
  if (found) {
    ctx.tally.kept('organization');
    return found.id;
  }
  ctx.tally.created('organization');
  if (ctx.dryRun) return '';
  const created = await home.post<OrganizationRow>(
    '/v2/organizations',
    ORGANIZATION,
    `organization ${ORGANIZATION.code}`,
  );
  return created.id;
}

async function findOrCreatePlant(
  home: TrainSession,
  ctx: TrainContext,
): Promise<PlantRow | null> {
  const page = await home.get<Page<PlantRow>>('/v2/tenants?limit=200');
  const found = page.items.find((p) => p.code === PLANT.code);
  if (found) {
    ctx.tally.kept('plant');
    return found;
  }
  const organizationId = await ensureOrganization(home, ctx);
  ctx.tally.created('plant');
  if (ctx.dryRun) return null;
  const {
    code,
    name,
    description,
    timezone,
    calendarSystem,
    digits,
    weekStart,
  } = PLANT;
  return home.post<PlantRow>(
    '/v2/tenants',
    {
      code,
      name,
      description,
      timezone,
      calendarSystem,
      digits,
      weekStart,
      organizationId,
    },
    `plant ${PLANT.code}`,
  );
}

/** Time zone (set at plant creation in the UI; the bootstrap row has none) and the display settings. */
async function alignPlantSettings(
  ctx: TrainContext,
  plant: PlantRow,
): Promise<void> {
  const admin = ctx.admin();
  if (plant.timezone !== PLANT.timezone) {
    ctx.tally.add('plant settings', 1, 0, `time zone ${PLANT.timezone}`);
    if (!ctx.dryRun)
      await admin.call('PUT', `/tenants/${plant.id}`, {
        timezone: PLANT.timezone,
        description: PLANT.description,
      });
  }
  const display = {
    calendarSystem: PLANT.calendarSystem,
    digits: PLANT.digits,
    weekStart: PLANT.weekStart,
  };
  const same =
    plant.calendarSystem === display.calendarSystem &&
    plant.digits === display.digits &&
    plant.weekStart === display.weekStart;
  if (same) {
    ctx.tally.kept('plant settings');
    return;
  }
  ctx.tally.add(
    'plant settings',
    1,
    0,
    'Gregorian, Latin digits, week starts Saturday',
  );
  if (!ctx.dryRun)
    await admin.call(
      'PATCH',
      `/v2/tenants/${plant.id}/display-settings`,
      display,
    );
}

export async function ensurePlant(ctx: TrainContext): Promise<boolean> {
  const home = ctx.homeAdmin();
  await home.login();
  const plant = await findOrCreatePlant(home, ctx);
  if (!plant) return false;
  ctx.ids.organizationId = plant.organizationId;
  await ctx.openAdmin(plant.id);
  await alignPlantSettings(ctx, plant);
  return true;
}
