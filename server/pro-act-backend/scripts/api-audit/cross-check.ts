/**
 * Static cross-check of the audit: matches each frontend call to a backend route and reports missing
 * routes, method mismatches, body fields the ValidationPipe would reject (whitelist +
 * forbidNonWhitelisted) or require, and missing `Idempotency-Key` / `If-Match` headers.
 */
import { BackendRoute, Defect, FrontendCall } from './audit-types';

/** Read-only entity columns a `Partial<Entity>` payload type lets through (sent when a caller spreads a row). */
const ENTITY_META = new Set(['id', 'createdAt', 'updatedAt']);

const isParam = (segment: string) => /^\{[^}]+\}$/.test(segment);

/** Match quality of a frontend template against a route template: -1 = no match, higher = closer. */
export function matchScore(frontend: string, backend: string): number {
  const a = frontend.split('/');
  const b = backend.split('/');
  if (a.length !== b.length) return -1;
  let score = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] === b[i]) score += 2;
    else if (isParam(b[i])) score += isParam(a[i]) ? 1 : 0;
    else if (isParam(a[i])) score += 0;
    else return -1;
  }
  return score;
}

export interface CallMatch {
  call: FrontendCall;
  route: BackendRoute | null;
  /** route with the same path but another method, when `route` is null */
  otherMethod: BackendRoute | null;
}

function best(call: FrontendCall, routes: BackendRoute[]): BackendRoute | null {
  let found: BackendRoute | null = null;
  let top = -1;
  for (const route of routes) {
    const score = matchScore(call.path, route.path);
    if (score > top) {
      top = score;
      found = route;
    }
  }
  return found;
}

export function matchCalls(
  calls: FrontendCall[],
  routes: BackendRoute[],
): CallMatch[] {
  return calls.map((call) => {
    const route = best(
      call,
      routes.filter((r) => r.method === call.method),
    );
    return {
      call,
      route,
      otherMethod: route ? null : best(call, routes),
    };
  });
}

function routeMissing(match: CallMatch): Defect {
  const { call, otherMethod } = match;
  const base = {
    method: call.method,
    path: call.path,
    frontend: `${call.location} (${call.caller})`,
  };
  if (otherMethod)
    return {
      ...base,
      severity: 'high',
      category: 'method-mismatch',
      backend: `${otherMethod.method} ${otherMethod.path} @ ${otherMethod.location}`,
      detail: `No ${call.method} route; the backend serves ${otherMethod.method} on this path.`,
      fix: `Call ${otherMethod.method} from the client, or add the ${call.method} handler.`,
    };
  return {
    ...base,
    severity: 'high',
    category: 'missing-route',
    backend: '(none)',
    detail:
      'No backend route matches this method and path (live call answers 404 "Cannot …").',
    fix: 'Remove the dead client call or point it at the current route (v1/v2 prefix, path, params).',
  };
}

function bodyDefects(call: FrontendCall, route: BackendRoute): Defect[] {
  const dto = route.body;
  if (!dto || !call.bodyFields || call.bodyUntyped) return [];
  const accepted = new Set(dto.fields);
  const sent = new Set(call.bodyFields);
  const extra = call.bodyFields.filter((f) => !accepted.has(f));
  const missing = dto.required.filter((f) => !sent.has(f));
  const base = {
    method: call.method,
    path: call.path,
    frontend: `${call.location} (${call.caller})`,
    backend: `${route.controller}.${route.handler} @ ${route.location} (${dto.name})`,
  };
  const out: Defect[] = [];
  if (extra.length)
    out.push({
      ...base,
      severity: extra.every((f) => ENTITY_META.has(f)) ? 'low' : 'medium',
      category: 'body-mismatch',
      extraFields: extra,
      detail: `Body type declares fields ${dto.name} does not whitelist: ${extra.join(', ')} (400 "property X should not exist" when sent).`,
      fix: `Drop ${extra.join(', ')} from the payload builder, or add them to ${dto.name} if the server needs them.`,
    });
  if (missing.length)
    out.push({
      ...base,
      severity: 'high',
      category: 'body-mismatch',
      detail: `${dto.name} requires ${missing.join(', ')}, which the client body type does not declare.`,
      fix: `Send ${missing.join(', ')} from the client, or make them optional in ${dto.name}.`,
    });
  return out;
}

function headerDefects(call: FrontendCall, route: BackendRoute): Defect[] {
  const base = {
    severity: 'high' as const,
    category: 'missing-header' as const,
    method: call.method,
    path: call.path,
    frontend: `${call.location} (${call.caller})`,
    backend: `${route.controller}.${route.handler} @ ${route.location}`,
  };
  const out: Defect[] = [];
  if (route.idempotent && !call.sendsIdempotencyKey)
    out.push({
      ...base,
      detail:
        'Route is @Idempotent() but the call sends no Idempotency-Key (428).',
      fix: 'Send the call through the v2 client (v2.post / v2Request), which adds the key.',
    });
  if (route.requiresIfMatch && !call.sendsIfMatch)
    out.push({
      ...base,
      detail:
        'Route takes @IfMatch() but the call sends no If-Match (428 REVISION_REQUIRED).',
      fix: 'Pass ifMatch (ifMatchOf(rowVersion) or the cached ETag) on this call.',
    });
  return out;
}

export function staticDefects(matches: CallMatch[]): Defect[] {
  return matches.flatMap((match) =>
    match.route
      ? [
          ...bodyDefects(match.call, match.route),
          ...headerDefects(match.call, match.route),
        ]
      : [routeMissing(match)],
  );
}

/** Routes no frontend call reaches (informational). */
export function uncalledRoutes(
  matches: CallMatch[],
  routes: BackendRoute[],
): BackendRoute[] {
  const used = new Set(matches.map((m) => m.route).filter(Boolean));
  return routes.filter((r) => !used.has(r));
}

/** True when every request `specific` matches is also matched by `general` (literal or param per segment). */
function generalizes(general: string, specific: string): boolean {
  const a = general.split('/');
  const b = specific.split('/');
  return (
    a.length === b.length && a.every((seg, i) => seg === b[i] || isParam(seg))
  );
}

/**
 * Routes the frontend calls that an earlier handler of the same controller swallows: Express matches in
 * declaration order, so `GET integrations/:id` declared before `GET integrations/pi` answers `/pi`.
 */
export function shadowedDefects(
  matches: CallMatch[],
  routes: BackendRoute[],
): Defect[] {
  const called = new Map<BackendRoute, FrontendCall>();
  matches.forEach((m) => m.route && called.set(m.route, m.call));
  return [...called].flatMap(([route, call]) => {
    const siblings = routes.filter(
      (r) => r.controller === route.controller && r.method === route.method,
    );
    const earlier = siblings
      .slice(0, siblings.indexOf(route))
      .find((r) => r.path !== route.path && generalizes(r.path, route.path));
    if (!earlier) return [];
    return [
      {
        severity: 'high' as const,
        category: 'shadowed-route' as const,
        method: call.method,
        path: route.path,
        frontend: `${call.location} (${call.caller})`,
        backend: `${route.controller}.${route.handler} @ ${route.location}; shadowed by ${earlier.handler} @ ${earlier.location}`,
        detail: `\`${earlier.method} ${earlier.path}\` is declared first and matches this path, so the request never reaches ${route.handler}.`,
        fix: `Declare ${route.handler} before ${earlier.handler} (literal routes before parameter routes) and validate the parameter (ParseUUIDPipe).`,
      },
    ];
  });
}
