import { MqttSubscriberWorld, waitFor } from './support/mqtt-subscriber-world';

/**
 * INT-03d (integration admin persona): a subscription whose job failed on a non-retryable CONNACK
 * (wrong password → NotAuthorized on the password listener of the Compose broker, host port 1885)
 * recovers once the connection is corrected: the host restarts the job (`failed → running`, audited
 * `config_changed`) because it failed at an older `config_version`. A job that failed at the current
 * version stays failed across sweeps (no retry storm) until an operator starts it.
 * Overrides: MQTT_TEST_AUTH_URL, MQTT_TEST_USERNAME / MQTT_TEST_PASSWORD (the read-only dev user).
 */
const AUTH_URL = process.env.MQTT_TEST_AUTH_URL ?? 'mqtt://localhost:1885';
const USERNAME = process.env.MQTT_TEST_USERNAME ?? 'proact-test';
const PASSWORD = process.env.MQTT_TEST_PASSWORD ?? 'proact-test-dev';
const WRONG_PASSWORD = `${PASSWORD}-wrong`;

describe('MQTT subscriber: a failed subscription recovers after the connection is corrected (INT-03d)', () => {
  const w = new MqttSubscriberWorld();
  let connection: string;
  const failedJob = () =>
    waitFor(
      async () => (await w.job(connection)).state === 'failed',
      'the subscribe job to fail on the CONNACK',
    );

  beforeAll(async () => {
    await w.start();
    connection = await w.createConnection(
      'Line 1 events (password)',
      w.eventsConfig({
        mqtt: {
          brokerUrl: AUTH_URL,
          username: USERNAME,
          connectTimeoutSeconds: 5,
        },
      }),
      WRONG_PASSWORD,
    );
  });

  afterAll(async () => {
    await w.stop();
  });

  it('a wrong password fails the job at config version 1 and later sweeps leave it failed', async () => {
    await w.host.reconcile();
    await failedJob();
    const job = await w.job(connection);
    expect(job.lease_owner).toBeNull();
    expect(job.health).toMatchObject({ connected: false, configVersion: 1 });
    expect(await w.jobActions(job.id)).toEqual(['create', 'start', 'failed']);
    const [row] = await w.rows<{ last_error: string }>(
      `SELECT last_error FROM ingestion_jobs WHERE id = $1`,
      [job.id],
    );
    expect(row.last_error).toContain('NotAuthorized');

    await w.host.reconcile();
    await w.host.reconcile();
    expect((await w.job(connection)).state).toBe('failed');
    expect(await w.jobActions(job.id)).toEqual(['create', 'start', 'failed']);
  });

  it('correcting the secret (config version 2) restarts the job: running and connected, audited config_changed', async () => {
    const patched = await w.patchConnection(connection, { secret: PASSWORD });
    expect(patched.configVersion).toBe(2);
    const job = await w.startSubscription(connection);
    expect(job).toMatchObject({ state: 'running' });
    expect(job.health).toMatchObject({
      connected: true,
      connectionError: null,
      configVersion: 2,
    });
    expect(await w.jobActions(job.id)).toEqual([
      'create',
      'start',
      'failed',
      'config_changed',
    ]);
    const [transition] = await w.rows<{ detail: Record<string, unknown> }>(
      `SELECT detail FROM ingestion_job_transitions WHERE job_id = $1 AND action = 'config_changed'`,
      [job.id],
    );
    expect(transition.detail).toEqual({
      failedConfigVersion: 1,
      configVersion: 2,
    });
  });

  it('a job that fails again at the current version stays failed until an operator starts it', async () => {
    const patched = await w.patchConnection(connection, {
      secret: WRONG_PASSWORD,
    });
    expect(patched.configVersion).toBe(3);
    await w.host.reconcile();
    await failedJob();
    const job = await w.job(connection);
    expect(job.health).toMatchObject({ configVersion: 3 });
    await w.host.reconcile();
    await w.host.reconcile();
    expect((await w.job(connection)).state).toBe('failed');
    expect(await w.jobActions(job.id)).toEqual([
      'create',
      'start',
      'failed',
      'config_changed',
      'failed',
    ]);
  });
});
