import { A, HOUR } from './support/actuals-world';
import { plus } from './support/accounting-world';
import { ApiError } from './support/plan-world';
import { ReconciliationWorld } from './support/reconciliation-world';

interface CandidateWithDerivation {
  lossLineId: string;
  quantity: string | null;
  causeEventId: string | null;
  derivation?: {
    basis: string;
    ledger: string;
    durationSeconds: number;
    rate: { versionId: string; value: string | null } | null;
    rateScaledToTarget: boolean;
    sourceEventId: string | null;
    evidence: Array<{ eventId: string | null; share: string }>;
  };
}

interface AttributedBody {
  eventId: string;
  items: Array<{
    periodId: string;
    status: string;
    lifecycle: string;
    quantities: Array<{ kind: string; quantity: string }>;
  }>;
  truncated: boolean;
}

interface PickerBody {
  items: Array<{ id: string; periodId: string; causeEventId: string | null }>;
  nextCursor: string | null;
}

/**
 * UX U3 additive reads on real Postgres: candidate derivation inputs and the month close state on the
 * reconciliation view (D-2, D-7), the loss an event carries per period (G-2b) and the plant-wide loss-line
 * picker (G-3), under the unit scope (another unit's event is 404, its lines are not listed).
 */
describe('loss attribution reads (UX U3)', () => {
  const env = new ReconciliationWorld();
  let eventId = '';

  beforeAll(async () => {
    await env.start();
    eventId = await env.lossEvent(env.world.unitA1, plus(A, HOUR), 1);
    await env.settle();
  });
  afterAll(() => env.stop());

  it('D-2 / D-7: candidates carry their stored derivation; the open month allows a direct revise', async () => {
    const view = (await env.view()) as unknown as {
      candidates: CandidateWithDerivation[];
      monthClose: { state: string; correctionPath: string };
    };
    const candidate = view.candidates.find((c) => c.causeEventId === eventId);
    expect(candidate?.derivation).toMatchObject({
      ledger: 'plan',
      durationSeconds: 3600,
      sourceEventId: eventId,
      evidence: [{ eventId, share: '1' }],
    });
    expect(candidate?.derivation?.rate?.versionId).toEqual(expect.any(String));
    expect(view.monthClose).toEqual({
      state: 'open',
      monthKey: null,
      correctionPath: 'direct',
    });
  });

  it('G-2b: the event’s provisional loss per period; another unit’s user gets 404', async () => {
    const response = await env
      .get(`production-events/${eventId}/attributed-losses`)
      .expect(200);
    const body = response.body as AttributedBody;
    expect(body.eventId).toBe(eventId);
    expect(body.truncated).toBe(false);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      periodId: env.periodA1,
      status: 'provisional',
      lifecycle: 'draft',
    });
    expect(body.items[0].quantities[0].kind).toBe('availability');
    const other = await env.unitUser(env.world.unitA2);
    const denied = await env
      .get(`production-events/${eventId}/attributed-losses`, other)
      .expect(404);
    expect((denied.body as ApiError).code).toBe('NOT_FOUND');
  });

  it('G-3: the picker lists the line by text and unit; other units and bad ranges are refused', async () => {
    const found = (
      await env
        .get(`loss-lines?q=test%20stop&unitIds=${env.world.unitA1}&limit=50`)
        .expect(200)
    ).body as PickerBody;
    expect(found.items.some((i) => i.causeEventId === eventId)).toBe(true);
    const other = await env.unitUser(env.world.unitA2);
    const none = (await env.get('loss-lines', other).expect(200))
      .body as PickerBody;
    expect(none.items.some((i) => i.periodId === env.periodA1)).toBe(false);
    const bad = await env
      .get('loss-lines?from=2026-02-02T00:00:00Z&to=2026-02-01T00:00:00Z')
      .expect(422);
    expect((bad.body as ApiError).code).toBe('INVALID_RANGE');
  });
});
