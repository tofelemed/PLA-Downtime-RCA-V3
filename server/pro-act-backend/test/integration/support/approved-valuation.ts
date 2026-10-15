import { RcaWorld } from './rca-world';

/** Finance approves the seeded v3 policy, a 300 USD/t margin and a sold-out March (test data). */
export async function approvedValuation(env: RcaWorld): Promise<void> {
  const [slice] = await env.rows<{ profile_id: string; product_id: string }>(
    `SELECT profile_id, product_id FROM period_product_slices WHERE period_id = $1 AND superseded_at IS NULL`,
    [env.periodA1],
  );
  const [policy] = (
    (await env.get('valuation-policies').expect(200)).body as {
      items: Array<{ id: string }>;
    }
  ).items;
  await env
    .post(`valuation-policies/${policy.id}/approve`, {}, env.financeApprover)
    .expect(200);
  const approve = async (path: string, body: object) => {
    const created = await env.post(path, body, env.finance).expect(201);
    const id = (created.body as { id: string }).id;
    await env
      .post(`${path}/${id}/approve`, {}, env.financeApprover)
      .expect(200);
  };
  await approve('valuation-rates', {
    profileId: slice.profile_id,
    basis: 'contribution_margin',
    value: '300',
    currency: 'USD',
    effectiveFrom: '2027-03-01T00:00:00Z',
  });
  await approve('demand-statuses', {
    productId: slice.product_id,
    status: 'demand_constrained',
    evidence: 'Order book exceeds output for March (test data)',
    effectiveFrom: '2027-03-01T00:00:00Z',
    effectiveTo: '2027-04-01T00:00:00Z',
  });
}
