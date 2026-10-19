/**
 * The people of guide lesson 22 (fictional teaching personas) plus the master-data administrator Bahram
 * and the independent coding verifier Shirin, created by the SuperAdmin with the shared password from
 * MARUN_TRAIN_PASSWORD and given their plant-wide scope roles in HDPE-TRAIN. Existing users are kept.
 * Guide roles only (QA audit 2026-10-19): each person ends with exactly the guide's plant-wide roles; the
 * home-role mirror of the legacy role (Analyst / Engineer → production engineer) is revoked once the guide
 * role is held, so the D06 fallback no longer applies.
 */
import { ApiError } from '../demo-showcase/showcase-client';
import { emailOf, PEOPLE, PersonSpec } from './train-catalog';
import { TrainContext } from './train-context';

interface UserRow {
  id: string;
  email: string;
}

interface ScopeRow {
  id: string;
  role: string;
  scopeKind: string;
  scopeId: string;
}

export async function findUser(
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

export async function ensureRoles(
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

/** Plant-wide grants in HDPE-TRAIN that the guide does not give the person (e.g. the legacy-role mirror). */
export function extraPlantRoles(
  spec: PersonSpec,
  held: readonly ScopeRow[],
  tenantId: string,
): ScopeRow[] {
  return held.filter(
    (s) =>
      s.scopeKind === 'tenant' &&
      s.scopeId === tenantId &&
      !spec.roles.includes(s.role as PersonSpec['roles'][number]),
  );
}

/** Revokes every plant-wide grant the guide does not give (run after `ensureRoles`). Idempotent. */
export async function removeExtraRoles(
  ctx: TrainContext,
  spec: PersonSpec,
  userId: string | null,
): Promise<void> {
  if (!userId) return;
  const held = await ctx
    .admin()
    .listAll<ScopeRow>('/v2/user-scopes', { userId });
  for (const extra of extraPlantRoles(spec, held, ctx.tenantId)) {
    ctx.tally.add('scope roles removed', 1, 0, `${spec.key} ${extra.role}`);
    if (ctx.dryRun) continue;
    // a retried revoke whose first answer was lost finds the grant gone (404): already done
    await ctx.admin().call('DELETE', `/v2/user-scopes/${extra.id}`, undefined, {
      accept: [404],
    });
  }
}

export async function seedPeople(ctx: TrainContext): Promise<void> {
  for (const spec of PEOPLE) {
    const userId = await ensureUser(ctx, spec);
    if (userId) ctx.ids.users.set(spec.key, userId);
    await ensureRoles(ctx, spec, userId);
    await removeExtraRoles(ctx, spec, userId);
  }
  await ctx.loginPeople();
}
