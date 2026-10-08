export const PI_PROXY_ALLOWED_METHODS = ['GET', 'POST'] as const;
export type PIProxyMethod = (typeof PI_PROXY_ALLOWED_METHODS)[number];

/** PI Web API controllers that the browser may reach through the proxy (spec §4.2). */
export const PI_PROXY_ALLOWED_PREFIXES = [
  '/assetservers',
  '/assetdatabases',
  '/elements',
  '/eventframes',
  '/streams',
  '/streamsets',
  '/attributes',
  '/batch',
] as const;

export const PI_PROXY_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
export const PI_PROXY_MAX_REQUEST_BYTES = 1024 * 1024;
export const PI_PROXY_TIMEOUT_MS = 30_000;

const PI_WEB_API_ROOT = '/piwebapi';

export interface ResolvedProxyUrl {
  url: string;
  origin: string;
  pathname: string;
}

/** The connection's base URL normalised to `<origin>/piwebapi`; null unless it is http(s). */
export function connectionBaseUrl(piWebApiUrl: string): URL | null {
  const parsed = tryParseUrl(piWebApiUrl);
  if (
    !parsed ||
    (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')
  ) {
    return null;
  }
  const path = parsed.pathname.replace(/\/+$/, '');
  parsed.pathname = path.toLowerCase().endsWith(PI_WEB_API_ROOT)
    ? path
    : `${path}${PI_WEB_API_ROOT}`;
  parsed.search = '';
  parsed.hash = '';
  parsed.username = '';
  parsed.password = '';
  return parsed;
}

/** Same scheme, host and port (case-insensitive). */
export function sameOrigin(a: string, b: string): boolean {
  const left = tryParseUrl(a);
  const right = tryParseUrl(b);
  return (
    !!left &&
    !!right &&
    left.origin.toLowerCase() === right.origin.toLowerCase()
  );
}

/**
 * Joins a client path onto the connection's PI Web API root and accepts it only when the result stays on
 * the connection's origin and under an allowlisted controller. `..` segments are normalised by the URL
 * parser before the prefix check, so traversal out of the allowlist is rejected.
 */
export function resolveProxyUrl(
  piWebApiUrl: string,
  requestPath: string,
): ResolvedProxyUrl | null {
  const base = connectionBaseUrl(piWebApiUrl);
  if (!base || !isPlainRelativePath(requestPath)) {
    return null;
  }
  const candidate = tryParseUrl(
    `${base.origin}${base.pathname}/${requestPath.replace(/^\/+/, '')}`,
  );
  if (!candidate || candidate.origin !== base.origin) {
    return null;
  }
  const root = base.pathname.toLowerCase();
  const pathname = candidate.pathname.toLowerCase();
  const allowed = PI_PROXY_ALLOWED_PREFIXES.some(
    (prefix) =>
      pathname === `${root}${prefix}` ||
      pathname.startsWith(`${root}${prefix}/`),
  );
  return allowed
    ? {
        url: candidate.toString(),
        origin: candidate.origin,
        pathname: candidate.pathname,
      }
    : null;
}

/** TLS verification stays on unless the connection's JSON config carries an explicit opt-out. */
export function isTlsVerificationDisabled(
  connectionConfig?: string | null,
): boolean {
  if (!connectionConfig) {
    return false;
  }
  try {
    const parsed: unknown = JSON.parse(connectionConfig);
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as Record<string, unknown>).insecureSkipTlsVerify === true
    );
  } catch {
    return false;
  }
}

function isPlainRelativePath(requestPath: unknown): requestPath is string {
  return (
    typeof requestPath === 'string' &&
    requestPath.length > 0 &&
    !/[\s\\]/.test(requestPath) &&
    !requestPath.includes('://') &&
    !requestPath.startsWith('//')
  );
}

function tryParseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
