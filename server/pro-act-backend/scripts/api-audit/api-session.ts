/**
 * HTTP side of the audit: logs the demo personas in (scripts/demo-personas/persona-catalog.ts) and
 * sends requests as one of them with the acting tenant, paced under the per-user rate limit
 * (300 requests / minute), recording status, latency and payload size. Tokens are never logged.
 */
import { randomUUID } from 'crypto';
import { satisfiesRole } from '../../src/auth/roles/role-model';
import { DEMO_PERSONA_PASSWORD } from '../demo-personas/persona-catalog';

const REQUEST_TIMEOUT_MS = 30_000;
/** 250 ms between two requests of one user = at most 240 / minute. */
const MIN_INTERVAL_MS = 250;
const TOKEN_MAX_AGE_MS = 10 * 60_000;

export interface Persona {
  key: string;
  email: string;
  /** effective roles in the acting tenant (legacy role + its D06 mapping + extra scopes) */
  roles: string[];
}

/** The personas the audit acts as (Demo Plant), as seeded by `npm run db:seed-demo-personas`. */
export const AUDIT_PERSONAS: Persona[] = [
  {
    key: 'helena',
    email: 'helena.fischer@demo.acme.com',
    roles: ['SuperAdmin'],
  },
  {
    key: 'jonas',
    email: 'jonas.weber@demo.acme.com',
    roles: ['Manager', 'manager_approver'],
  },
  {
    key: 'fatima',
    email: 'fatima.haddad@demo.acme.com',
    roles: ['Manager', 'manager_approver'],
  },
  {
    key: 'noah',
    email: 'noah.schmidt@demo.acme.com',
    roles: ['Engineer', 'production_engineer'],
  },
  {
    key: 'viktor',
    email: 'viktor.petrov@demo.acme.com',
    roles: ['Engineer', 'production_engineer', 'reliability_engineer'],
  },
  {
    key: 'elena',
    email: 'elena.marchetti@demo.acme.com',
    roles: ['Engineer', 'production_engineer', 'integration_admin'],
  },
  {
    key: 'charlotte',
    email: 'charlotte.evans@demo.acme.com',
    roles: ['Analyst', 'production_engineer', 'master_data_admin'],
  },
  {
    key: 'liam',
    email: 'liam.murphy@demo.acme.com',
    roles: ['Operator', 'operator'],
  },
  { key: 'grace', email: 'grace.whitfield@demo.acme.com', roles: ['viewer'] },
];

export interface ApiResponse {
  status: number;
  ms: number;
  bytes: number;
  body: unknown;
  /** `code` / message of an error envelope */
  error: string;
}

export interface SendOptions {
  method: string;
  path: string;
  persona: Persona;
  query?: Record<string, string | string[]>;
  body?: unknown;
  headers?: Record<string, string>;
}

interface Login {
  token: string;
  at: number;
  userId: string;
  organizationId: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function errorOf(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const { code, message } = body as { code?: unknown; message?: unknown };
  const text = Array.isArray(message)
    ? message.join('; ')
    : typeof message === 'string'
      ? message
      : '';
  return [typeof code === 'string' ? code : '', text]
    .filter(Boolean)
    .join(': ')
    .slice(0, 300);
}

export class ApiSession {
  private readonly logins = new Map<string, Login>();
  private readonly lastCall = new Map<string, number>();
  private rotation = 0;

  constructor(
    private readonly origin: string,
    readonly tenantId: string,
  ) {}

  persona(key: string): Persona {
    const found = AUDIT_PERSONAS.find((p) => p.key === key);
    if (!found) throw new Error(`unknown persona ${key}`);
    return found;
  }

  /**
   * A persona allowed by `roles` (any authenticated user when empty): a non-SuperAdmin holder when one
   * exists, rotating to spread the rate limit; never the viewer for writes or open routes.
   */
  pick(roles: string[], write: boolean): Persona {
    const candidates = AUDIT_PERSONAS.filter((p) => {
      if (p.key === 'helena') return false;
      if (p.key === 'grace' && (write || !roles.includes('viewer')))
        return false;
      return roles.length === 0 || roles.some((r) => satisfiesRole(p.roles, r));
    });
    if (!candidates.length) return this.persona('helena');
    this.rotation += 1;
    return candidates[this.rotation % candidates.length];
  }

  async identity(persona: Persona): Promise<Login> {
    const cached = this.logins.get(persona.key);
    if (cached && Date.now() - cached.at < TOKEN_MAX_AGE_MS) return cached;
    const response = await fetch(`${this.origin}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        email: persona.email,
        password: DEMO_PERSONA_PASSWORD,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok)
      throw new Error(
        `login as ${persona.email} failed with HTTP ${response.status}`,
      );
    const body = (await response.json()) as {
      access_token?: string;
      user?: { id?: string; organizationId?: string };
    };
    if (!body.access_token)
      throw new Error(`login as ${persona.email} returned no access_token`);
    const login: Login = {
      token: body.access_token,
      at: Date.now(),
      userId: body.user?.id ?? '',
      organizationId: body.user?.organizationId ?? '',
    };
    this.logins.set(persona.key, login);
    return login;
  }

  private async pace(persona: Persona): Promise<void> {
    const wait =
      (this.lastCall.get(persona.key) ?? 0) + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    this.lastCall.set(persona.key, Date.now());
  }

  private url(path: string, query?: Record<string, string | string[]>): string {
    const url = new URL(path, this.origin);
    for (const [key, value] of Object.entries(query ?? {}))
      (Array.isArray(value) ? value : [value]).forEach((v) =>
        url.searchParams.append(key, v),
      );
    return url.toString();
  }

  async send(options: SendOptions): Promise<ApiResponse> {
    const login = await this.identity(options.persona);
    await this.pace(options.persona);
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${login.token}`,
      'X-Tenant-Id': this.tenantId,
      'X-Correlation-Id': randomUUID(),
      ...(options.headers ?? {}),
    };
    if (options.body !== undefined)
      headers['Content-Type'] = 'application/json';
    const started = performance.now();
    try {
      const response = await fetch(this.url(options.path, options.query), {
        method: options.method,
        headers,
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const text = await response.text();
      const ms = Math.round(performance.now() - started);
      const body = parseJson(text);
      const error = response.ok ? '' : errorOf(body) || text.slice(0, 200);
      return {
        status: response.status,
        ms,
        bytes: Buffer.byteLength(text),
        body,
        error,
      };
    } catch (failure) {
      const ms = Math.round(performance.now() - started);
      return {
        status: 0,
        ms,
        bytes: 0,
        body: null,
        error: String(failure).slice(0, 200),
      };
    }
  }
}

function parseJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
