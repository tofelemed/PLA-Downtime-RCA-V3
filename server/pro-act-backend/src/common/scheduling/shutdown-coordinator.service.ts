import { BeforeApplicationShutdown, Injectable, Logger } from '@nestjs/common';

const DEFAULT_DRAIN_TIMEOUT_MS = 30_000;

/**
 * Graceful drain for background work (NFR07; ING02 "stop means finish or persist in-flight work").
 *
 * Long-running handlers register their promise with `track()`. After `enableShutdownHooks()`,
 * SIGTERM/SIGINT make Nest call `beforeApplicationShutdown` on every module before any
 * `onApplicationShutdown` hook, i.e. before @nestjs/schedule stops its cron jobs and before
 * TypeORM destroys the connection pool, so tracked work finishes while the database is still
 * reachable. `isShuttingDown` lets schedulers refuse to start new work during the drain window.
 *
 * Limitation: there is no cooperative cancellation. Work that outlives SHUTDOWN_DRAIN_TIMEOUT_MS
 * (default 30 s) is abandoned and the process keeps shutting down.
 */
@Injectable()
export class ShutdownCoordinator implements BeforeApplicationShutdown {
  private readonly logger = new Logger(ShutdownCoordinator.name);
  private readonly inFlight = new Set<Promise<unknown>>();
  private shuttingDown = false;

  get isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  get inFlightCount(): number {
    return this.inFlight.size;
  }

  /** Registers work that shutdown must wait for; returns the same promise so callers can await it. */
  track<T>(work: Promise<T>): Promise<T> {
    this.inFlight.add(work);
    const untrack = () => {
      this.inFlight.delete(work);
    };
    void work.then(untrack, untrack);
    return work;
  }

  async beforeApplicationShutdown(signal?: string): Promise<void> {
    this.shuttingDown = true;
    const pending = this.inFlight.size;
    const trigger = signal ?? 'Shutdown';
    if (pending === 0) {
      this.logger.log(`${trigger} received: no in-flight jobs, shutting down`);
      return;
    }

    const timeoutMs = drainTimeoutMs();
    this.logger.log(
      `${trigger} received: waiting up to ${timeoutMs} ms for ${pending} in-flight job(s)`,
    );
    const drained = await this.waitForInFlight(timeoutMs);
    if (drained) {
      this.logger.log('In-flight jobs finished, shutting down');
      return;
    }
    this.logger.warn(
      `Drain timeout after ${timeoutMs} ms: abandoning ${this.inFlight.size} job(s) still running`,
    );
  }

  private async waitForInFlight(timeoutMs: number): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    const timedOut = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs);
    });
    const settled = Promise.allSettled([...this.inFlight]).then(() => true);
    try {
      return await Promise.race([settled, timedOut]);
    } finally {
      clearTimeout(timer);
    }
  }
}

function drainTimeoutMs(): number {
  const parsed = Number.parseInt(
    process.env.SHUTDOWN_DRAIN_TIMEOUT_MS ?? '',
    10,
  );
  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : DEFAULT_DRAIN_TIMEOUT_MS;
}
