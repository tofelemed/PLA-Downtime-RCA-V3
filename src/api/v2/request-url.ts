export type QueryScalar = string | number | boolean;
export type QueryValue = QueryScalar | null | undefined | ReadonlyArray<QueryScalar>;
export type QueryParams = Record<string, QueryValue>;

const pageOrigin = () => (typeof window !== 'undefined' ? window.location.origin : 'http://localhost');

/** `/production-events/{id}` + `{ id }` → `/production-events/<encoded id>`; a missing parameter throws. */
export function fillPath(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`Missing path parameter ${name}`);
    return encodeURIComponent(String(value));
  });
}

/** Absolute URL under `base`; arrays become repeated parameters (`?unitIds=a&unitIds=b`). */
export function buildUrl(base: string, path: string, query?: QueryParams): string {
  const target = `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  const url = new URL(target, pageOrigin());
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    const values: ReadonlyArray<QueryScalar> = Array.isArray(value) ? value : [value as QueryScalar];
    for (const item of values) url.searchParams.append(key, String(item));
  }
  return url.toString();
}

/** Whether `url` is under the API base (same origin and path prefix): the only place a token may go. */
export function isApiUrl(url: string, base: string): boolean {
  const api = new URL(base, pageOrigin());
  const target = new URL(url, pageOrigin());
  const prefix = api.pathname.replace(/\/+$/, '');
  return target.origin === api.origin && (target.pathname === prefix || target.pathname.startsWith(`${prefix}/`));
}

/** Seconds of a `Retry-After` header (delta-seconds or HTTP date), clamped to [0, maxSeconds]. */
export function retryAfterSeconds(header: string | null, maxSeconds: number, now = Date.now()): number {
  if (!header) return 1;
  const seconds = Number(header);
  const value = Number.isFinite(seconds) ? seconds : (Date.parse(header) - now) / 1000;
  if (!Number.isFinite(value)) return 1;
  return Math.min(Math.max(value, 0), maxSeconds);
}
