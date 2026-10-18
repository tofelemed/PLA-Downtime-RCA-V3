/**
 * Guide lesson 7 / E2E §8: "Extruder1 HD5502 — 17 Oct 2026", 17 Oct 06:00 → 18 Oct 06:00 plant time,
 * quantity basis, header target 672 t distributed in proportion to scheduled planning capacity, one slice
 * HD5502. Leila drafts it, checks the preview (3 shifts × 224 t), generates the periods and submits it;
 * Reza approves it. Runs last: once periods exist and are calculated, policies can no longer be backdated.
 */
import { setTimeout as sleep } from 'timers/promises';
import { PLAN, TIMES } from './train-catalog';
import { known, TrainContext } from './train-context';

interface PlanVersion {
  version: number;
  approvalState: string;
  periodsGeneratedAt: string | null;
}

interface PlanRow {
  id: string;
  name: string;
  version: PlanVersion;
}

interface PeriodRow {
  localDate: string;
  shiftName: string;
  target: string;
}

interface Preview {
  periods: PeriodRow[];
}

const JOB_WAIT_SECONDS = 120;

/** Throws unless the periods are the guide's three shifts of 224 t. */
export function assertGuidePeriods(
  periods: readonly PeriodRow[],
  what: string,
): void {
  const targets = periods.map((p) => Number(p.target));
  const ok =
    periods.length === PLAN.shifts &&
    targets.every((t) => t === PLAN.shiftTarget);
  if (!ok)
    throw new Error(
      `${what}: expected ${PLAN.shifts} shifts of ${PLAN.shiftTarget} t, got ${periods
        .map((p) => `${p.localDate} ${p.shiftName} ${p.target}`)
        .join('; ')}`,
    );
}

async function createPlan(ctx: TrainContext): Promise<PlanRow> {
  const productId = ctx.ids.products.get(PLAN.productCode);
  const profileId = ctx.ids.profiles.get(PLAN.productCode);
  if (!productId || !profileId)
    throw new Error(`plan needs the approved ${PLAN.productCode} profile`);
  return ctx.as('leila').post<PlanRow>(
    '/v2/production-plans',
    {
      name: PLAN.name,
      unitId: ctx.ids.unitId,
      validFrom: TIMES.dayStart,
      validTo: TIMES.dayEnd,
      basis: 'quantity',
      headerTarget: PLAN.headerTarget,
      distribution: 'scheduled_capacity',
      slices: [{ productId, profileId, stream: 'sequential' }],
      changeReason: PLAN.changeReason,
    },
    `plan ${PLAN.name}`,
  );
}

async function generatePeriods(
  ctx: TrainContext,
  planId: string,
  version: number,
): Promise<void> {
  const leila = ctx.as('leila');
  const accepted = await leila.post<{ jobId: string }>(
    `/v2/production-plans/${planId}/generate-periods`,
    { version },
    `generate ${planId} v${version}`,
  );
  for (let second = 0; second < JOB_WAIT_SECONDS; second += 1) {
    const job = await leila.get<{ state: string; errorCode: string | null }>(
      `/v2/plan-generation-jobs/${accepted.jobId}`,
    );
    if (job.state === 'completed') return;
    if (job.state === 'failed')
      throw new Error(`plan generation failed: ${job.errorCode ?? 'unknown'}`);
    await sleep(1000);
  }
  throw new Error(
    `plan generation did not finish within ${JOB_WAIT_SECONDS} s`,
  );
}

async function advance(ctx: TrainContext, plan: PlanRow): Promise<void> {
  const leila = ctx.as('leila');
  const { version } = plan.version;
  const preview = await leila.post<Preview>(
    `/v2/production-plans/${plan.id}/generate-periods`,
    { version, preview: true },
    `preview ${plan.id} v${version}`,
  );
  assertGuidePeriods(preview.periods, 'plan preview');
  if (!plan.version.periodsGeneratedAt)
    await generatePeriods(ctx, plan.id, version);
  if (plan.version.approvalState === 'draft')
    await leila.post(
      `/v2/production-plans/${plan.id}/submit`,
      { expectedVersion: version },
      `submit ${plan.id} v${version}`,
    );
  await ctx
    .as('reza')
    .post(
      `/v2/production-plans/${plan.id}/approve`,
      { expectedVersion: version, reason: PLAN.approvalReason },
      `approve plan ${plan.id} v${version}`,
    );
}

export async function seedPlan(ctx: TrainContext): Promise<void> {
  if (!known(ctx, ctx.ids.unitId, 'unit Extruder1')) return;
  const plans = await ctx
    .as('leila')
    .listAll<PlanRow>('/v2/production-plans', { unitId: ctx.ids.unitId });
  const found = plans.find((p) => p.name === PLAN.name);
  if (found?.version.approvalState === 'approved') {
    ctx.tally.kept('production plan');
    return;
  }
  ctx.tally.created('production plan');
  if (ctx.dryRun) return;
  await advance(ctx, found ?? (await createPlan(ctx)));
}
