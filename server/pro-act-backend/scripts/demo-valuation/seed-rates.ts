import { Logger } from '@nestjs/common';
import { DemoApiClient } from './api-client';
import { DEMO_RANGES, DemoRange, demoAmount, demoKey } from './demo-random';

type Basis = 'contribution_margin' | 'standard_cost' | 'cost_per_hour';

interface ProfileRow {
  id: string;
  quantityUom: string | null;
}

interface ImpactCodeRow {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

interface RateRow {
  id: string;
  profileId: string | null;
  impactCodeId: string | null;
  basis: Basis;
  value: string;
  currency: string;
  state: string;
  effectiveFrom: string;
}

export interface RateSeedOptions {
  /** creates the drafts (their author) */
  client: DemoApiClient;
  /** approves them: a second manager, never the author (403 SEPARATION_OF_DUTIES) */
  approver: DemoApiClient;
  tenantId: string;
  seed: string;
  currency: string;
  effectiveFrom: string;
  dryRun: boolean;
}

interface PlannedRate {
  owner: { profileId: string } | { impactCodeId: string };
  ownerId: string;
  label: string;
  basis: Basis;
  value: string;
  perUom: string;
}

export interface RateSeedSummary {
  created: number;
  approvedDrafts: number;
  kept: number;
  skippedNoUom: number;
  planned: PlannedRate[];
}

const logger = new Logger('DemoValuationSeed');

const RANGE_OF: Record<Basis, DemoRange> = {
  contribution_margin: DEMO_RANGES.contributionMarginPerUnit,
  standard_cost: DEMO_RANGES.standardCostPerUnit,
  cost_per_hour: DEMO_RANGES.costPerHour,
};

function plan(
  options: RateSeedOptions,
  profiles: ProfileRow[],
  impactCodes: ImpactCodeRow[],
): PlannedRate[] {
  const value = (ownerId: string, basis: Basis) =>
    demoAmount(RANGE_OF[basis], [options.seed, ownerId, basis]);
  const perProfile = profiles.flatMap((p) =>
    (['contribution_margin', 'standard_cost'] as const).map((basis) => ({
      owner: { profileId: p.id },
      ownerId: p.id,
      label: `profile ${p.id}`,
      basis,
      value: value(p.id, basis),
      perUom: p.quantityUom ?? '',
    })),
  );
  const perImpact = impactCodes.map((c) => ({
    owner: { impactCodeId: c.id },
    ownerId: c.id,
    label: `impact ${c.code} ${c.name}`,
    basis: 'cost_per_hour' as const,
    value: value(c.id, 'cost_per_hour'),
    perUom: 'h',
  }));
  return [...perProfile, ...perImpact];
}

/**
 * Creates (author) and approves (a second manager) one USD valuation rate version per approved profile
 * (contribution margin and standard cost per profile quantity unit) and per active impact code (cost per
 * hour), effective from `effectiveFrom`, open-ended. A key that already has an approved version is left
 * as it is.
 */
export async function seedValuationRates(
  options: RateSeedOptions,
): Promise<RateSeedSummary> {
  const { client } = options;
  const allProfiles = await client.listAll<ProfileRow>('/api/v2/profiles', {
    state: 'approved',
  });
  const impactCodes = (
    await client.listAll<ImpactCodeRow>('/api/v2/impact-codes')
  ).filter((c) => c.active);
  const existing = await client.listAll<RateRow>('/api/v2/valuation-rates');
  const profiles = allProfiles.filter((p) => p.quantityUom);
  const summary: RateSeedSummary = {
    created: 0,
    approvedDrafts: 0,
    kept: 0,
    skippedNoUom: allProfiles.length - profiles.length,
    planned: plan(options, profiles, impactCodes),
  };
  for (const rate of summary.planned) {
    await applyRate(options, rate, existing, summary);
  }
  return summary;
}

async function applyRate(
  options: RateSeedOptions,
  rate: PlannedRate,
  existing: readonly RateRow[],
  summary: RateSeedSummary,
): Promise<void> {
  const sameKey = existing.filter(
    (r) =>
      (r.profileId ?? r.impactCodeId) === rate.ownerId &&
      r.basis === rate.basis,
  );
  if (sameKey.some((r) => r.state === 'approved')) {
    summary.kept += 1;
    return;
  }
  const draft = sameKey.find(
    (r) =>
      r.state === 'draft' &&
      r.currency === options.currency &&
      Number(r.value) === Number(rate.value) &&
      Date.parse(r.effectiveFrom) === Date.parse(options.effectiveFrom),
  );
  if (options.dryRun) {
    logger.log(
      `[dry run] ${rate.label} ${rate.basis} = ${rate.value} ${options.currency}/${rate.perUom}`,
    );
    return;
  }
  const id = draft ? draft.id : await createRate(options, rate);
  await approveRate(options, id);
  if (draft) summary.approvedDrafts += 1;
  else summary.created += 1;
}

async function createRate(
  options: RateSeedOptions,
  rate: PlannedRate,
): Promise<string> {
  const body = {
    ...rate.owner,
    basis: rate.basis,
    value: rate.value,
    currency: options.currency,
    perUom: rate.perUom,
    effectiveFrom: options.effectiveFrom,
  };
  const key = demoKey([
    options.tenantId,
    'create',
    rate.ownerId,
    rate.basis,
    rate.value,
    options.currency,
    options.effectiveFrom,
  ]);
  const created = await options.client.write<{ id: string }>(
    'POST',
    '/api/v2/valuation-rates',
    body,
    { idempotencyKey: key },
  );
  return created.body.id;
}

async function approveRate(
  options: RateSeedOptions,
  id: string,
): Promise<void> {
  await options.approver.write(
    'POST',
    `/api/v2/valuation-rates/${id}/approve`,
    { supersede: false },
    { idempotencyKey: demoKey([options.tenantId, 'approve', id]) },
  );
}
