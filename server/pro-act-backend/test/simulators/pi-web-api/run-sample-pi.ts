import {
  PiWebApiSimulator,
  SIM_PASSWORD,
  SIM_USERNAME,
} from './pi-web-api-simulator';
import { SimRequest } from './sim-model';
import { SimAnswer } from './sim-routes';
import { SampleFeed } from './sample/sample-feed';
import {
  SAMPLE_ASSET_SERVER,
  SAMPLE_DATABASE,
  SAMPLE_ELEMENTS,
  SAMPLE_STREAMS,
} from './sample/sample-plant';

/**
 * Sample PI Web API for the Marun HDPE plant: a long-running server shaped like a real PI Web API
 * (`shape = piwebapi`) with days of history and a live feed, for connecting Pro-Act's Connectivity
 * console end to end without the plant PI server. Sample data only, never a real PI account.
 *
 *   npm run pi:sample            (from server/pro-act-backend)
 *
 * Environment (all optional):
 *   PI_SAMPLE_PORT          listen port (default 5460)
 *   PI_SAMPLE_BIND          listen address (default 0.0.0.0, so the Dockerised API can reach it)
 *   PI_SAMPLE_PUBLIC_HOST   host printed in the connection URL (default host.docker.internal)
 *   PI_SAMPLE_USERNAME / PI_SAMPLE_PASSWORD   the Basic account it accepts (default the simulator's)
 *   PI_SAMPLE_HISTORY_DAYS  days of closed history (default 3)
 *   PI_SAMPLE_TICK_SECONDS  live feed step (default 60)
 *
 * Control (same Basic account): GET /_sample/status · POST /_sample/tick ·
 * POST /_sample/frames/{webId}/delete · POST /_sample/frames/{webId}/attributes {"name","value"}.
 */
const env = (name: string, fallback: string) =>
  process.env[name]?.trim() || fallback;

async function main(): Promise<void> {
  const sim = new PiWebApiSimulator({
    shape: 'piwebapi',
    username: env('PI_SAMPLE_USERNAME', SIM_USERNAME),
    password: env('PI_SAMPLE_PASSWORD', SIM_PASSWORD),
  });
  Object.assign(sim.assetServer, SAMPLE_ASSET_SERVER);
  Object.assign(sim.database, SAMPLE_DATABASE);
  for (const element of SAMPLE_ELEMENTS) {
    sim.elements.set(element.webId, {
      WebId: element.webId,
      Path: element.path,
      TemplateName: element.template,
    });
  }
  const feed = new SampleFeed(sim);
  const seeded = feed.seedHistory(Number(env('PI_SAMPLE_HISTORY_DAYS', '3')));
  sim.control = (request, body) => control(sim, feed, request, body);
  await sim.start({
    port: Number(env('PI_SAMPLE_PORT', '5460')),
    bindHost: env('PI_SAMPLE_BIND', '0.0.0.0'),
    publicHost: env('PI_SAMPLE_PUBLIC_HOST', 'host.docker.internal'),
  });
  const tickMs = Number(env('PI_SAMPLE_TICK_SECONDS', '60')) * 1000;
  const timer = setInterval(() => log(feed.tick()), tickMs);
  log([
    `sample PI Web API on ${sim.baseUrl} (user ${env('PI_SAMPLE_USERNAME', SIM_USERNAME)})`,
    `asset server ${SAMPLE_ASSET_SERVER.Name} ${SAMPLE_ASSET_SERVER.WebId}, database ${SAMPLE_DATABASE.Name} ${SAMPLE_DATABASE.WebId}`,
    `history: ${seeded.frames} frames, ${seeded.values} values per stream; live tick every ${tickMs / 1000} s`,
    ...SAMPLE_ELEMENTS.map(
      (element) => `element ${element.webId} ${element.path}`,
    ),
    ...Object.values(SAMPLE_STREAMS).map(
      (stream) => `stream ${stream.webId} ${stream.name} (${stream.unit})`,
    ),
  ]);
  const stop = () => {
    clearInterval(timer);
    void sim.close().then(() => process.exit(0));
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

function control(
  sim: PiWebApiSimulator,
  feed: SampleFeed,
  request: SimRequest,
  body: unknown,
): SimAnswer | null {
  const [, , kind, id, action] = request.path
    .split('/')
    .map(decodeURIComponent);
  if (request.method === 'GET' && kind === 'status') {
    const frames = [...sim.frames.values()];
    const open = frames
      .filter((frame) => frame.EndTime.startsWith('9999'))
      .map((frame) => frame.WebId);
    return {
      status: 200,
      body: {
        frames: frames.length,
        open,
        latest: frames.map((frame) => frame.WebId).slice(-5),
      },
    };
  }
  if (request.method !== 'POST') return null;
  if (kind === 'tick') return { status: 200, body: { changes: feed.tick() } };
  if (kind !== 'frames' || !id || !sim.frames.has(id)) return null;
  if (action === 'delete') {
    sim.deleteFrame(id);
    log([`deleted frame ${id}`]);
    return { status: 200, body: { deleted: id } };
  }
  const change = body as { name?: unknown; value?: unknown } | null;
  if (action === 'attributes' && typeof change?.name === 'string') {
    sim.setAttribute(id, change.name, change.value);
    log([`frame ${id}: ${change.name} = ${JSON.stringify(change.value)}`]);
    return { status: 200, body: { updated: id } };
  }
  return null;
}

function log(lines: string[]): void {
  for (const line of lines)
    process.stdout.write(`[sample-pi ${new Date().toISOString()}] ${line}\n`);
}

void main();
