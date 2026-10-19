import { promises as dns } from 'dns';
import * as tls from 'tls';
import { isIP } from 'net';
import { withTimeout } from '../../common/helpers/time-bounds';
import { PiHttpClient, PiRequestError } from './pi-http-client';
import { plural } from '../../common/helpers/plural';

export type CheckStatus = 'ok' | 'failed' | 'skipped' | 'not_applicable';

export interface DiagnosticCheck {
  status: CheckStatus;
  detail?: string;
}

/** PI01: each layer tested on its own, in order; after the first failure the rest are skipped. */
export interface PiDiagnostics {
  dns: DiagnosticCheck;
  tls: DiagnosticCheck;
  auth: DiagnosticCheck;
  version: DiagnosticCheck;
  authz: DiagnosticCheck;
  read: DiagnosticCheck;
}

export interface DiagnosisResult {
  diagnostics: PiDiagnostics;
  /** detected at test time; `batch` is undefined when it could not be decided */
  capabilities: { batch?: boolean };
}

type Step = keyof PiDiagnostics;
const STEPS: readonly Step[] = [
  'dns',
  'tls',
  'auth',
  'version',
  'authz',
  'read',
];
const STEP_TIMEOUT_MS = 10_000;

/** Runs the PI01 checks against the connection's endpoint and detects the batch controller. */
export async function diagnosePiEndpoint(
  client: PiHttpClient,
  verifyTls: boolean,
): Promise<DiagnosisResult> {
  const url = new URL(client.apiBase);
  const checks: Record<Step, () => Promise<DiagnosticCheck>> = {
    dns: () => checkDns(url),
    tls: () => checkTls(url, verifyTls),
    auth: () =>
      viaClient(
        () => client.get(''),
        () => 'credentials accepted',
      ),
    version: () => viaClient(() => client.get('system'), versionOf),
    authz: () =>
      viaClient(
        () => client.get('assetservers'),
        (reply) => {
          return `${plural(itemsOf(reply).length, 'asset server', 'asset servers')} visible`;
        },
      ),
    read: () => checkRead(client),
  };
  const diagnostics = {} as PiDiagnostics;
  let failed = false;
  for (const step of STEPS) {
    diagnostics[step] = failed ? { status: 'skipped' } : await checks[step]();
    failed = failed || diagnostics[step].status === 'failed';
  }
  return {
    diagnostics,
    capabilities: failed ? {} : { batch: await detectBatch(client) },
  };
}

/** The first failed step as a message, or success. */
export function diagnosisMessage(diagnostics: PiDiagnostics): string {
  const failed = STEPS.find((step) => diagnostics[step].status === 'failed');
  if (!failed) return 'All PI Web API checks passed';
  return `${failed} check failed: ${diagnostics[failed].detail ?? 'no detail'}`;
}

async function checkDns(url: URL): Promise<DiagnosticCheck> {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) return { status: 'ok', detail: `${host} (literal address)` };
  try {
    const found = await withTimeout(dns.lookup(host), STEP_TIMEOUT_MS, 'dns');
    return { status: 'ok', detail: `${host} → ${found.address}` };
  } catch (error) {
    return { status: 'failed', detail: describe(error) };
  }
}

function checkTls(url: URL, verifyTls: boolean): Promise<DiagnosticCheck> {
  if (url.protocol !== 'https:') {
    return Promise.resolve({ status: 'not_applicable', detail: 'plain http' });
  }
  const host = url.hostname;
  return withTimeout(
    new Promise<DiagnosticCheck>((resolve) => {
      const socket = tls.connect({
        host,
        port: Number(url.port || 443),
        servername: isIP(host) ? undefined : host,
        rejectUnauthorized: verifyTls,
      });
      socket.once('secureConnect', () => {
        const detail = `${socket.getProtocol() ?? 'tls'}${verifyTls ? '' : ' (verification disabled)'}`;
        socket.end();
        resolve({ status: 'ok', detail });
      });
      socket.once('error', (error) =>
        resolve({ status: 'failed', detail: describe(error) }),
      );
    }),
    STEP_TIMEOUT_MS,
    'tls',
  ).catch((error: unknown) => ({ status: 'failed', detail: describe(error) }));
}

async function viaClient(
  call: () => Promise<unknown>,
  detail: (reply: unknown) => string,
): Promise<DiagnosticCheck> {
  try {
    return { status: 'ok', detail: detail(await call()) };
  } catch (error) {
    return { status: 'failed', detail: describe(error) };
  }
}

async function checkRead(client: PiHttpClient): Promise<DiagnosticCheck> {
  try {
    const servers = itemsOf(await client.get('assetservers'));
    const first = servers[0] as { WebId?: unknown } | undefined;
    if (typeof first?.WebId !== 'string') {
      return { status: 'failed', detail: 'no asset server is visible' };
    }
    const databases = itemsOf(
      await client.get(
        `assetservers/${encodeURIComponent(first.WebId)}/assetdatabases`,
      ),
    );
    return {
      status: 'ok',
      detail: plural(databases.length, 'AF database', 'AF databases'),
    };
  } catch (error) {
    return { status: 'failed', detail: describe(error) };
  }
}

async function detectBatch(client: PiHttpClient): Promise<boolean | undefined> {
  try {
    await client.post('batch', {});
    return true;
  } catch (error) {
    const missing =
      error instanceof PiRequestError &&
      (error.kind === 'unsupported' || error.kind === 'not_found');
    return missing ? false : undefined;
  }
}

function versionOf(reply: unknown): string {
  const version = (reply as { ProductVersion?: unknown } | null)
    ?.ProductVersion;
  return typeof version === 'string' ? `PI Web API ${version}` : 'unknown';
}

function itemsOf(reply: unknown): unknown[] {
  const items = (reply as { Items?: unknown } | null)?.Items;
  return Array.isArray(items) ? items : [];
}

function describe(error: unknown): string {
  if (error instanceof PiRequestError) return `${error.code}: ${error.message}`;
  const code = (error as { code?: unknown })?.code;
  const message = error instanceof Error ? error.message : String(error);
  return typeof code === 'string' ? `${code}: ${message}` : message;
}
