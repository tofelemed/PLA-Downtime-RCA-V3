import { ShutdownCoordinator } from './shutdown-coordinator.service';

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('ShutdownCoordinator', () => {
  const originalTimeout = process.env.SHUTDOWN_DRAIN_TIMEOUT_MS;
  let coordinator: ShutdownCoordinator;

  beforeEach(() => {
    coordinator = new ShutdownCoordinator();
  });

  afterEach(() => {
    if (originalTimeout === undefined)
      delete process.env.SHUTDOWN_DRAIN_TIMEOUT_MS;
    else process.env.SHUTDOWN_DRAIN_TIMEOUT_MS = originalTimeout;
  });

  it('is not shutting down until the shutdown hook runs', async () => {
    expect(coordinator.isShuttingDown).toBe(false);
    await coordinator.beforeApplicationShutdown('SIGTERM');
    expect(coordinator.isShuttingDown).toBe(true);
  });

  it('tracks work until it settles, whether it resolves or rejects', async () => {
    const ok = deferred<string>();
    const failing = deferred<string>();
    const tracked = coordinator.track(ok.promise);
    void coordinator.track(failing.promise).catch(() => undefined);
    expect(coordinator.inFlightCount).toBe(2);

    ok.resolve('done');
    failing.reject(new Error('boom'));
    await expect(tracked).resolves.toBe('done');
    await flush();
    expect(coordinator.inFlightCount).toBe(0);
  });

  it('waits for in-flight work before letting shutdown continue', async () => {
    const job = deferred();
    void coordinator.track(job.promise);

    let drained = false;
    const shutdown = coordinator
      .beforeApplicationShutdown('SIGTERM')
      .then(() => {
        drained = true;
      });
    await flush();
    expect(coordinator.isShuttingDown).toBe(true);
    expect(drained).toBe(false);

    job.resolve();
    await shutdown;
    expect(drained).toBe(true);
    expect(coordinator.inFlightCount).toBe(0);
  });

  it('gives up after SHUTDOWN_DRAIN_TIMEOUT_MS when work never finishes', async () => {
    process.env.SHUTDOWN_DRAIN_TIMEOUT_MS = '20';
    void coordinator.track(new Promise(() => undefined));

    const startedAt = Date.now();
    await coordinator.beforeApplicationShutdown('SIGTERM');

    expect(Date.now() - startedAt).toBeLessThan(1000);
    expect(coordinator.inFlightCount).toBe(1);
  });
});
