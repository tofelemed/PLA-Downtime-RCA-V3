import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';

/**
 * Starts the backend's PI Web API test simulator (`server/pro-act-backend/test/simulators/pi-web-api/
 * run-simulator.ts`, fake account, never a real PI server) as a child process for the UX06 specs.
 *
 * Where the API runs decides how it reaches the simulator, which always runs on the host:
 *   - API on the host (`npm run start:dev`, default): nothing to set; the simulator listens on an
 *     ephemeral 127.0.0.1 port and the connection URL is `http://127.0.0.1:<port>/piwebapi`.
 *   - API in Docker (`docker-compose.devdb.yml`): `E2E_PI_SIM_HOST=host.docker.internal`; the simulator
 *     then listens on all interfaces and the connection URL uses that host name.
 *   - `E2E_PI_SIM_BIND` overrides the listen address (default `0.0.0.0` when `E2E_PI_SIM_HOST` is a
 *     non-loopback name, else `127.0.0.1`).
 */
const BACKEND = join(process.cwd(), 'server', 'pro-act-backend');
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);

export interface PiSimulatorReady {
  baseUrl: string;
  username: string;
  password: string;
}

function simulatorHosts(): { bind: string; publicHost: string } {
  const publicHost = process.env.E2E_PI_SIM_HOST?.trim() || '127.0.0.1';
  const fallbackBind = LOOPBACK.has(publicHost) ? '127.0.0.1' : '0.0.0.0';
  return { bind: process.env.E2E_PI_SIM_BIND?.trim() || fallbackBind, publicHost };
}

export function startPiSimulator(scenario: unknown): Promise<{ child: ChildProcess; ready: PiSimulatorReady }> {
  const hosts = simulatorHosts();
  // one fixed command line (no user input); the scenario and hosts travel in the environment
  const child = spawn('npx ts-node -T test/simulators/pi-web-api/run-simulator.ts', {
    cwd: BACKEND,
    env: {
      ...process.env,
      PI_SIM_SCENARIO: JSON.stringify(scenario),
      PI_SIM_BIND_HOST: hosts.bind,
      PI_SIM_PUBLIC_HOST: hosts.publicHost,
    },
    shell: true,
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error(`simulator did not start: ${output}`)), 60_000);
    child.stdout?.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      const line = output.split('\n').find((entry) => entry.startsWith('READY '));
      if (!line) return;
      clearTimeout(timer);
      resolve({ child, ready: JSON.parse(line.slice('READY '.length)) as PiSimulatorReady });
    });
    child.on('exit', (code) => reject(new Error(`simulator exited (${code}): ${output}`)));
  });
}
