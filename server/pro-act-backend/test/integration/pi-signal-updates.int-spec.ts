import { IntakeService } from '../../src/intake/intake.service';
import { piSampleEnvelope } from '../../src/integration/pi/pi-signal-envelope';
import { countRows } from './support/intake-fixtures';
import { PiSignalWorld } from './support/pi-signal-world';
import { bearer } from './support/test-app';

/**
 * Plan 1.7 steps 4–6 against the PI Web API simulator: stream updates with marker loss and a bounded
 * backfill, capability gating, user backfill runs (202 + draining job) and quarantine of measurements
 * for unknown signals or in a foreign unit.
 */
describe('PI actuals: stream updates, backfill, quarantine (plan 1.7)', () => {
  const env = new PiSignalWorld();
  const rate = (minute: number, value: number) => ({
    Timestamp: env.at(minute),
    Value: value,
    UnitsAbbreviation: 't/h',
    Good: true,
  });

  beforeAll(() => env.start());
  afterAll(() => env.stop());

  it('stream updates: register, read events, re-register after a lost marker with a bounded backfill', async () => {
    const job = await env.pi.startJob({
      mode: 'updates',
      signalIds: [env.signals.rate],
    });
    expect(await env.pi.runPage(job)).toMatchObject({
      status: 'committed',
      accepted: 0,
    });
    env.sim.streams.add('PT-RATE', [rate(35, 100)]);
    expect(await env.pi.runPage(job)).toMatchObject({
      status: 'committed',
      accepted: 1,
    });

    env.sim.streams.dropMarkers();
    env.sim.streams.add('PT-RATE', [rate(36, 90)]);
    expect(await env.pi.runPage(job)).toMatchObject({
      status: 'committed',
      accepted: 2,
    });
    await env.pi.normalizeAll();

    expect(
      await env.rows(
        `SELECT reason, state, detail FROM signal_backfill_runs WHERE signal_id = $1`,
        [env.signals.rate],
      ),
    ).toEqual([
      {
        reason: 'marker_lost',
        state: 'completed',
        detail: expect.objectContaining({ truncated: false }),
      },
    ]);
    expect(
      await countRows(
        env.harness.dataSource,
        'measurement_samples',
        'observed_at = ANY($1)',
        [[env.at(35), env.at(36)]],
      ),
    ).toBe(2);
  });

  it('stream updates are capability-gated: a server without them fails the job and later jobs are 422', async () => {
    env.sim.streams.updatesSupported = false;
    const job = await env.pi.startJob({
      mode: 'updates',
      signalIds: [env.signals.counter],
    });
    expect(await env.pi.runPage(job)).toMatchObject({
      status: 'failed',
      state: 'failed',
    });
    const refused = await env
      .post(`connections/${env.pi.connectionId}/jobs`, {
        scope: { mode: 'updates', signalIds: [env.signals.reset] },
      })
      .expect(422);
    expect((refused.body as { code: string }).code).toBe('INVALID_JOB_SCOPE');
  });

  it('backfill: 202 with a run that a draining job completes', async () => {
    const accepted = await env
      .post(`signals/${env.signals.reset}/backfill`, {
        from: env.at(-30),
        to: env.at(20),
      })
      .expect(202);
    const { statusUrl } = accepted.body as { statusUrl: string };
    const status = async () =>
      (await env.http().get(statusUrl).set(bearer(env.admin)).expect(200))
        .body as {
        state: string;
        ingestionJobId: string;
      };
    const queued = await status();
    expect(queued.state).toBe('queued');

    await env.pi.runWindow(queued.ingestionJobId);
    await env.pi.normalizeAll();

    expect((await status()).state).toBe('completed');
    expect((await env.pi.job(queued.ingestionJobId)).state).toBe('stopped');
    expect(
      await countRows(
        env.harness.dataSource,
        'measurement_samples',
        'signal_id = $1',
        [env.signals.reset],
      ),
    ).toBe(2);
  });

  it('quarantines measurements of unknown signals and foreign units', async () => {
    const intake = env.app.get(IntakeService);
    const binding = {
      tenantId: env.world.tenantA,
      connectionId: env.pi.connectionId,
    };
    for (const [webId, unit] of [
      ['PT-UNBOUND', 't'],
      ['PT-RATE', 'kg/h'],
    ]) {
      await intake.accept(
        binding,
        piSampleEnvelope(
          binding,
          {
            Timestamp: env.at(50),
            Value: 1,
            UnitsAbbreviation: unit,
            Good: true,
          },
          { webId, at: new Date(), correlationId: 'test' },
        ),
      );
    }
    await env.pi.normalizeAll();

    const codes = await env.rows<{ error_code: string }>(
      `SELECT error_code FROM ingestion_exceptions WHERE tenant_id = $1 ORDER BY error_code`,
      [env.world.tenantA],
    );
    expect(codes.map((row) => row.error_code)).toEqual([
      'unit_conflict',
      'unknown_signal',
    ]);
  });
});
