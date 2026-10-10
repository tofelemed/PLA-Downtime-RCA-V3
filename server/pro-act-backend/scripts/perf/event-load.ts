/**
 * Event command / read latency under concurrent load (plan 3.11 step 5; ENGINEERING_STANDARDS "Measure").
 *
 *   npx ts-node scripts/perf/event-load.ts --base http://localhost:4014/api \
 *     --email manager@acme.com --password demo123 --unit <unitId> [--events 200] [--concurrency 20] [--reads 400]
 *
 * Creates `--events` open events on one unit (v2, idempotent), reads each (ETag), closes them all with
 * `--concurrency` parallel callers (POST /close with If-Match), then runs `--reads` first-page list reads, and
 * prints p50 / p95 / p99 / max per phase as JSON. Point it at a disposable database: it writes events.
 */
import { randomUUID } from 'crypto';

interface Options {
  base: string;
  email: string;
  password: string;
  unit: string;
  tenant?: string;
  events: number;
  concurrency: number;
  reads: number;
}

interface PhaseResult {
  phase: string;
  count: number;
  errors: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  throughputPerSecond: number;
}

function parseArgs(argv: string[]): Options {
  const value = (name: string): string | undefined => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const required = (name: string): string => {
    const found = value(name);
    if (!found) throw new Error(`--${name} is required`);
    return found;
  };
  return {
    base: required('base').replace(/\/+$/, ''),
    email: required('email'),
    password: required('password'),
    unit: required('unit'),
    tenant: value('tenant'),
    events: Number(value('events') ?? 200),
    concurrency: Number(value('concurrency') ?? 20),
    reads: Number(value('reads') ?? 400),
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1,
  );
  return Math.round(sorted[Math.max(0, index)] * 10) / 10;
}

async function timed<T>(work: () => Promise<T>): Promise<[number, T]> {
  const started = performance.now();
  const result = await work();
  return [performance.now() - started, result];
}

/** Runs `tasks` with at most `concurrency` in flight; returns per-task durations and failures. */
async function runPool(
  phase: string,
  tasks: Array<() => Promise<boolean>>,
  concurrency: number,
): Promise<PhaseResult> {
  const durations: number[] = [];
  let errors = 0;
  let next = 0;
  const started = performance.now();
  const worker = async (): Promise<void> => {
    while (next < tasks.length) {
      const task = tasks[next++];
      const [ms, ok] = await timed(task);
      durations.push(ms);
      if (!ok) errors += 1;
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, worker),
  );
  const elapsed = (performance.now() - started) / 1000;
  const sorted = [...durations].sort((a, b) => a - b);
  return {
    phase,
    count: tasks.length,
    errors,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: percentile(sorted, 100),
    throughputPerSecond: Math.round((tasks.length / elapsed) * 10) / 10,
  };
}

class Client {
  constructor(
    private readonly options: Options,
    private token: string,
  ) {}

  static async login(options: Options): Promise<Client> {
    const response = await fetch(`${options.base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: options.email,
        password: options.password,
      }),
    });
    if (!response.ok) throw new Error(`login failed: ${response.status}`);
    const body = (await response.json()) as { access_token: string };
    return new Client(options, body.access_token);
  }

  async call(
    method: string,
    path: string,
    init: { body?: unknown; headers?: Record<string, string> } = {},
  ) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      ...(this.options.tenant ? { 'X-Tenant-Id': this.options.tenant } : {}),
      ...(init.body === undefined
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...init.headers,
    };
    return fetch(`${this.options.base}${path}`, {
      method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  }
}

async function createOpenEvent(
  client: Client,
  unitId: string,
  index: number,
): Promise<string | null> {
  const start = new Date(Date.now() - (index + 2) * 60_000).toISOString();
  const response = await client.call('POST', '/v2/production-events', {
    headers: { 'Idempotency-Key': randomUUID() },
    body: {
      unitId,
      eventType: 'ProductionLoss',
      startTime: start,
      description: `load ${index}`,
    },
  });
  if (!response.ok) return null;
  return ((await response.json()) as { id: string }).id;
}

async function readEtag(
  client: Client,
  id: string,
  etags: Map<string, string>,
): Promise<boolean> {
  const current = await client.call('GET', `/v2/production-events/${id}`);
  if (!current.ok) return false;
  etags.set(id, current.headers.get('etag') ?? '');
  return true;
}

async function closeEvent(
  client: Client,
  id: string,
  etag: string,
): Promise<boolean> {
  const response = await client.call(
    'POST',
    `/v2/production-events/${id}/close`,
    {
      headers: { 'Idempotency-Key': randomUUID(), 'If-Match': etag },
      body: {
        endTime: new Date(Date.now() - 1000).toISOString(),
        reason: 'load test close',
      },
    },
  );
  return response.ok;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const client = await Client.login(options);
  const ids: string[] = [];
  const creates = Array.from(
    { length: options.events },
    (_, index) => async () => {
      const id = await createOpenEvent(client, options.unit, index);
      if (id) ids.push(id);
      return id !== null;
    },
  );
  const results: PhaseResult[] = [
    await runPool('create (open event)', creates, options.concurrency),
  ];
  const etags = new Map<string, string>();
  const gets = ids.map((id) => () => readEtag(client, id, etags));
  results.push(await runPool('get event by id', gets, options.concurrency));
  const closes = ids.map(
    (id) => () => closeEvent(client, id, etags.get(id) ?? ''),
  );
  results.push(
    await runPool('close (POST /close)', closes, options.concurrency),
  );
  const reads = Array.from(
    { length: options.reads },
    () => async () =>
      (
        await client.call(
          'GET',
          `/v2/production-events?limit=100&unitIds=${options.unit}`,
        )
      ).ok,
  );
  results.push(
    await runPool(
      'event list first page (limit 100)',
      reads,
      options.concurrency,
    ),
  );
  process.stdout.write(
    `${JSON.stringify({ options: { ...options, password: '***' }, results }, null, 2)}\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
