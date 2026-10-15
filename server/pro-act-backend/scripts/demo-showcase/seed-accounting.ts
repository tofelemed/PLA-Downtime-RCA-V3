/**
 * Period accounting of the showcase: the reviewed history an accountant expects. Shifts older than two
 * days are reconciled by an engineer and approved by a manager; three days ago one Extruder2 night
 * shift was rejected with a reason; two days ago the lines are saved but not submitted; yesterday's
 * morning and afternoon shifts of the extruders wait in review; the rest of yesterday and today are
 * untouched (uncoded stops in the operator queue). Before that, one approved and one proposed actuals
 * adjustment; afterwards CSV exports of an approved week.
 */
import { setTimeout as sleep } from 'timers/promises';
import { loadPeriods, LoadedPeriod } from './period-loader';
import { Outcome, reconcilePeriod } from './reconcile-period';
import { seedAdjustments, seedExports } from './seed-adjustments';
import { ApiError } from './showcase-client';
import { inParallel, ShowcaseContext } from './showcase-context';
import { DAY_MS, iso } from './showcase-window';

const REJECT_REASON =
  'Demo: die plate stop at 02:10 is booked as availability but the work order says the cutter was changed during the stop – split the line and code the knife change (MECH-KNF).';

interface Job {
  unitKey: string;
  period: LoadedPeriod;
  outcome: Outcome;
}

interface SummaryRow {
  periodId: string;
  isExcluded: boolean;
  run: { id: string } | null;
  plan: { gap: string | null } | null;
}

/** age in operational days (1 = yesterday) */
function ageOf(ctx: ShowcaseContext, period: LoadedPeriod): number {
  return Math.round(
    (ctx.window.today -
      (period.start - ((period.start - ctx.window.from) % DAY_MS))) /
      DAY_MS,
  );
}

function outcomeOf(
  ctx: ShowcaseContext,
  unitKey: string,
  period: LoadedPeriod,
): Outcome | null {
  const age = ageOf(ctx, period);
  if (age <= 0) return null;
  if (age === 1) {
    const extruder =
      unitKey === 'EXT1' || unitKey === 'EXT2' || unitKey === 'CMP1';
    return extruder && period.shiftName !== 'Night' ? 'in_review' : null;
  }
  if (age === 2) return 'draft';
  if (
    age === 3 &&
    period.shiftName === 'Night' &&
    (unitKey === 'EXT2' || unitKey === 'PKG1')
  )
    return 'rejected';
  return 'approved';
}

/** Waits until every finished, planned period of the window has a calculation run with a plan gap. */
async function waitForRuns(ctx: ShowcaseContext): Promise<void> {
  const unitIds = [...ctx.ids.units.values()];
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const rows = await ctx
      .as('engineers', 0)
      .listAll<SummaryRow>('/v2/period-summaries', {
        unitIds,
        from: iso(ctx.window.from),
        to: iso(ctx.window.today),
      });
    const pending = rows.filter(
      (r) =>
        !r.isExcluded && r.plan !== null && (!r.run || r.plan.gap === null),
    ).length;
    if (pending === 0) return;
    ctx.logger.log(
      `accounting: waiting for ${pending}/${rows.length} period calculations`,
    );
    await sleep(10_000);
  }
  throw new Error(
    'Demo accounting: planned historical periods did not finish calculating',
  );
}

async function jobsOf(ctx: ShowcaseContext): Promise<Job[]> {
  const jobs: Job[] = [];
  for (const unit of ctx.scenario.units) {
    const unitId = ctx.ids.units.get(unit.key);
    if (!unitId) continue;
    const periods = await loadPeriods(
      ctx.as('engineers', 0),
      unitId,
      ctx.window.from,
      ctx.window.today,
    );
    for (const period of periods) {
      const outcome =
        period.target > 0 ? outcomeOf(ctx, unit.key, period) : null;
      if (outcome) jobs.push({ unitKey: unit.key, period, outcome });
    }
  }
  return jobs;
}

export async function seedAccounting(ctx: ShowcaseContext): Promise<void> {
  if (ctx.dryRun) {
    ctx.tally.add('period accounting', 0, 0, 'dry run: nothing reconciled');
    return;
  }
  await seedAdjustments(ctx);
  await waitForRuns(ctx);
  const jobs = await jobsOf(ctx);
  const speedReasonId = ctx.ids.reasons.get('PROC-SPEED') ?? '';
  const counts = new Map<string, number>();
  let done = 0;
  await inParallel(
    ctx.allSessions('engineers'),
    jobs,
    async (engineer, job) => {
      const persona = ctx.personaOf(engineer);
      let result: string;
      try {
        result = await reconcilePeriod({
          engineer,
          manager: ctx.approverOtherThan(
            persona,
            Math.floor(job.period.start / DAY_MS),
          ),
          periodId: job.period.id,
          outcome: job.outcome,
          speedReasonId,
          rejectReason: REJECT_REASON,
        });
      } catch (error: unknown) {
        result =
          error instanceof ApiError
            ? `failed:${error.code ?? error.status}`
            : 'failed';
        if (!(error instanceof ApiError)) throw error;
        ctx.logger.warn(
          `period ${job.period.id} (${job.unitKey} ${job.period.localDate} ${job.period.shiftName}): ${error.message.slice(0, 300)}`,
        );
      }
      counts.set(result, (counts.get(result) ?? 0) + 1);
      done += 1;
      if (done % 50 === 0) ctx.logger.log(`accounting: ${done}/${jobs.length}`);
    },
  );
  for (const [result, count] of counts) {
    if (result.startsWith('kept'))
      ctx.tally.add('period accounting', 0, count, `${result} ×${count}`);
    else ctx.tally.add('period accounting', count, 0, `${result} ×${count}`);
  }
  const failed = [...counts.entries()].filter(
    ([result]) => result.startsWith('failed') || result === 'not_ready',
  );
  if (failed.length)
    throw new Error(
      `Demo accounting failures: ${failed.map(([result, count]) => `${result} x${count}`).join(', ')}`,
    );
  await seedExports(ctx);
}
