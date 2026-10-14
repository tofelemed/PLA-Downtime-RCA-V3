/**
 * DEMO DATA ONLY (SME V5 / V7): weekly USD → IRR rates of two rate tables over the showcase window,
 * every source text starting with "Demo:". The magnitudes are illustrative, not quotations:
 * `economic` follows an exchange-market-like level drifting from about 1,030,000 IRR/USD,
 * `group_reporting` an official-fixing-like level near 285,000 IRR/USD. The newest past week's economic
 * rate is held back and approved last (`approveLateRate`), so the showcase shows a late-approved rate
 * revaluing periods that were already calculated (change proposals on approved ones).
 */
import { MASTER_DATA_FROM } from './catalog-plants';
import { PersonaSession } from './showcase-client';
import { ShowcaseContext } from './showcase-context';
import { dec, SeededRandom } from './showcase-random';
import { DAY_MS } from './showcase-window';

const WEEK_MS = 7 * DAY_MS;
const FROM_MS = Date.parse(`${MASTER_DATA_FROM}T00:00:00.000Z`);

interface FxRow {
  id: string;
  rateType: string;
  state: string;
  effectiveFrom: string;
  source: string | null;
}

interface Week {
  from: number;
  to: number;
  index: number;
}

/** Illustrative levels (IRR per USD) by table, with a small deterministic weekly move. */
const LEVEL: Record<
  'economic' | 'group_reporting',
  { base: number; drift: number; jitter: number; source: string }
> = {
  economic: {
    base: 1_030_000,
    drift: 0.004,
    jitter: 0.006,
    source: 'Demo: exchange-market-like rate (illustrative, not a quotation)',
  },
  group_reporting: {
    base: 285_000,
    drift: 0,
    jitter: 0.001,
    source: 'Demo: official-fixing-like rate (illustrative, not a quotation)',
  },
};

/** Weeks anchored at the master-data start up to the end of the plan horizon (bounded, reruns extend). */
export function fxWeeks(ctx: ShowcaseContext): Week[] {
  const weeks: Week[] = [];
  for (
    let from = FROM_MS, index = 0;
    from < ctx.window.to;
    from += WEEK_MS, index += 1
  ) {
    weeks.push({ from, to: from + WEEK_MS, index });
  }
  return weeks;
}

/** The newest week that is fully past: its economic rate is the late-approved one. */
export function lateWeek(
  ctx: ShowcaseContext,
  weeks: readonly Week[],
): Week | null {
  const past = weeks.filter((w) => w.to <= ctx.window.today);
  return past[past.length - 1] ?? null;
}

function rateOf(
  ctx: ShowcaseContext,
  type: 'economic' | 'group_reporting',
  week: Week,
): string {
  const level = LEVEL[type];
  const random = new SeededRandom([ctx.seed, 'fx', type, week.index]);
  const value =
    level.base *
    (1 + level.drift) ** week.index *
    random.between(1 - level.jitter, 1 + level.jitter);
  return dec(Math.round(value), 0);
}

async function createRate(
  ctx: ShowcaseContext,
  author: PersonaSession,
  spec: { type: 'economic' | 'group_reporting'; week: Week; late: boolean },
): Promise<FxRow> {
  const source = spec.late
    ? `${LEVEL[spec.type].source}; late-approved after the periods were calculated`
    : LEVEL[spec.type].source;
  return author.post<FxRow>(
    '/v2/fx-rates',
    {
      rateType: spec.type,
      fromCurrency: 'USD',
      toCurrency: 'IRR',
      rate: rateOf(ctx, spec.type, spec.week),
      effectiveFrom: new Date(spec.week.from).toISOString(),
      effectiveTo: new Date(spec.week.to).toISOString(),
      source,
    },
    `fx ${spec.type} week ${spec.week.index}`,
  );
}

/** Drafts and approves every week's rate of both tables except the late one; returns the late draft id. */
export async function seedFxRates(
  ctx: ShowcaseContext,
): Promise<string | null> {
  const author = ctx.as('finance', 0);
  const approver = ctx.financeApproverOtherThan(ctx.personaOf(author));
  const existing = await author.listAll<FxRow>('/v2/fx-rates', {
    fromCurrency: 'USD',
    toCurrency: 'IRR',
  });
  const weeks = fxWeeks(ctx);
  const late = lateWeek(ctx, weeks);
  let lateId: string | null = null;
  for (const type of ['economic', 'group_reporting'] as const) {
    // a plant's own approved rates of the table are kept untouched (they would overlap the demo weeks)
    if (
      existing.some(
        (r) =>
          r.rateType === type &&
          r.state === 'approved' &&
          !(r.source ?? '').startsWith('Demo:'),
      )
    ) {
      ctx.logger.log(
        `Demo: ${type} FX table already has approved non-demo rates, kept as they are`,
      );
      continue;
    }
    for (const week of weeks) {
      const at = new Date(week.from).toISOString();
      const found = existing.find(
        (r) =>
          r.rateType === type && Date.parse(r.effectiveFrom) === Date.parse(at),
      );
      const isLate = type === 'economic' && late?.index === week.index;
      if (found && (found.state !== 'draft' || !isLate)) {
        ctx.tally.kept('demo fx rates');
        continue;
      }
      ctx.tally.created('demo fx rates');
      if (ctx.dryRun) continue;
      const draft =
        found ?? (await createRate(ctx, author, { type, week, late: isLate }));
      if (isLate) lateId = draft.id;
      else
        await approver.post(
          `/v2/fx-rates/${draft.id}/approve`,
          {},
          `approve fx ${draft.id}`,
        );
    }
  }
  return lateId;
}

/** SME V7: the held-back rate is approved last; the answer names the revaluation it queued. */
export async function approveLateRate(
  ctx: ShowcaseContext,
  id: string | null,
): Promise<void> {
  if (!id || ctx.dryRun) return;
  const approver = ctx.financeApproverOtherThan(ctx.persona('finance', 0));
  const answer = await approver.post<{
    revaluation: { from: string; to: string | null } | null;
  }>(`/v2/fx-rates/${id}/approve`, {}, `approve late fx ${id}`);
  ctx.logger.log(
    `Demo: late-approved FX rate queued a revaluation from ${answer.revaluation?.from ?? '?'} to ${answer.revaluation?.to ?? 'open end'}`,
  );
}
