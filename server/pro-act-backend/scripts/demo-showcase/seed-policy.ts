/**
 * Valuation policy of a showcase plant that has none approved yet (Demo Plant 2): contribution margin,
 * exclusive time basis, reported in USD only (the plant has no FX rate), authored by one manager and
 * approved by another. A plant with an approved policy (Demo Plant) keeps it untouched.
 */
import { MASTER_DATA_FROM } from './catalog-plants';
import { ShowcaseContext } from './showcase-context';

interface PolicyRow {
  id: string;
  approved: boolean;
}

export async function seedValuationPolicy(ctx: ShowcaseContext): Promise<void> {
  const author = ctx.as('managers', 0);
  const policies = await author.listAll<PolicyRow>('/v2/valuation-policies');
  if (policies.some((p) => p.approved)) {
    ctx.tally.kept('valuation policy');
    return;
  }
  ctx.tally.add('valuation policy', 1, 0, 'USD only, contribution margin');
  if (ctx.dryRun) return;
  const draft =
    policies[0] ??
    (await author.post<PolicyRow>(
      '/v2/valuation-policies',
      {
        defaultBasis: 'contribution_margin',
        timeBasisRule: 'exclusive',
        reportingCurrencies: ['USD'],
        fxPolicy: 'none',
        effectiveFrom: `${MASTER_DATA_FROM}T00:00:00.000Z`,
        notes:
          'Showcase plant policy: losses valued at contribution margin, reported in USD',
      },
      'valuation policy',
    ));
  await ctx
    .approverOtherThan(ctx.personaOf(author))
    .post(
      `/v2/valuation-policies/${draft.id}/approve`,
      {},
      `approve policy ${draft.id}`,
    );
}
