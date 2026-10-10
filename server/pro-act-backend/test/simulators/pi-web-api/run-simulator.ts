import {
  PiWebApiSimulator,
  SIM_PASSWORD,
  SIM_USERNAME,
} from './pi-web-api-simulator';
import { simFrame } from './sim-fixtures';

/**
 * Runs the PI Web API simulator as its own process for the frontend Playwright e2e (plan 3.7 UX06),
 * whose ESM test runner cannot load this CommonJS package in-process. Test-only: an ephemeral
 * 127.0.0.1 port, the simulator's fake credentials, fixture data from the scenario JSON in the
 * `PI_SIM_SCENARIO` environment variable (an argument would be mangled by Windows shell quoting).
 * Prints `READY {baseUrl, username, password}` (the simulator's fake account) once listening and
 * exits when stdin closes or on SIGTERM / SIGINT.
 *
 *   PI_SIM_SCENARIO='<scenario json>' npx ts-node -T test/simulators/pi-web-api/run-simulator.ts
 */
interface Scenario {
  elements: Array<{ path: string; webId: string }>;
  frames: Array<{
    webId: string;
    startMinutesAgo: number;
    /** null = still open */
    endMinutesAgo: number | null;
    template?: string;
    elementWebId?: string;
    attributes?: Record<string, unknown>;
  }>;
}

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

async function main(): Promise<void> {
  const scenario = JSON.parse(
    process.env.PI_SIM_SCENARIO ?? '{"elements":[],"frames":[]}',
  ) as Scenario;
  const sim = await new PiWebApiSimulator().start();
  const paths = new Map<string, string>();
  for (const element of scenario.elements) {
    paths.set(element.webId, element.path);
    sim.addElement(element.path, element.webId);
  }
  sim.addFrames(
    scenario.frames.map((frame) =>
      simFrame({
        webId: frame.webId,
        start: minutesAgo(frame.startMinutesAgo),
        end:
          frame.endMinutesAgo === null ? null : minutesAgo(frame.endMinutesAgo),
        template: frame.template,
        element: frame.elementWebId
          ? {
              WebId: frame.elementWebId,
              Path: paths.get(frame.elementWebId) ?? null,
            }
          : null,
        attributes: frame.attributes,
      }),
    ),
  );
  const stop = () => void sim.close().then(() => process.exit(0));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  process.stdin.on('end', stop);
  process.stdin.resume();
  const ready = {
    baseUrl: sim.baseUrl,
    username: SIM_USERNAME,
    password: SIM_PASSWORD,
  };
  process.stdout.write(`READY ${JSON.stringify(ready)}\n`);
}

void main();
