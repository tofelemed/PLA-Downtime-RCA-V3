/**
 * DEMO DATA ONLY — step `valuation-finance` (SME V1–V8, 14 Oct 2026) of the Demo Plant (HDPE): every row
 * it writes says "Demo:" in its source, evidence or notes (valuation rates have no text field; they are
 * the illustrative HDPE values below). Authored by a finance maintainer, approved by another finance
 * approver (V1). It runs before shift approval and month close, so finance changes settle first:
 *   - USD → IRR rates of the `economic` and `group_reporting` tables, weekly (`seed-valuation-fx.ts`),
 *     the newest past week's economic rate approved last (late-approved);
 *   - per HDPE grade the V2 product values (USD per t): variable cost, salvage, disposal, downgrade price
 *     difference, rework cost — illustrative magnitudes for HDPE, not plant data;
 *   - demand statuses per grade and month: the pipe grade sold out in the previous month (the
 *     demand-constrained month), every other grade and month not constrained (V3);
 *   - a demo valuation policy version: economic view by default, quality defects (IC004) downgraded,
 *     process upsets (IC008) scrapped, other quality losses downgraded (V2 / V8).
 * Never a product default: production tenants get none of this.
 */
import { MASTER_DATA_FROM } from './catalog-plants';
import { PersonaSession } from './showcase-client';
import { ShowcaseContext } from './showcase-context';
import { ensureValuation } from './seed-profiles';
import { approveLateRate, seedFxRates } from './seed-valuation-fx';
import { dec } from './showcase-random';

const FROM = `${MASTER_DATA_FROM}T00:00:00.000Z`;
const DEMO_POLICY_NOTE =
  'Demo: showcase policy (SME V1-V8 pilot settings) — economic view by default, lost sales only where a demand status says sold out, IC004 downgraded, IC008 scrapped';

/** Illustrative HDPE values in USD per tonne (not plant data). */
const PRODUCT_VALUES: Record<string, Record<string, number>> = {
  'HDPE-PE100-BK': {
    variable_cost: 905,
    salvage_value: 310,
    disposal_cost: 18,
    downgrade_price_difference: 165,
    rework_cost: 55,
  },
  'HDPE-F7000': {
    variable_cost: 860,
    salvage_value: 290,
    disposal_cost: 18,
    downgrade_price_difference: 140,
    rework_cost: 48,
  },
  'HDPE-BL3': {
    variable_cost: 840,
    salvage_value: 280,
    disposal_cost: 18,
    downgrade_price_difference: 130,
    rework_cost: 45,
  },
  'HDPE-IM55': {
    variable_cost: 830,
    salvage_value: 275,
    disposal_cost: 18,
    downgrade_price_difference: 120,
    rework_cost: 42,
  },
};

/** The grade whose market was sold out in the demand-constrained month. */
const SOLD_OUT_GRADE = 'HDPE-PE100-BK';

interface Versioned {
  id: string;
  state: string;
  effectiveFrom: string;
  productId?: string;
  notes?: string | null;
  approved?: boolean;
}

async function seedProductValues(ctx: ShowcaseContext): Promise<void> {
  const author = ctx.as('finance', 0);
  for (const profile of ctx.ids.profiles.values()) {
    const values = PRODUCT_VALUES[profile.productCode];
    if (!values) continue;
    for (const [basis, value] of Object.entries(values)) {
      await ensureValuation(ctx, author, {
        label: `${profile.unitKey} ${profile.productCode} ${basis}`,
        query: { profileId: profile.id, basis },
        body: {
          profileId: profile.id,
          basis,
          value: dec(value, 2),
          perUom: 't',
        },
      });
    }
  }
}

/** UTC month starts from the master-data month to the month after the plan horizon. */
function months(ctx: ShowcaseContext): Array<{ from: Date; to: Date }> {
  const list: Array<{ from: Date; to: Date }> = [];
  const start = new Date(FROM);
  for (let m = 0; ; m += 1) {
    const from = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + m, 1),
    );
    if (from.getTime() >= ctx.window.to) return list;
    list.push({
      from,
      to: new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1)),
    });
  }
}

function demandBody(
  productId: string,
  month: { from: Date; to: Date },
  soldOut: boolean,
) {
  return {
    productId,
    status: soldOut ? 'demand_constrained' : 'not_constrained',
    evidence: soldOut
      ? 'Demo: pipe-grade order book exceeded output all month, no finished-goods cover (illustrative)'
      : 'Demo: finished-goods inventory covered every order; output caught up within the month (illustrative)',
    effectiveFrom: month.from.toISOString(),
    effectiveTo: month.to.toISOString(),
  };
}

async function seedDemand(
  ctx: ShowcaseContext,
  author: PersonaSession,
  approver: PersonaSession,
): Promise<void> {
  const existing = await author.listAll<Versioned>('/v2/demand-statuses');
  const all = months(ctx);
  const today = new Date(ctx.window.today);
  const previous = Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1);
  const constrainedMonth =
    all.find((m) => m.from.getTime() === previous) ?? all[0];
  for (const code of Object.keys(PRODUCT_VALUES)) {
    const productId = ctx.ids.products.get(code);
    if (!productId) continue;
    for (const month of all) {
      const found = existing.some(
        (d) =>
          d.productId === productId &&
          Date.parse(d.effectiveFrom) === month.from.getTime(),
      );
      if (found) {
        ctx.tally.kept('demo demand statuses');
        continue;
      }
      ctx.tally.created('demo demand statuses');
      if (ctx.dryRun) continue;
      const soldOut = code === SOLD_OUT_GRADE && month === constrainedMonth;
      const draft = await author.post<Versioned>(
        '/v2/demand-statuses',
        demandBody(productId, month, soldOut),
        `demand ${code}`,
      );
      await approver.post(
        `/v2/demand-statuses/${draft.id}/approve`,
        {},
        `approve demand ${draft.id}`,
      );
    }
  }
}

async function seedDemoPolicy(
  ctx: ShowcaseContext,
  author: PersonaSession,
  approver: PersonaSession,
): Promise<void> {
  const policies = await author.listAll<Versioned>('/v2/valuation-policies');
  if (policies.some((p) => p.notes === DEMO_POLICY_NOTE && p.approved)) {
    ctx.tally.kept('demo valuation policy');
    return;
  }
  ctx.tally.created('demo valuation policy');
  if (ctx.dryRun) return;
  const dispositions: Record<string, string> = {};
  for (const [code, disposition] of [
    ['IC004', 'downgrade'],
    ['IC008', 'scrap'],
  ] as const) {
    const id = ctx.ids.impacts.get(code);
    if (id) dispositions[id] = disposition;
  }
  const draft =
    policies.find((p) => p.notes === DEMO_POLICY_NOTE) ??
    (await author.post<Versioned>(
      '/v2/valuation-policies',
      {
        defaultBasis: 'economic_impact',
        timeBasisRule: 'exclusive',
        reportingCurrencies: ['IRR', 'USD'],
        fxPolicy: 'snapshot',
        independentImpactCodeIds: [],
        fxRateType: 'economic',
        fxDateRule: 'event_date',
        fxAverageMaxDeviation: '0.05',
        demandRule: 'demand_constrained_only',
        qualityDispositions: dispositions,
        defaultQualityDisposition: 'downgrade',
        manualLineHours: true,
        effectiveFrom: FROM,
        notes: DEMO_POLICY_NOTE,
      },
      'demo valuation policy',
    ));
  await approver.post(
    `/v2/valuation-policies/${draft.id}/approve`,
    {},
    `approve policy ${draft.id}`,
  );
}

export async function seedValuationFinance(
  ctx: ShowcaseContext,
): Promise<void> {
  ctx.logger.log(
    'Demo: valuation finance data (illustrative IRR/USD rates, HDPE product values, demand statuses, demo policy)',
  );
  const author = ctx.as('finance', 0);
  const approver = ctx.financeApproverOtherThan(ctx.personaOf(author));
  const lateId = await seedFxRates(ctx);
  await seedProductValues(ctx);
  await seedDemand(ctx, author, approver);
  await seedDemoPolicy(ctx, author, approver);
  await approveLateRate(ctx, lateId);
}
