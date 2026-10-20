import { RcaRecurrenceWatchJob } from '../../src/rca-case/triggers/rca-recurrence-watch.job';
import { HOUR } from './support/actuals-world';
import { CaseBody, RcaWorld, RecommendationBody } from './support/rca-world';

const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

/**
 * Tier 2 item 2.2 / D-T3 on real Postgres: a closed case whose verified action froze a baseline of 1
 * incident per 1,000 run hours is watched for 180 days. Three unplanned stops on its unit after the closure
 * (no state mapping: no known run time, so the 720 h minimum exposure is the floor) give 4.17 per 1,000 h:
 * the hourly watch records ONE `reevaluate` recommendation for the case and watch window, never changes
 * the case, does not fire again (also after a dismissal), stops after 180 days, and a reopening accepts it.
 */
describe('RCA recurrence watch after closure (D-T3)', () => {
  const env = new RcaWorld();
  let caseId = '';
  const job = () => env.app.get(RcaRecurrenceWatchJob);

  const reevaluations = async (state = 'open') =>
    (
      (
        await env
          .get(
            `rca-recommendations?trigger=reevaluate&rcaId=${caseId}&state=${state}`,
          )
          .expect(200)
      ).body as { items: Array<RecommendationBody & { firedOn: string }> }
    ).items;
  const stored = async () =>
    env.rows<{ n: number }>(
      `SELECT count(*)::int AS n FROM rca_trigger_evaluations WHERE rca_id = $1 AND trigger = 'reevaluate'`,
      [caseId],
    );
  const read = async () =>
    (await env.get(`rcas/${caseId}`).expect(200)).body as CaseBody;

  beforeAll(async () => {
    await env.start();
    const created = await env.createCase({
      title: 'Extruder screen pack blockages',
      unitId: env.world.unitA1,
      status: 'In Progress',
      consequenceClass: 'minor',
    });
    caseId = created.id;
    const first = await env.stopEvent(
      env.world.unitA1,
      30 * 24 * 60,
      30 * 24 * 60 - 30,
    );
    await env.linkEvent(first, { rcaId: caseId }).expect((response) => {
      expect([200, 201]).toContain(response.status);
    });
    const baseline = {
      metric: 'recurrences',
      windowDays: 90,
      value: '1',
      declared: false,
      window: {
        from: ago(120 * DAY),
        to: ago(30 * DAY),
        incidents: 1,
        downtimeSeconds: '1800',
        exposureSeconds: String(1000 * 3600),
        exposureBasis: 'unit_run_time',
      },
      match: 'asset',
      modeKeys: [],
      queryVersion: 'rca-exposure-v3',
      criteria: {
        requiredReduction: 0.5,
        minExposureHours: 720,
        zeroRepeat: false,
      },
    };
    const postAction = {
      windowDays: 15,
      recurrences: 0,
      observedLossSeconds: '0',
      from: ago(28 * DAY),
      to: ago(13 * DAY),
      evaluatedAt: ago(13 * DAY),
      realized: null,
      effectiveness: {
        verdict: 'effective',
        baselineRate: '1',
        postRate: '0',
        reduction: '1',
        mtbfLowerBound95Hours: null,
        reasons: [],
      },
    };
    await env.rows(
      `INSERT INTO rca_actions (tenant_id, row_version, rca_id, title, status, completion_evidence_ref,
              verification_window_start, verification_window_end, baseline, post_action)
       VALUES ($1, 1, $2, 'Replace the screen pack changer seal', 'done', 'WO-881', $3, $4, $5::jsonb, $6::jsonb)`,
      [
        env.world.tenantA,
        caseId,
        ago(28 * DAY),
        ago(13 * DAY),
        JSON.stringify(baseline),
        JSON.stringify(postAction),
      ],
    );
    await env.rows(
      `UPDATE rcas SET status = 'Closed', closure_approved_at = $2, actual_completion_date = $2 WHERE id = $1`,
      [caseId, ago(10 * DAY)],
    );
  });
  afterAll(() => env.stop());

  it('without a recurrence since the closure nothing is recommended', async () => {
    expect(await job().watchCase(caseId)).toBe(false);
    expect(await reevaluations()).toEqual([]);
  });

  it('fires once when the rate since closure exceeds the frozen baseline, and leaves the case closed', async () => {
    for (const daysAgo of [6, 4, 2]) {
      const start = daysAgo * 24 * 60;
      await env.stopEvent(env.world.unitA1, start, start - 20);
    }
    expect(await job().sweep()).toBe(1);
    const [rec] = await reevaluations();
    expect(rec).toMatchObject({
      trigger: 'reevaluate',
      firedOn: 'after_closure',
      outcome: 'recommended',
      state: 'open',
      rcaId: caseId,
    });
    expect(rec.detail).toMatchObject({
      fires: true,
      incidents: 3,
      baselineRate: '1',
      guardedRate: '4.1667',
      minExposureHours: 720,
      version: 'rca-watch-v1',
    });
    expect((await read()).status).toBe('Closed');
  });

  it('is idempotent per case and watch window: no second recommendation', async () => {
    expect(await job().sweep()).toBe(0);
    expect(await job().watchCase(caseId)).toBe(false);
    expect((await stored())[0].n).toBe(1);
  });

  it('a manager approver dismisses it with a reason; the watch does not fire again', async () => {
    const [rec] = await reevaluations();
    await env
      .post(
        `rca-recommendations/${rec.id}/dismiss`,
        { reason: 'Stops caused by the feed outage, not the seal' },
        env.approver,
      )
      .expect(200);
    expect(await reevaluations()).toEqual([]);
    expect(await job().sweep()).toBe(0);
    expect((await stored())[0].n).toBe(1);
  });

  it('stops 180 days after the closure', async () => {
    await env.rows(
      `DELETE FROM rca_trigger_evaluations WHERE rca_id = $1 AND trigger = 'reevaluate'`,
      [caseId],
    );
    const later = new Date(Date.now() + 171 * DAY);
    expect(await job().watchCase(caseId, later)).toBe(false);
    expect(await job().sweep(later)).toBe(0);
  });

  it('reopening the case accepts its open re-evaluate recommendation', async () => {
    expect(await job().watchCase(caseId)).toBe(true);
    const reopened = await env
      .http()
      .post(`/api/v2/rcas/${caseId}/transitions`)
      .set('Authorization', `Bearer ${env.approver}`)
      .set('If-Match', `"${(await read()).rowVersion}"`)
      .send({ to: 'Analysis', note: 'The mode recurs above its baseline' });
    expect(reopened.status).toBe(200);
    expect(await reevaluations()).toEqual([]);
    const [accepted] = await reevaluations('accepted');
    expect(accepted.rcaId).toBe(caseId);
  });
});
