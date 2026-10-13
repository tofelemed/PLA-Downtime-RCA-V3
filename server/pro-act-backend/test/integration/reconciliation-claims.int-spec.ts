import { A, HOUR } from './support/actuals-world';
import { plus } from './support/accounting-world';
import {
  ReconciliationBody,
  ReconciliationWorld,
} from './support/reconciliation-world';

interface IssuesError {
  code: string;
  details?: { issues?: Array<{ code: string }> };
}

/**
 * LA-02b (SME Q3) on real Postgres: an off-spec declaration of 10 t on a shift whose measured gross equals
 * good (no measured quality loss) is calculated and flagged; the revision can be saved but not submitted
 * while the claim stands; rejecting it (and explaining the shortfall otherwise) lets it through.
 */
describe('claims beyond the measurements block submission (LA-02b)', () => {
  const env = new ReconciliationWorld();
  let reason = '';

  beforeAll(async () => {
    await env.start();
    reason = await env.reasonCode('FEED');
    await env.lossEvent(env.world.unitA1, plus(A, 2 * HOUR), 0.25, {
      physicalType: 'quality_loss',
      quantity: '10',
      quantityUom: 't',
    });
    await env.settle();
  });
  afterAll(() => env.stop());

  const manual = (view: ReconciliationBody, quantity: string) => ({
    action: 'manual',
    sliceId: view.slices[0].sliceId,
    kind: 'availability',
    quantity,
    missingEvent: true,
    reasonCodeId: reason,
  });

  it('refuses submission while the off-spec claim is accepted, accepts it once rejected', async () => {
    const view = await env.view();
    expect(view.slices[0].flags).toContain('claim_exceeds_component');
    const claim = view.candidates.find((c) => c.kind === 'quality')!;
    await env
      .saveLines(view, [
        { action: 'accept', autoKey: claim.autoKey },
        manual(view, '140'),
      ])
      .expect(200);
    const blocked = await env.submit(await env.view()).expect(422);
    expect(
      ((blocked.body as IssuesError).details?.issues ?? []).map((i) => i.code),
    ).toContain('CLAIM_EXCEEDS_MEASUREMENT');
    const again = await env.view();
    await env
      .saveLines(again, [
        {
          action: 'reject',
          autoKey: claim.autoKey,
          reason: 'lab sample belongs to the previous shift',
        },
        manual(again, '150'),
      ])
      .expect(200);
    await env.submit(await env.view()).expect(200);
  });
});
