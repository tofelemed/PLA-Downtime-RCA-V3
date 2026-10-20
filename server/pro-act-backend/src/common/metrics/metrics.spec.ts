import { AddressInfo } from 'net';
import * as express from 'express';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import {
  metricsMiddleware,
  metricsPort,
  metricsRegistry,
  registerPoolMetrics,
  startMetricsServer,
} from './metrics';

describe('Prometheus metrics (perf audit P13)', () => {
  it('times requests by route template, never the raw URL', async () => {
    const app = express();
    app.use(metricsMiddleware);
    app.get('/api/v2/rcas/:id', (_req, res) => {
      res.json({ ok: true });
    });
    await request(app).get('/api/v2/rcas/123').expect(200);
    await request(app).get('/nowhere').expect(404);
    const text = await metricsRegistry.getSingleMetricAsString(
      'http_request_duration_seconds',
    );
    expect(text).toContain('route="/api/v2/rcas/:id",status="200"');
    expect(text).toContain('route="unmatched",status="404"');
    expect(text).not.toContain('/api/v2/rcas/123');
  });

  it('reads the pool counts at scrape time', async () => {
    const pool = { totalCount: 10, idleCount: 3, waitingCount: 2 };
    registerPoolMetrics({ driver: { master: pool } } as unknown as DataSource);
    const text = await metricsRegistry.getSingleMetricAsString(
      'db_pool_connections',
    );
    expect(text).toContain('db_pool_connections{state="in_use"} 7');
    expect(text).toContain('db_pool_connections{state="idle"} 3');
    expect(text).toContain('db_pool_connections{state="waiting"} 2');
  });

  it('is off without a valid METRICS_PORT', () => {
    expect(metricsPort({})).toBeNull();
    expect(metricsPort({ METRICS_PORT: 'x' })).toBeNull();
    expect(metricsPort({ METRICS_PORT: '9464' })).toBe(9464);
  });

  it('serves GET /metrics in Prometheus text format and nothing else', async () => {
    const server = startMetricsServer(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address() as AddressInfo;
    try {
      const ok = await fetch(`http://127.0.0.1:${port}/metrics`);
      expect(ok.status).toBe(200);
      expect(await ok.text()).toContain('process_cpu_user_seconds_total');
      expect((await fetch(`http://127.0.0.1:${port}/other`)).status).toBe(404);
    } finally {
      server.close();
    }
  });
});
