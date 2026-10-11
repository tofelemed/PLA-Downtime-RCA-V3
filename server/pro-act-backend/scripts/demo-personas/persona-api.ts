/**
 * Minimal HTTP client for the persona verification: logs a persona in and sends probes with the
 * acting tenant in `X-Tenant-Id`. Nothing is retried and no response body is logged beyond its code.
 */
const REQUEST_TIMEOUT_MS = 30_000;

export interface ProbeResponse {
  status: number;
  /** `code` of the API error envelope, when the response carries one */
  code: string | null;
}

interface LoginBody {
  access_token?: string;
  user?: { tenantId?: string | null; role?: string };
}

export interface LoginResult {
  token: string;
  homeTenantId: string | null;
  role: string | null;
}

export interface ProbeRequest {
  method: 'GET' | 'POST' | 'PUT';
  path: string;
  tenantId: string;
  body?: unknown;
}

export class PersonaApiClient {
  constructor(private readonly baseUrl: string) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const response = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`login as ${email} failed with HTTP ${response.status}`);
    }
    const body = (await response.json()) as LoginBody;
    if (!body.access_token)
      throw new Error(`login as ${email} returned no access token`);
    return {
      token: body.access_token,
      homeTenantId: body.user?.tenantId ?? null,
      role: body.user?.role ?? null,
    };
  }

  async probe(token: string, request: ProbeRequest): Promise<ProbeResponse> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Tenant-Id': request.tenantId,
    };
    if (request.body !== undefined)
      headers['Content-Type'] = 'application/json';
    const response = await fetch(`${this.baseUrl}${request.path}`, {
      method: request.method,
      headers,
      body:
        request.body === undefined ? undefined : JSON.stringify(request.body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return { status: response.status, code: await errorCode(response) };
  }
}

async function errorCode(response: Response): Promise<string | null> {
  if (response.ok) return null;
  try {
    const body = (await response.json()) as { code?: unknown };
    return typeof body.code === 'string' ? body.code : null;
  } catch {
    return null;
  }
}
