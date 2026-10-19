/**
 * Guide lesson 21 / E2E §14, authored by the finance maintainer (Darya) and approved by the finance
 * approver (Kamran): the valuation policy (USD and IRR, contribution margin by default, economic view for
 * sold-out products), the profile valuation rates (contribution margin 150 USD/t for both grades,
 * downgrade price difference 80 USD/t for HD5502), the illustrative FX 600,000 IRR per USD and HD5502's
 * sold-out demand status for October 2026.
 */
import { DEMAND, FX_RATE, VALUATION_POLICY } from './train-catalog-setup';
import { PRODUCTS, TIMES } from './train-catalog';
import { known, TrainContext } from './train-context';

interface PolicyRow {
  id: string;
  approved: boolean;
  body: { defaultBasis?: string };
}

interface VersionedRow {
  id: string;
  state: string;
}

interface FxRow extends VersionedRow {
  rate: string;
}

/** Approves `draft` as Kamran (never its author Darya). */
async function approve(
  ctx: TrainContext,
  path: string,
  id: string,
): Promise<void> {
  await ctx
    .as('kamran')
    .post(`/v2/${path}/${id}/approve`, {}, `approve ${path} ${id}`);
}

async function ensurePolicy(ctx: TrainContext): Promise<void> {
  const policies = await ctx
    .as('darya')
    .listAll<PolicyRow>('/v2/valuation-policies');
  // the server seeds an unapproved default on first read (economic view): never approve that one, only
  // a version carrying the guide's settings
  const ours = policies.filter(
    (p) => p.body.defaultBasis === VALUATION_POLICY.defaultBasis,
  );
  if (ours.some((p) => p.approved)) {
    ctx.tally.kept('valuation policy');
    return;
  }
  ctx.tally.created('valuation policy');
  if (ctx.dryRun) return;
  const body = {
    ...VALUATION_POLICY,
    reportingCurrencies: [...VALUATION_POLICY.reportingCurrencies],
  };
  const draft =
    ours[0] ??
    (await ctx
      .as('darya')
      .post<PolicyRow>('/v2/valuation-policies', body, 'valuation policy'));
  await approve(ctx, 'valuation-policies', draft.id);
}

async function ensureValuationRate(
  ctx: TrainContext,
  profileId: string,
  basis: string,
  value: string,
): Promise<void> {
  const rows = await ctx
    .as('darya')
    .listAll<VersionedRow>('/v2/valuation-rates', { profileId, basis });
  if (rows.some((r) => r.state === 'approved')) {
    ctx.tally.kept('valuation rates');
    return;
  }
  ctx.tally.created('valuation rates');
  if (ctx.dryRun) return;
  const draft =
    rows.find((r) => r.state === 'draft') ??
    (await ctx.as('darya').post<VersionedRow>(
      '/v2/valuation-rates',
      {
        profileId,
        basis,
        value,
        currency: 'USD',
        perUom: 't',
        effectiveFrom: TIMES.dayStart,
      },
      `valuation ${profileId} ${basis}`,
    ));
  await approve(ctx, 'valuation-rates', draft.id);
}

async function ensureValuationRates(ctx: TrainContext): Promise<void> {
  for (const spec of PRODUCTS) {
    const profileId = ctx.ids.profiles.get(spec.code);
    if (!known(ctx, profileId, `profile ${spec.code}`)) continue;
    await ensureValuationRate(
      ctx,
      profileId,
      'contribution_margin',
      spec.margin,
    );
    if (spec.downgradeDifference)
      await ensureValuationRate(
        ctx,
        profileId,
        'downgrade_price_difference',
        spec.downgradeDifference,
      );
  }
}

async function ensureFx(ctx: TrainContext): Promise<void> {
  const { rateType, fromCurrency, toCurrency } = FX_RATE;
  const rows = await ctx
    .as('darya')
    .listAll<FxRow>('/v2/fx-rates', { rateType, fromCurrency, toCurrency });
  const same = rows.filter((r) => Number(r.rate) === Number(FX_RATE.rate));
  if (same.some((r) => r.state === 'approved')) {
    ctx.tally.kept('fx rates');
    return;
  }
  ctx.tally.created('fx rates');
  if (ctx.dryRun) return;
  const draft =
    same.find((r) => r.state === 'draft') ??
    (await ctx
      .as('darya')
      .post<FxRow>('/v2/fx-rates', { ...FX_RATE }, 'fx USD IRR rate'));
  await approve(ctx, 'fx-rates', draft.id);
}

async function ensureDemand(ctx: TrainContext): Promise<void> {
  const productId = ctx.ids.products.get(DEMAND.productCode);
  if (!known(ctx, productId, `product ${DEMAND.productCode}`)) return;
  const rows = await ctx
    .as('darya')
    .listAll<VersionedRow>('/v2/demand-statuses', { productId });
  if (rows.some((r) => r.state === 'approved')) {
    ctx.tally.kept('demand status');
    return;
  }
  ctx.tally.created('demand status');
  if (ctx.dryRun) return;
  const { productCode, ...fields } = DEMAND;
  const draft =
    rows.find((r) => r.state === 'draft') ??
    (await ctx
      .as('darya')
      .post<VersionedRow>(
        '/v2/demand-statuses',
        { ...fields, productId },
        `demand ${productCode}`,
      ));
  await approve(ctx, 'demand-statuses', draft.id);
}

export async function seedFinance(ctx: TrainContext): Promise<void> {
  await ensurePolicy(ctx);
  await ensureValuationRates(ctx);
  await ensureFx(ctx);
  await ensureDemand(ctx);
}
