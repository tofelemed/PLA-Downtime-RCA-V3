import * as http from 'http';
import { AddressInfo } from 'net';
import {
  OPEN_SENTINEL,
  pathKey,
  SimElement,
  SimFailure,
  SimFrame,
  SimRequest,
  SimShape,
} from './sim-model';
import { routeGet, SimAnswer, SimState } from './sim-routes';
import { SimStreams } from './sim-streams';

/** Test-only credentials of the simulator (never a real account). */
export const SIM_USERNAME = 'sim-reader';
export const SIM_PASSWORD = 'sim-only-password';

export interface SimListenOptions {
  /** address to listen on; default `127.0.0.1` */
  bindHost?: string;
  /** host name advertised in `baseUrl`; default the bind address (loopback for `0.0.0.0`) */
  publicHost?: string;
  /** fixed port; default an ephemeral one */
  port?: number;
}

/** Simulator options: the response shape and the Basic account it accepts. */
export interface SimOptions {
  shape?: SimShape;
  username?: string;
  password?: string;
}

export interface LoggedRequest {
  method: string;
  path: string;
  query: string;
}

/**
 * In-process PI Web API simulator (plan 1.6, phase 1 shared artifact) on an ephemeral port: event
 * frame search with `searchMode=Overlapped` and `startIndex` paging, frames by WebId, `streamsets`
 * attribute values (digital states as `{ Name, Value, IsSystem }`), elements by path (mixed
 * separators) or WebId, `/system`, asset servers/databases and the `/batch` controller. Basic auth is
 * enforced and can be revoked; failures can be injected per request; frames can be closed, changed and
 * deleted between reads. Fixture data lives in the tests, never in product code.
 */
export class PiWebApiSimulator {
  readonly frames = new Map<string, SimFrame>();
  readonly elements = new Map<string, SimElement>();
  readonly requests: LoggedRequest[] = [];
  /** recorded values, summaries and stream updates (plan 1.7) */
  readonly streams = new SimStreams();
  authRevoked = false;
  batchSupported = true;
  /** optional handler of `/_sample/*` control requests (the runnable sample server) */
  control: ((request: SimRequest, body: unknown) => SimAnswer | null) | null =
    null;
  private failures: SimFailure[] = [];
  private server: http.Server | null = null;
  origin = '';

  readonly assetServer = { Name: 'SIM-AF', WebId: 'AS-SIM' };
  readonly database = { Name: 'HDPE', WebId: 'DB-HDPE' };
  readonly shape: SimShape;
  private readonly expectedAuth: string;

  constructor(options: SimOptions = {}) {
    this.shape = options.shape ?? 'compact';
    const account = `${options.username ?? SIM_USERNAME}:${options.password ?? SIM_PASSWORD}`;
    this.expectedAuth = `Basic ${Buffer.from(account).toString('base64')}`;
  }

  /** `<origin>/piwebapi`, as a connection stores it */
  get baseUrl(): string {
    return `${this.origin}/piwebapi`;
  }

  /**
   * Listens on an ephemeral port of `bindHost` (default loopback). `publicHost` is the host name put in
   * `origin` / `baseUrl` (default `bindHost`, or loopback when binding all interfaces): a containerised
   * API reaches a host-run simulator bound to `0.0.0.0` as `host.docker.internal`.
   */
  async start(options: SimListenOptions = {}): Promise<this> {
    const bindHost = options.bindHost ?? '127.0.0.1';
    const publicHost =
      options.publicHost ?? (bindHost === '0.0.0.0' ? '127.0.0.1' : bindHost);
    this.server = http.createServer((req, res) => void this.handle(req, res));
    await new Promise<void>((resolve) =>
      this.server!.listen(options.port ?? 0, bindHost, resolve),
    );
    const { port } = this.server.address() as AddressInfo;
    this.origin = `http://${publicHost}:${port}`;
    return this;
  }

  close(): Promise<void> {
    const server = this.server;
    if (!server) return Promise.resolve();
    return new Promise((resolve, reject) => {
      server.closeAllConnections();
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  addFrames(frames: SimFrame[]): void {
    for (const frame of frames) this.frames.set(frame.WebId, frame);
  }

  /** Registers an AF element and returns its WebId. */
  addElement(path: string, webId = `EL-${pathKey(path)}`): string {
    this.elements.set(webId, { WebId: webId, Path: path });
    return webId;
  }

  closeFrame(webId: string, endTime: string): void {
    this.mustGet(webId).EndTime = endTime;
  }

  setAttribute(webId: string, name: string, value: unknown): void {
    this.mustGet(webId).attributes[name] = value;
  }

  deleteFrame(webId: string): void {
    this.frames.delete(webId);
  }

  /** The next `times` requests matching `match` are answered with `status`. */
  fail(match: SimFailure['match'], status: number, times = 1): void {
    this.failures.push({ match, status, remaining: times });
  }

  clearFailures(): void {
    this.failures = [];
  }

  countRequests(predicate: (request: LoggedRequest) => boolean): number {
    return this.requests.filter(predicate).length;
  }

  private mustGet(webId: string): SimFrame {
    const frame = this.frames.get(webId);
    if (!frame) throw new Error(`simulator has no frame ${webId}`);
    return frame;
  }

  private async handle(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const url = new URL(req.url ?? '/', this.origin);
    const request: SimRequest = {
      method: req.method ?? 'GET',
      path: url.pathname.replace(/^\/piwebapi\/?/i, '/'),
      query: url.searchParams,
    };
    this.requests.push({
      method: request.method,
      path: request.path,
      query: url.search,
    });
    const body = request.method === 'POST' ? await readBody(req) : null;
    send(res, this.answer(req.headers.authorization, request, body));
  }

  private answer(
    authorization: string | undefined,
    request: SimRequest,
    body: unknown,
  ): SimAnswer {
    if (!this.authorized(authorization)) {
      return {
        status: 401,
        body: { Errors: ['Unauthorized'] },
        headers: { 'WWW-Authenticate': 'Basic realm="PI Web API"' },
      };
    }
    if (this.control && request.path.startsWith('/_sample')) {
      return (
        this.control(request, body) ?? {
          status: 404,
          body: { Errors: ['unknown control request'] },
        }
      );
    }
    const injected = this.injected(request);
    if (injected) return injected;
    const parts = request.path
      .split('/')
      .filter(Boolean)
      .map(decodeURIComponent);
    if (request.method === 'GET') {
      return (
        this.streams.routeGet(request, parts) ?? routeGet(this.state(), request)
      );
    }
    if (request.method === 'POST' && request.path === '/batch') {
      return this.batch(body);
    }
    const streamPost =
      request.method === 'POST' ? this.streams.routePost(parts) : null;
    if (streamPost) return streamPost;
    return { status: 405, body: { Errors: ['Method not allowed'] } };
  }

  private authorized(header: string | undefined): boolean {
    return !this.authRevoked && header === this.expectedAuth;
  }

  private injected(request: SimRequest): SimAnswer | null {
    const failure = this.failures.find(
      (candidate) => candidate.remaining > 0 && candidate.match(request),
    );
    if (!failure) return null;
    failure.remaining -= 1;
    return { status: failure.status, body: { Errors: ['injected failure'] } };
  }

  /** `POST /batch`: each sub-request is a GET routed like a direct call. */
  private batch(body: unknown): SimAnswer {
    if (!this.batchSupported) {
      return { status: 404, body: { Errors: ['No batch controller'] } };
    }
    const requests = (body ?? {}) as Record<string, { Resource?: string }>;
    const answers: Record<string, unknown> = {};
    for (const [key, sub] of Object.entries(requests)) {
      const url = new URL(sub.Resource ?? '/', this.origin);
      const routed = routeGet(this.state(), {
        method: 'GET',
        path: url.pathname.replace(/^\/piwebapi\/?/i, '/'),
        query: url.searchParams,
      });
      answers[key] = {
        Status: routed.status,
        Headers: {},
        Content: routed.body,
      };
    }
    return { status: 207, body: answers };
  }

  private state(): SimState {
    return {
      frames: this.frames,
      elements: this.elements,
      assetServer: this.assetServer,
      database: this.database,
      shape: this.shape,
      origin: this.origin,
    };
  }
}

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      try {
        resolve(text ? JSON.parse(text) : null);
      } catch {
        resolve(null);
      }
    });
  });
}

function send(res: http.ServerResponse, answer: SimAnswer): void {
  res.writeHead(answer.status, {
    'Content-Type': 'application/json',
    ...(answer.headers ?? {}),
  });
  res.end(JSON.stringify(answer.body));
}

export { OPEN_SENTINEL };
