/**
 * Guide lesson 6 / E2E §7: a production profile per grade (Extruder1 × product × normal, t per hour,
 * Single stream, from 17 Oct 2026 06:00) drafted by Bahram and approved by Reza, then separately approved
 * Sustained and Planning rate versions (profile approval alone does not approve its rates): HD5502 28 t/h,
 * TRAIN-B 24 t/h.
 */
import { OPERATING_MODE, PRODUCTS, ProductSpec, TIMES } from './train-catalog';
import { known, TrainContext } from './train-context';

interface ProfileRow {
  id: string;
  productId: string;
  operatingMode: string;
  state: string;
}

interface RateRow {
  id: string;
  rateKind: string;
  state: string;
}

const RATE_KINDS = ['sustained', 'planning'] as const;

const profileBody = (unitId: string, productId: string) => ({
  unitId,
  productId,
  operatingMode: OPERATING_MODE,
  quantityUom: 't',
  rateTimebase: 'h',
  capacityModel: 'single_stream',
  effectiveFrom: TIMES.dayStart,
});

async function ensureProfile(
  ctx: TrainContext,
  spec: ProductSpec,
  existing: ProfileRow[],
): Promise<string | null> {
  const productId = ctx.ids.products.get(spec.code);
  if (!known(ctx, productId, `product ${spec.code}`)) return null;
  const found = existing.find(
    (p) =>
      p.productId === productId &&
      p.operatingMode === OPERATING_MODE &&
      p.state !== 'retired',
  );
  if (found?.state === 'approved') {
    ctx.tally.kept('profiles');
    return found.id;
  }
  ctx.tally.created('profiles');
  if (ctx.dryRun) return found?.id ?? null;
  const profile =
    found ??
    (await ctx
      .as('bahram')
      .post<ProfileRow>(
        '/v2/profiles',
        profileBody(ctx.ids.unitId, productId),
        `profile ${spec.code}`,
      ));
  await ctx
    .as('reza')
    .post(
      `/v2/profiles/${profile.id}/approve`,
      {},
      `approve profile ${profile.id}`,
    );
  return profile.id;
}

async function ensureRate(
  ctx: TrainContext,
  profileId: string,
  kind: string,
  rate: string,
): Promise<void> {
  const author = ctx.as('bahram');
  const rates = (
    await author.listAll<RateRow>(`/v2/profiles/${profileId}/rates`)
  ).filter((r) => r.rateKind === kind);
  if (rates.some((r) => r.state === 'approved')) {
    ctx.tally.kept('rates');
    return;
  }
  ctx.tally.created('rates');
  if (ctx.dryRun) return;
  const draft =
    rates.find((r) => r.state === 'draft') ??
    (await author.post<RateRow>(
      `/v2/profiles/${profileId}/rates`,
      { rateKind: kind, rate, timebase: 'h', effectiveFrom: TIMES.dayStart },
      `rate ${profileId} ${kind}`,
    ));
  await ctx
    .as('reza')
    .post(`/v2/rates/${draft.id}/approve`, {}, `approve rate ${draft.id}`);
}

export async function seedProfiles(ctx: TrainContext): Promise<void> {
  if (!known(ctx, ctx.ids.unitId, 'unit Extruder1')) return;
  const existing = await ctx
    .as('bahram')
    .listAll<ProfileRow>('/v2/profiles', { unitId: ctx.ids.unitId });
  for (const spec of PRODUCTS) {
    const profileId = await ensureProfile(ctx, spec, existing);
    if (!profileId) {
      ctx.tally.add('rates', RATE_KINDS.length, 0);
      continue;
    }
    ctx.ids.profiles.set(spec.code, profileId);
    for (const kind of RATE_KINDS)
      await ensureRate(ctx, profileId, kind, spec.rate);
  }
}
