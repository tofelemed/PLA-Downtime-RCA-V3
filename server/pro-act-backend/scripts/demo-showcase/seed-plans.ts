/**
 * Monthly production plans per showcase unit over the window (past days, today and the next 7 days):
 * quantity plans whose header target is 97 % of the planning capacity of the month's product campaigns,
 * written by an engineer, periods generated, approved by a manager. The current month also gets a second
 * version (an added customer order), approved by another manager. Month plans meet at 06:00 on the 1st
 * (start of the operational day), so no shift is split between two plans. A re-run on a later day whose window
 * reaches past a plan's end adds a version with the longer validity. Then the production periods of the
 * window are materialized.
 */
import { setTimeout as sleep } from 'timers/promises';
import { campaignsIn, scheduledHours } from './campaigns';
import { UnitSpec } from './catalog-plants';
import { PersonaSession } from './showcase-client';
import { ShowcaseContext } from './showcase-context';
import {
  DAY_MS,
  DAY_START_HOUR,
  HOUR_MS,
  iso,
  monthLabel,
  monthStart,
  nextMonthStart,
} from './showcase-window';

const TARGET_SHARE = 0.97;

interface VersionView {
  version: number;
  validFrom: string;
  validTo: string;
  approvalState: string;
  headerTarget: string | null;
}

interface PlanView {
  id: string;
  name: string;
  currentVersion: number;
  version: VersionView;
}

interface PlanBody {
  unitId: string;
  validFrom: string;
  validTo: string;
  basis: 'quantity';
  headerTarget: string;
  distribution: 'scheduled_capacity';
  slices: Array<Record<string, string>>;
}

function planName(unit: UnitSpec, month: number): string {
  const label = new Date(month).toLocaleString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `${unit.name} – ${label}`;
}

function planBody(
  ctx: ShowcaseContext,
  unit: UnitSpec,
  from: number,
  to: number,
  uplift = 1,
): PlanBody | null {
  const unitId = ctx.ids.units.get(unit.key);
  if (!unitId) return null;
  let target = 0;
  const slices: Array<Record<string, string>> = [];
  for (const campaign of campaignsIn(unit, from, to)) {
    const profile = ctx.ids.profiles.get(`${unit.key}:${campaign.productCode}`);
    const productId = ctx.ids.products.get(campaign.productCode);
    if (!profile || !productId) return null;
    target +=
      profile.planningRate *
      scheduledHours(campaign.from, campaign.to) *
      TARGET_SHARE;
    slices.push({
      productId,
      profileId: profile.id,
      campaignFrom: iso(campaign.from),
      campaignTo: iso(campaign.to),
      stream: 'sequential',
    });
  }
  return {
    unitId,
    validFrom: iso(from),
    validTo: iso(to),
    basis: 'quantity',
    headerTarget: String(Math.round(target * uplift)),
    distribution: 'scheduled_capacity',
    slices,
  };
}

async function generateAndApprove(
  ctx: ShowcaseContext,
  author: PersonaSession,
  planId: string,
  version: number,
): Promise<void> {
  const job = await author.post<{ id?: string; jobId?: string }>(
    `/v2/production-plans/${planId}/generate-periods`,
    { version },
    `generate ${planId} v${version}`,
  );
  const jobId = job.jobId ?? job.id;
  for (let i = 0; jobId && i < 120; i += 1) {
    const state = await author.get<{ state: string; error?: unknown }>(
      `/v2/plan-generation-jobs/${jobId}`,
    );
    if (state.state === 'completed') break;
    if (state.state === 'failed')
      throw new Error(
        `plan ${planId} v${version} generation failed: ${JSON.stringify(state)}`,
      );
    await sleep(1000);
  }
  const approver = ctx.approverOtherThan(ctx.personaOf(author), version);
  await approver.post(
    `/v2/production-plans/${planId}/approve`,
    {
      expectedVersion: version,
      reason:
        version === 1
          ? 'Monthly plan agreed in the S&OP meeting'
          : 'Revision reviewed',
    },
    `approve plan ${planId} v${version}`,
  );
}

async function newVersion(
  ctx: ShowcaseContext,
  plan: Pick<PlanView, 'id'>,
  body: PlanBody,
  changeReason: string,
): Promise<void> {
  const author = ctx.as('engineers');
  const created = await author.post<VersionView>(
    `/v2/production-plans/${plan.id}/versions`,
    { ...body, changeReason },
    `plan version ${plan.id} ${body.validTo} ${body.headerTarget}`,
  );
  await generateAndApprove(ctx, author, plan.id, created.version);
}

/** A month plan runs from the 1st 06:00 (start of the operational day) to the next 1st 06:00. */
function monthWindow(
  ctx: ShowcaseContext,
  month: number,
): { from: number; to: number } {
  const boundary = month + DAY_START_HOUR * HOUR_MS;
  return {
    from: Math.max(ctx.window.from, boundary),
    to: Math.min(
      ctx.window.to,
      nextMonthStart(month) + DAY_START_HOUR * HOUR_MS,
    ),
  };
}

/**
 * Extends an existing month plan whose end lies before the window's (a re-run on a later day), never into
 * the next month's plan; its start is kept. Returns the plan's start.
 */
async function extendMonthPlan(
  ctx: ShowcaseContext,
  unit: UnitSpec,
  month: number,
  existing: PlanView,
  nextStart: number,
): Promise<number> {
  const start = Date.parse(existing.version.validFrom);
  const end = Date.parse(existing.version.validTo);
  const wantedTo = Math.min(monthWindow(ctx, month).to, nextStart);
  if (end >= wantedTo && existing.version.approvalState === 'approved') {
    ctx.tally.kept('production plans');
    return start;
  }
  ctx.tally.add(
    'production plans',
    0,
    1,
    `${existing.name}: new version to ${iso(wantedTo)}`,
  );
  if (ctx.dryRun) return start;
  const uplift = monthLabel(month) === monthLabel(ctx.window.today) ? 1.015 : 1;
  const body = planBody(ctx, unit, start, Math.max(end, wantedTo), uplift);
  if (body)
    await newVersion(
      ctx,
      existing,
      body,
      'Plan horizon extended to the rolling 7-day window',
    );
  return start;
}

/** Ensures the month's plan; returns its start (the previous month's plan must end there). */
async function ensureMonthPlan(
  ctx: ShowcaseContext,
  unit: UnitSpec,
  month: number,
  plans: PlanView[],
  nextStart: number,
): Promise<number> {
  const name = planName(unit, month);
  const existing = plans.find((p) => p.name === name);
  if (existing) return extendMonthPlan(ctx, unit, month, existing, nextStart);
  const { from } = monthWindow(ctx, month);
  const to = Math.min(monthWindow(ctx, month).to, nextStart);
  const body = planBody(ctx, unit, from, to);
  if (!body || from >= to) return nextStart;
  ctx.tally.created('production plans');
  if (ctx.dryRun) return from;
  const author = ctx.as('engineers');
  const plan = await author.post<PlanView>(
    '/v2/production-plans',
    { ...body, name },
    `plan ${name}`,
  );
  await generateAndApprove(ctx, author, plan.id, 1);
  if (monthLabel(month) !== monthLabel(ctx.window.today)) return from;
  const revised = planBody(ctx, unit, from, to, 1.015);
  if (revised) {
    await newVersion(
      ctx,
      plan,
      revised,
      'Additional customer order for the current campaign',
    );
    ctx.tally.add('plan versions', 1, 0);
  }
  return from;
}

export async function seedPlans(ctx: ShowcaseContext): Promise<void> {
  for (const unit of ctx.scenario.units) {
    const unitId = ctx.ids.units.get(unit.key);
    if (!unitId) continue;
    const plans = await ctx
      .as('engineers', 0)
      .listAll<PlanView>('/v2/production-plans', { unitId });
    const months: number[] = [];
    for (
      let month = monthStart(ctx.window.from - DAY_MS);
      month < ctx.window.to;
      month = nextMonthStart(month)
    ) {
      months.push(month);
    }
    // later months first, so each plan ends where the next month's plan starts
    let nextStart = ctx.window.to;
    for (const month of months.reverse()) {
      nextStart = await ensureMonthPlan(ctx, unit, month, plans, nextStart);
    }
  }
  if (ctx.dryRun || ctx.ids.units.size === 0) return;
  const window = {
    unitIds: [...ctx.ids.units.values()],
    from: iso(ctx.window.from),
    to: iso(ctx.window.to),
  };
  // the run time is part of the command name: a repeated body must not get the cached answer of an earlier run
  const materialized = await ctx.as('managers', 0).post<{
    created?: number;
    skipped?: number;
  }>('/v2/production-periods/materialize', window, `materialize ${window.from} ${window.to} ${ctx.window.now}`);
  ctx.tally.add(
    'production periods',
    materialized.created ?? 0,
    materialized.skipped ?? 0,
    'materialized',
  );
}
