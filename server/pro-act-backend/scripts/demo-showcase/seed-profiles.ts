/**
 * Production profiles (unit × product, t per h) with approved nameplate, sustained and planning rates,
 * and the USD valuation rates: contribution margin and standard cost per tonne per profile, cost per hour
 * per impact code. Authored by a master-data admin, approved by a manager (never the author). The
 * approved valuation policy and the approved USD→IRR FX rate of the plant are reused, never changed.
 */
import { MASTER_DATA_FROM, PLANNING_FACTOR, UnitSpec } from './catalog-plants';
import { PersonaSession } from './showcase-client';
import { ProfileRef, ShowcaseContext } from './showcase-context';
import { dec, SeededRandom } from './showcase-random';

const FROM = `${MASTER_DATA_FROM}T00:00:00.000Z`;

interface ProfileRow {
  id: string;
  productId: string;
  state: string;
}

interface RateRow {
  id: string;
  rateKind?: string;
  basis?: string;
  state: string;
  effectiveFrom: string;
  effectiveTo: string | null;
}

/** USD per tonne by product family (contribution margin), before the deterministic jitter */
const MARGIN_PER_T: Record<string, number> = {
  'HDPE-PE100-BK': 390,
  'HDPE-F7000': 320,
  'HDPE-BL3': 300,
  'HDPE-IM55': 280,
  'PP-H030': 240,
  'PP-C510': 270,
  'PP-T20': 330,
};

/** USD per hour of stop by impact code */
const COST_PER_HOUR: Record<string, number> = {
  IC001: 4800,
  IC002: 2200,
  IC003: 1800,
  IC004: 2600,
  IC005: 2400,
  IC006: 1500,
  IC007: 3000,
  IC008: 3500,
};

async function ensureRate(
  ctx: ShowcaseContext,
  profile: ProfileRow,
  kind: string,
  rate: number,
): Promise<void> {
  const author = ctx.as('authors', 1);
  const rates = await author.listAll<RateRow>(
    `/v2/profiles/${profile.id}/rates`,
  );
  const same = rates.filter((r) => r.rateKind === kind);
  if (same.some((r) => r.state === 'approved')) {
    ctx.tally.kept('profile rates');
    return;
  }
  ctx.tally.created('profile rates');
  if (ctx.dryRun) return;
  const draft =
    same.find((r) => r.state === 'draft') ??
    (await author.post<RateRow>(
      `/v2/profiles/${profile.id}/rates`,
      {
        rateKind: kind,
        rate: dec(rate, 2),
        timebase: 'h',
        effectiveFrom: FROM,
      },
      `rate ${profile.id} ${kind}`,
    ));
  await ctx
    .approverOtherThan(ctx.personaOf(author), 1)
    .post(`/v2/rates/${draft.id}/approve`, {}, `approve rate ${draft.id}`);
}

async function ensureProfile(
  ctx: ShowcaseContext,
  unit: UnitSpec,
  productCode: string,
  existing: ProfileRow[],
): Promise<ProfileRow | null> {
  const unitId = ctx.ids.units.get(unit.key);
  const productId = ctx.ids.products.get(productCode);
  if (!unitId || !productId) return null;
  const author = ctx.as('authors', 0);
  let profile = existing.find(
    (p) => p.productId === productId && p.state !== 'retired',
  );
  if (profile?.state === 'approved') {
    ctx.tally.kept('profiles');
    return profile;
  }
  ctx.tally.created('profiles');
  if (ctx.dryRun) return null;
  profile ??= await author.post<ProfileRow>(
    '/v2/profiles',
    {
      unitId,
      productId,
      quantityUom: 't',
      rateTimebase: 'h',
      capacityModel: 'single_stream',
      effectiveFrom: FROM,
    },
    `profile ${unit.key} ${productCode}`,
  );
  await ctx
    .approverOtherThan(ctx.personaOf(author))
    .post(
      `/v2/profiles/${profile.id}/approve`,
      {},
      `approve profile ${profile.id}`,
    );
  return profile;
}

export async function seedProfiles(ctx: ShowcaseContext): Promise<void> {
  for (const unit of ctx.scenario.units) {
    const unitId = ctx.ids.units.get(unit.key);
    const existing = unitId
      ? await ctx
          .as('authors', 0)
          .listAll<ProfileRow>('/v2/profiles', { unitId })
      : [];
    for (const productCode of unit.products) {
      const profile = await ensureProfile(ctx, unit, productCode, existing);
      const random = new SeededRandom([
        ctx.seed,
        'rate',
        unit.key,
        productCode,
      ]);
      const sustained =
        Math.round(unit.sustainedRate * random.between(0.9, 1.05) * 10) / 10;
      const planning = Math.round(sustained * PLANNING_FACTOR * 10) / 10;
      if (!profile) continue;
      await ensureRate(ctx, profile, 'nameplate', Math.round(sustained * 1.12));
      await ensureRate(ctx, profile, 'sustained', sustained);
      await ensureRate(ctx, profile, 'planning', planning);
      const ref: ProfileRef = {
        id: profile.id,
        unitKey: unit.key,
        productCode,
        planningRate: planning,
        sustainedRate: sustained,
      };
      ctx.ids.profiles.set(`${unit.key}:${productCode}`, ref);
    }
  }
  await seedValuationRates(ctx);
}

interface ValuationKey {
  label: string;
  query: Record<string, string>;
  body: Record<string, string>;
}

/** Creates the approved version from FROM up to the earliest approved one (open-ended when none). */
async function ensureValuation(
  ctx: ShowcaseContext,
  author: PersonaSession,
  key: ValuationKey,
): Promise<void> {
  const rows = await author.listAll<RateRow>('/v2/valuation-rates', key.query);
  const approved = rows
    .filter((r) => r.state === 'approved')
    .map((r) => Date.parse(r.effectiveFrom));
  const earliest = approved.length ? Math.min(...approved) : null;
  if (earliest !== null && earliest <= Date.parse(FROM)) {
    ctx.tally.kept('valuation rates');
    return;
  }
  ctx.tally.created('valuation rates');
  if (ctx.dryRun) return;
  const body: Record<string, string> = {
    ...key.body,
    currency: 'USD',
    effectiveFrom: FROM,
  };
  if (earliest !== null) body.effectiveTo = new Date(earliest).toISOString();
  const draft = await author.post<RateRow>(
    '/v2/valuation-rates',
    body,
    `valuation ${key.label}`,
  );
  await ctx
    .approverOtherThan(ctx.personaOf(author), 2)
    .post(
      `/v2/valuation-rates/${draft.id}/approve`,
      {},
      `approve valuation ${draft.id}`,
    );
}

async function seedValuationRates(ctx: ShowcaseContext): Promise<void> {
  const author = ctx.as('authors', 0);
  for (const profile of ctx.ids.profiles.values()) {
    const random = new SeededRandom([
      ctx.seed,
      'value',
      profile.unitKey,
      profile.productCode,
    ]);
    const margin =
      (MARGIN_PER_T[profile.productCode] ?? 300) * random.between(0.95, 1.05);
    const cost = random.between(950, 1180);
    for (const [basis, value] of [
      ['contribution_margin', margin],
      ['standard_cost', cost],
    ] as const) {
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
  for (const [code, perHour] of Object.entries(COST_PER_HOUR)) {
    const impactCodeId = ctx.ids.impacts.get(code);
    if (!impactCodeId) continue;
    await ensureValuation(ctx, author, {
      label: `${code} cost_per_hour`,
      query: { impactCodeId, basis: 'cost_per_hour' },
      body: {
        impactCodeId,
        basis: 'cost_per_hour',
        value: dec(perHour, 2),
        perUom: 'h',
      },
    });
  }
}
