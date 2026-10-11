import { A, ActualsWorld, B, NEXT_DAY } from './support/actuals-world';
import { ApiError, DAY1 } from './support/plan-world';

/**
 * Adjustments that would make the slice's actuals impossible for the accounting engine (good above
 * gross, negative good) are refused with 422 when proposed or approved, instead of failing the
 * calculation run later. Slice: gross 100, rejects 4, good 96.
 */
describe('actuals adjustments: impossible actuals are refused early', () => {
  const env = new ActualsWorld();
  let sliceId = '';

  const propose = (kind: string, quantity: string) =>
    env.post('actuals/adjustments', {
      sliceId,
      kind,
      quantity,
      basis: 'measured',
      reason: 'weighbridge correction',
      evidenceRef: 'WB-1',
    });
  const settle = async () => {
    await env.relay();
    await env.runActuals();
  };

  beforeAll(async () => {
    await env.start();
    const unit = env.world.unitA1;
    await env.approvedPlan(unit);
    await env.materialize([unit], DAY1, NEXT_DAY);
    const periodId = await env.periodId(unit, A);
    const output = await env.outputEvent(unit, A, B, '100');
    await env.rows(
      `UPDATE production_events SET defective_quantity = 4 WHERE id = $1`,
      [output],
    );
    await settle();
    const detail = await env.detail(periodId);
    sliceId = detail.data.slices[0].id;
    expect(detail.data.slices[0].actuals).toMatchObject({
      gross: '100',
      good: '96',
    });
  });
  afterAll(() => env.stop());

  it('good +5 would exceed gross → 422 ADJUSTMENT_GOOD_EXCEEDS_GROSS with the projected figures', async () => {
    const response = await propose('good', '5').expect(422);
    expect(response.body as ApiError).toMatchObject({
      code: 'ADJUSTMENT_GOOD_EXCEEDS_GROSS',
      details: { gross: '100', good: '101', reject: '4' },
    });
    const rows = await env.rows(
      `SELECT 1 FROM actuals_adjustments WHERE slice_id = $1`,
      [sliceId],
    );
    expect(rows).toHaveLength(0);
  });

  it('the same correction on gross is accepted', async () => {
    await propose('gross', '5').expect(201);
  });

  it('approval re-checks against adjustments approved since the proposal → 422 ADJUSTMENT_NEGATIVE_GOOD', async () => {
    const first = (await propose('reject', '60').expect(201)).body as {
      id: string;
    };
    const second = (await propose('reject', '60').expect(201)).body as {
      id: string;
    };
    await env
      .post(`actuals/adjustments/${first.id}/approve`, {}, env.approver)
      .expect(200);
    const refused = await env
      .post(`actuals/adjustments/${second.id}/approve`, {}, env.approver)
      .expect(422);
    expect((refused.body as ApiError).code).toBe('ADJUSTMENT_NEGATIVE_GOOD');
    const [stored] = await env.rows<{ state: string }>(
      `SELECT state FROM actuals_adjustments WHERE id = $1`,
      [second.id],
    );
    expect(stored.state).toBe('proposed');
  });
});
