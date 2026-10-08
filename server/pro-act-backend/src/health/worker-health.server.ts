import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { DataSource } from 'typeorm';
import { ShutdownCoordinator } from '../common/scheduling/shutdown-coordinator.service';

const DEFAULT_WORKER_PORT = 4005;

/**
 * Liveness/readiness probes for the worker process. The worker is a Nest application context
 * (no Express, no routed controllers), so a bare Node http server keeps its HTTP surface to
 * exactly GET /health/live and GET /health/ready on WORKER_PORT for Compose/Kubernetes checks.
 * Readiness turns 503 as soon as a shutdown starts so traffic managers stop counting on it.
 */
@Injectable()
export class WorkerHealthServer
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(WorkerHealthServer.name);
  private server?: Server;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly shutdown: ShutdownCoordinator,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const port = workerPort();
    const server = createServer((req, res) => void this.handle(req, res));
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, () => resolve());
    });
    this.server = server;
    this.logger.log(
      `Worker health probes on http://localhost:${port}/health/live and /health/ready`,
    );
  }

  async onApplicationShutdown(): Promise<void> {
    const server = this.server;
    if (!server) return;
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  }

  private async handle(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const path = (req.url ?? '').split('?')[0];
    if (req.method !== 'GET')
      return sendJson(res, 405, { status: 'method_not_allowed' });
    if (path === '/health/live')
      return sendJson(res, 200, { status: 'ok', role: 'worker' });
    if (path === '/health/ready') return this.ready(res);
    sendJson(res, 404, { status: 'not_found' });
  }

  private async ready(res: ServerResponse): Promise<void> {
    if (this.shutdown.isShuttingDown) {
      return sendJson(res, 503, {
        status: 'draining',
        inFlightJobs: this.shutdown.inFlightCount,
      });
    }
    const databaseUp = await this.dataSource.query('SELECT 1').then(
      () => true,
      () => false,
    );
    sendJson(res, databaseUp ? 200 : 503, {
      status: databaseUp ? 'ready' : 'unavailable',
      database: databaseUp ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    });
  }
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  body: Record<string, unknown>,
): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function workerPort(): number {
  const parsed = Number.parseInt(process.env.WORKER_PORT ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_WORKER_PORT;
}
