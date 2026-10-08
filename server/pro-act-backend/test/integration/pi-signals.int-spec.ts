import { randomUUID } from 'crypto';
import { countRows } from './support/intake-fixtures';
import { MINUTE, PiSignalWorld, PreviewBody } from './support/pi-signal-world';
import { signToken } from './support/test-app';

/**
 * Plan 1.7 against the PI Web API simulator: signals through v2, recorded values polled into versioned
 * samples (an archive correction is a second revision), the preview with method, coverage and
 * exceptions (T25–T27 shapes) and PI totals restricted to rate signals (422 for counters).
 */
describe('PI actuals: signals, recorded samples, preview (plan 1.7)', () => {
  const env = new PiSignalWorld();
  let recordedJob = '';

  beforeAll(() => env.start());
  afterAll(() => env.stop());

  it('refuses a rate without timebase (422) and a writer without an integration role (403)', async () => {
    const body = {
      connectionId: env.pi.connectionId,
      unitId: env.world.unitA1,
      name: 'x',
      sourceKey: 'PT-X',
      semanticType: 'rate',
    };
    const missing = await env.post('signals', body).expect(422);
    expect((missing.body as { code: string }).code).toBe(
      'RATE_TIMEBASE_REQUIRED',
    );
    const analyst = signToken(env.app, {
      userId: randomUUID(),
      tenantId: env.world.tenantA,
    });
    await env
      .post('signals', { ...body, rateTimebase: 'h' }, analyst)
      .expect(403);
  });

  it('refuses a product that is not of the tenant (422 INVALID_REFERENCE)', async () => {
    const response = await env
      .post('signals', {
        connectionId: env.pi.connectionId,
        unitId: env.world.unitA1,
        name: 'x',
        sourceKey: 'PT-PRODUCT',
        semanticType: 'counter',
        productId: randomUUID(),
      })
      .expect(422);
    expect((response.body as { code: string }).code).toBe('INVALID_REFERENCE');
  });

  it('polls recorded values of every signal into samples; a re-read stores nothing new', async () => {
    recordedJob = await env.pi.startJob(
      { mode: 'recorded', overlapMinutes: 60 },
      500,
    );
    expect(await env.pi.runWindow(recordedJob)).toEqual([
      expect.objectContaining({ status: 'committed', accepted: 13 }),
    ]);
    await env.pi.normalizeAll();

    expect(
      await env.rows(
        `SELECT s.source_key, count(*)::int AS n FROM measurement_samples m JOIN signals s ON s.id = m.signal_id
          GROUP BY s.source_key ORDER BY s.source_key`,
      ),
    ).toEqual([
      { source_key: 'PT-CNT', n: 4 },
      { source_key: 'PT-RATE', n: 7 },
      { source_key: 'PT-RESET', n: 2 },
    ]);
    const [timeout] = await env.rows(
      `SELECT quality, quality_flags, state_name FROM measurement_samples WHERE observed_at = $1`,
      [env.at(14)],
    );
    expect(timeout).toEqual({
      quality: 'bad',
      quality_flags: ['system:I/O Timeout'],
      state_name: 'I/O Timeout',
    });

    await env.pi.runWindow(recordedJob);
    await env.pi.normalizeAll();
    expect(await countRows(env.harness.dataSource, 'measurement_samples')).toBe(
      13,
    );
  });

  it('T25 shape: preview integrates 120 t/h over 30 min to 60 t with method, timebase and full coverage', async () => {
    const body = await env.preview('rate', 0, 30);

    expect(body.engine).toBe('rate_integration');
    expect(body.result).toMatchObject({
      quantity: '60',
      method: { name: 'rate_integration/step', timebase: 'h' },
      coverage: { ratio: '1', missingSeconds: 0 },
      exceptions: [],
    });
  });

  it('T26/T27 shapes: rollover is counted, a reset without modulus is unresolved with coverage', async () => {
    const counter = await env.preview('counter', 0, 12);
    expect(counter.result).toMatchObject({ quantity: '30', exceptions: [] });

    const reset = await env.preview('reset', 0, 10);
    expect(reset.result.quantity).toBeNull();
    expect(reset.result.exceptions.map((e) => e.code)).toEqual([
      'reset_unresolved',
    ]);
    expect(reset.result.coverage.ratio).toBe('0');
  });

  it('an archive correction read again is a second revision; the preview uses the latest', async () => {
    env.sim.streams.correct('PT-RATE', env.at(10), 240);
    await env.pi.runWindow(recordedJob);
    await env.pi.normalizeAll();

    const revisions = await env.rows<{ value: string }>(
      `SELECT value::text AS value FROM measurement_samples WHERE observed_at = $1 AND signal_id = $2 ORDER BY inserted_at`,
      [env.at(10), env.signals.rate],
    );
    expect(revisions.map((row) => Number(row.value))).toEqual([120, 240]);
    const body = await env.preview('rate', 0, 30);
    expect(body.result.quantity).toBe('70');
    expect(body.samples.find((s) => s.observedAt === env.at(10))).toMatchObject(
      {
        value: '240.00000000',
        revisions: 2,
      },
    );
  });

  it('summaries: a counter is refused (422), a rate with the confirmed timebase stores PI totals', async () => {
    const jobs = `connections/${env.pi.connectionId}/jobs`;
    const counterJob = await env
      .post(jobs, {
        scope: {
          mode: 'summary',
          signalIds: [env.signals.counter],
          totalTimebase: 'h',
        },
      })
      .expect(422);
    expect((counterJob.body as { code: string }).code).toBe(
      'INVALID_JOB_SCOPE',
    );
    await env
      .post(jobs, {
        scope: {
          mode: 'summary',
          signalIds: [env.signals.rate],
          totalTimebase: 'min',
        },
      })
      .expect(422);

    const job = await env.pi.startJob({
      mode: 'summary',
      signalIds: [env.signals.rate],
      totalTimebase: 'h',
      lookbackMinutes: 120,
    });
    expect(await env.pi.runPage(job)).toMatchObject({
      status: 'committed',
      accepted: 2,
    });
    await env.pi.normalizeAll();

    expect(
      await env.rows(
        `SELECT timebase, summary_type FROM signal_summaries WHERE signal_id = $1`,
        [env.signals.rate],
      ),
    ).toEqual([
      { timebase: 'h', summary_type: 'Total' },
      { timebase: 'h', summary_type: 'Total' },
    ]);
    const hour = Math.floor(Date.now() / (60 * MINUTE)) * 60 * MINUTE;
    const covered = await env
      .post(`signals/${env.signals.rate}/preview`, {
        from: new Date(hour - 120 * MINUTE).toISOString(),
        to: new Date(hour).toISOString(),
      })
      .expect(200);
    expect((covered.body as PreviewBody).piTotals).toHaveLength(2);
  });
});
