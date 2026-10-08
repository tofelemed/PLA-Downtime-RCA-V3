import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import * as https from 'https';
import { AdapterError } from '../../intake/adapters/adapter-error';

/** How a PI Web API call failed (drives retry and the job health code). */
export type PiFailureKind =
  | 'auth'
  | 'forbidden'
  | 'not_found'
  | 'unsupported'
  | 'rejected'
  | 'unavailable'
  | 'network'
  | 'tls'
  | 'too_large';

const FAILURES: Readonly<
  Record<PiFailureKind, { code: string; retryable: boolean; health: string }>
> = {
  auth: { code: 'PI_AUTH_FAILED', retryable: false, health: 'auth_failed' },
  forbidden: { code: 'PI_FORBIDDEN', retryable: false, health: 'authz_failed' },
  not_found: { code: 'PI_NOT_FOUND', retryable: false, health: 'not_found' },
  unsupported: {
    code: 'PI_UNSUPPORTED',
    retryable: false,
    health: 'unsupported',
  },
  rejected: {
    code: 'PI_REQUEST_REJECTED',
    retryable: false,
    health: 'request_rejected',
  },
  unavailable: {
    code: 'PI_UNAVAILABLE',
    retryable: true,
    health: 'source_unavailable',
  },
  network: { code: 'PI_UNREACHABLE', retryable: true, health: 'unreachable' },
  tls: { code: 'PI_TLS_FAILED', retryable: false, health: 'tls_failed' },
  too_large: {
    code: 'PI_RESPONSE_TOO_LARGE',
    retryable: false,
    health: 'response_too_large',
  },
};

/** A classified PI Web API failure (an `AdapterError`, so the job runner can act on it). */
export class PiRequestError extends AdapterError {
  constructor(
    message: string,
    readonly kind: PiFailureKind,
    readonly status: number | null = null,
  ) {
    super(
      message,
      FAILURES[kind].code,
      FAILURES[kind].retryable,
      FAILURES[kind].health,
    );
    this.name = 'PiRequestError';
  }
}

/** Everything one connection's client needs; secrets are passed in, never logged. */
export interface PiHttpSettings {
  /** `<origin>/piwebapi` */
  apiBase: string;
  username: string | null;
  password: string | null;
  verifyTls: boolean;
  timeoutMs: number;
  maxAttempts: number;
  retryBaseMs: number;
  maxResponseBytes: number;
}

const RETRY_CAP_MS = 10_000;
const RETRY_AFTER_CAP_MS = 60_000;
const TLS_ERROR = /CERT|SELF_SIGNED|UNABLE_TO_VERIFY|TLS|SSL/i;

/**
 * PI Web API client of one connection (PI01, §4.2, NFR07): TLS verification on unless the connection
 * opts out, a timeout on every call, retries with full-jitter exponential backoff for unavailable and
 * unreachable answers (`Retry-After` honoured), no redirects, a bounded response size. Failures are
 * classified (`PiRequestError`): 401 → auth, 403 → forbidden, 404 → not found, 405/501 → unsupported.
 */
export class PiHttpClient {
  private readonly agent: https.Agent;

  constructor(private readonly settings: PiHttpSettings) {
    this.agent = new https.Agent({ rejectUnauthorized: settings.verifyTls });
  }

  get apiBase(): string {
    return this.settings.apiBase;
  }

  /** Absolute URL of a path under the PI Web API root. */
  url(path: string): string {
    return `${this.settings.apiBase}/${path.replace(/^\/+/, '')}`;
  }

  get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
    return this.send<T>({ method: 'GET', url: this.url(path), params });
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.send<T>({ method: 'POST', url: this.url(path), data: body });
  }

  private async send<T>(request: AxiosRequestConfig): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const outcome = await this.attempt(request);
      if (!(outcome instanceof PiRequestError)) return outcome.data as T;
      const last = attempt + 1 >= this.settings.maxAttempts;
      if (!outcome.retryable || last) throw outcome;
      await sleep(
        retryDelayMs(attempt, this.settings.retryBaseMs, outcome.retryAfter),
      );
    }
  }

  private async attempt(
    request: AxiosRequestConfig,
  ): Promise<AxiosResponse | RetryableFailure> {
    try {
      const response = await axios.request({
        ...request,
        headers: { Accept: 'application/json' },
        auth: this.credentials(),
        httpsAgent: this.agent,
        timeout: this.settings.timeoutMs,
        maxContentLength: this.settings.maxResponseBytes,
        maxRedirects: 0,
        validateStatus: () => true,
      });
      const failure = statusFailure(response);
      return failure ?? response;
    } catch (error) {
      return transportFailure(error);
    }
  }

  private credentials(): AxiosRequestConfig['auth'] {
    const { username, password } = this.settings;
    return username ? { username, password: password ?? '' } : undefined;
  }
}

/** A failure plus the server's `Retry-After`, when it sent one. */
type RetryableFailure = PiRequestError & { retryAfter?: string };

function statusFailure(response: AxiosResponse): RetryableFailure | null {
  const status = response.status;
  if (status >= 200 && status < 300) return null;
  const message = `PI Web API answered ${status} ${response.statusText ?? ''}`;
  const failure: RetryableFailure = new PiRequestError(
    message.trim(),
    kindOfStatus(status),
    status,
  );
  const retryAfter: unknown = response.headers?.['retry-after'];
  if (typeof retryAfter === 'string') failure.retryAfter = retryAfter;
  return failure;
}

function kindOfStatus(status: number): PiFailureKind {
  if (status === 401) return 'auth';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 405 || status === 501) return 'unsupported';
  if (status === 408 || status === 429 || status >= 500) return 'unavailable';
  return 'rejected';
}

function transportFailure(error: unknown): RetryableFailure {
  const code = (error as { code?: unknown })?.code;
  const message = error instanceof Error ? error.message : String(error);
  if (/maxContentLength/i.test(message) || code === 'ERR_BAD_RESPONSE') {
    return new PiRequestError(message, 'too_large');
  }
  if (typeof code === 'string' && TLS_ERROR.test(code)) {
    return new PiRequestError(`TLS: ${code}`, 'tls');
  }
  return new PiRequestError(
    `PI Web API unreachable: ${typeof code === 'string' ? code : message}`,
    'network',
  );
}

/**
 * Wait before retry `attempt` (0-based): the server's `Retry-After` (seconds or HTTP date, capped at
 * 60 s) when present, else full jitter over `baseMs × 2^attempt` (capped at 10 s).
 */
export function retryDelayMs(
  attempt: number,
  baseMs: number,
  retryAfter?: string,
  random: () => number = Math.random,
): number {
  const fromHeader = retryAfterMs(retryAfter);
  if (fromHeader !== null) return Math.min(fromHeader, RETRY_AFTER_CAP_MS);
  const ceiling = Math.min(RETRY_CAP_MS, baseMs * 2 ** Math.min(attempt, 20));
  return Math.floor(random() * ceiling);
}

function retryAfterMs(header?: string): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
