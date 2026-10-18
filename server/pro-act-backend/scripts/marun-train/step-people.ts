/**
 * The people of guide lesson 22 (fictional teaching personas) plus the master-data administrator Bahram
 * and the independent coding verifier Shirin, created by the SuperAdmin with the shared password from
 * MARUN_TRAIN_PASSWORD and given their plant-wide scope roles in HDPE-TRAIN. Existing users are kept.
 */
import { ApiError } from '../demo-showcase/showcase-client';
import { emailOf, PEOPLE, PersonSpec } from './train-catalog';
import { TrainContext } from './train-context';

interface UserRow {
  id: string;
  email: string;
}

interface ScopeRow {
  role: string;
  scopeKind: string;
  scopeId: string;
}

async function findUser(
  ctx: TrainContext,
  email: string,
): Promise<UserRow | null> {
  const query = new URLSearchParams({ email });
  const result = await ctx
    .admin()
    .call<UserRow>('GET', `/v2/users/lookup?${query}`, undefined, {
      accept: [404],
    });
  return result.status === 404 ? null : result.body;
}

async function ensureUser(
  ctx: TrainContext,
  spec: PersonSpec,
): Promise<string | null> {
  const email = emailOf(spec.key);
  const found = await findUser(ctx, email);
  if (found) {
    ctx.tally.kept('users');
    return found.id;
  }
  ctx.tally.created('users');
  if (ctx.dryRun) return null;
  const created = await ctx.admin().post<UserRow>(
    '/v2/users',
    {
      name: spec.name,
      email,
      password: ctx.password,
      role: spec.legacyRole,
      tenantId: ctx.tenantId,
    },
    `user ${email}`,
  );
  return created.id;
}

async function grantRole(
  ctx: TrainContext,
  userId: string,
  role: string,
): Promise<void> {
  try {
    await ctx
      .admin()
      .post('/v2/user-scopes', { userId, role }, `scope ${userId} ${role}`);
    ctx.tally.created('scope roles');
  } catch (error: unknown) {
    if (!(error instanceof ApiError && error.code === 'SCOPE_EXISTS'))
      throw error;
    ctx.tally.kept('scope roles');
  }
}

async function ensureRoles(
  ctx: TrainContext,
  spec: PersonSpec,
  userId: string | null,
): Promise<void> {
  if (!userId) {
    ctx.tally.add('scope roles', spec.roles.length, 0);
    return;
  }
  const held = await ctx
    .admin()
    .listAll<ScopeRow>('/v2/user-scopes', { userId });
  for (const role of spec.roles) {
    const plantWide = held.some(
      (s) =>
        s.role === role &&
        s.scopeKind === 'tenant' &&
        s.scopeId === ctx.tenantId,
    );
    if (plantWide) {
      ctx.tally.kept('scope roles');
      continue;
    }
    if (ctx.dryRun) {
      ctx.tally.created('scope roles');
      continue;
    }
    await grantRole(ctx, userId, role);
  }
}

export async function seedPeople(ctx: TrainContext): Promise<void> {
  for (const spec of PEOPLE) {
    const userId = await ensureUser(ctx, spec);
    if (userId) ctx.ids.users.set(spec.key, userId);
    await ensureRoles(ctx, spec, userId);
  }
  await ctx.loginPeople();
}
