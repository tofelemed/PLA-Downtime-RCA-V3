import { createServer, Server } from 'http';
import type { NextFunction, Request, Response } from 'express';
import { collectDefaultMetrics, Gauge, Histogram, Registry } from 'prom-client';
import { DataSource } from 'typeorm';

/**
 * Prometheus metrics of the API process (perf audit P13): request latency per route template, the database
 * pool and the process defaults (CPU, memory, event-loop lag, GC). Served on `METRICS_PORT`, a port of its
 * own that the nginx front end does not route, so it is never public; unset = no metrics at all.
 */
export const metricsRegistry = new Registry();

const requestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration by method, route template and status code',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

/** Route template (`/api/v2/rcas/:id`), never the raw URL, so label values stay bounded. */
function routeOf(req: Request): string {
  const route: unknown = Reflect.get(req, 'route');
  const path: unknown =
    typeof route === 'object' && route !== null
      ? Reflect.get(route, 'path')
      : undefined;
  return typeof path === 'string' ? `${req.baseUrl}${path}` : 'unmatched';
}

/** Express middleware timing every request until its response is sent. */
export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const end = requestDuration.startTimer();
  res.on('finish', () =>
    end({
      method: req.method,
      route: routeOf(req),
      status: String(res.statusCode),
    }),
  );
  next();
}

interface PgPoolCounts {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
}

/** In-use, idle and waiting connections of the TypeORM pg pool, read at scrape time. */
export function registerPoolMetrics(dataSource: DataSource): void {
  new Gauge({
    name: 'db_pool_connections',
    help: 'Database pool connections by state (in_use, idle, waiting)',
    labelNames: ['state'] as const,
    registers: [metricsRegistry],
    collect() {
      const pool = (dataSource.driver as unknown as { master?: PgPoolCounts })
        .master;
      if (!pool) return;
      this.set({ state: 'in_use' }, pool.totalCount - pool.idleCount);
      this.set({ state: 'idle' }, pool.idleCount);
      this.set({ state: 'waiting' }, pool.waitingCount);
    },
  });
}

/** `METRICS_PORT` as a port number, or null (metrics off). */
export function metricsPort(
  env: NodeJS.ProcessEnv = process.env,
): number | null {
  const port = Number(env.METRICS_PORT);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : null;
}

/** Plain HTTP server answering `GET /metrics` with the registry (Prometheus text format). */
export function startMetricsServer(port: number): Server {
  collectDefaultMetrics({ register: metricsRegistry });
  const server = createServer((req, res) => {
    if (req.method !== 'GET' || req.url !== '/metrics') {
      res.writeHead(404).end();
      return;
    }
    metricsRegistry
      .metrics()
      .then((body) => {
        res.writeHead(200, { 'Content-Type': metricsRegistry.contentType });
        res.end(body);
      })
      .catch(() => res.writeHead(500).end());
  });
  return server.listen(port);
}
