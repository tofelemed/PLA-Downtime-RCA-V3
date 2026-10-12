/** Turns live smoke results into defects (route missing, 5xx, denied for an allowed role, slow, ...). */
import { Defect, SmokeResult } from './audit-types';
import { LiveTarget } from './smoke-runner';

export const SLOW_MS = 1000;
const VERY_SLOW_MS = 3000;
export const LARGE_BYTES = 1_000_000;

function frontendOf(target: LiveTarget | undefined): string {
  if (!target) return '';
  const sites = [
    ...new Set(target.calls.map((c) => `${c.location} (${c.caller})`)),
  ];
  return sites.length > 2
    ? `${sites.slice(0, 2).join('; ')} +${sites.length - 2} more`
    : sites.join('; ');
}

function backendOf(target: LiveTarget | undefined): string {
  if (!target) return '';
  const r = target.route;
  return `${r.controller}.${r.handler} @ ${r.location}`;
}

const routeMissing = (r: SmokeResult) =>
  r.status === 404 && /Cannot (GET|POST|PUT|PATCH|DELETE) /.test(r.error);

type Verdict = Pick<Defect, 'severity' | 'category' | 'detail' | 'fix'>;

function failureVerdict(r: SmokeResult): Verdict | null {
  const status = r.status ?? 0;
  const got = `HTTP ${status} as ${r.persona}${r.error ? ` (${r.error})` : ''}`;
  if (routeMissing(r))
    return {
      severity: 'high',
      category: 'live-404',
      detail: `${got}: the route is not served.`,
      fix: 'Register the route / fix the client path.',
    };
  if (status === 0 || status >= 500)
    return {
      severity: 'high',
      category: 'live-5xx',
      detail: `${got}.`,
      fix: 'Fix the server error (API log by correlation id); the screen shows an error state today.',
    };
  if (status === 401 || status === 403)
    return {
      severity: 'high',
      category: 'live-auth',
      detail: `${got}, although the persona holds a role the route allows.`,
      fix: 'Align the route roles / scope guard with the roles the screen is shown to, or hide the action for this role.',
    };
  if (status === 410 && r.error.startsWith('V1_WRITE_GONE'))
    return {
      severity: 'medium',
      category: 'retired-route',
      detail: `${got}: the frontend still calls a v1 write that is retired for this plant.`,
      fix: 'Remove the v1 call (or hide the control when the v2 flag is on) and use the v2 command the error names.',
    };
  return null;
}

function readVerdict(r: SmokeResult): Verdict | null {
  const failure = failureVerdict(r);
  if (failure) return failure;
  const status = r.status ?? 0;
  if (status >= 400 && status !== 410)
    return {
      severity: 'medium',
      category: 'live-4xx',
      detail: `HTTP ${status} as ${r.persona} on ${r.url}${r.note ? ` (${r.note})` : ''}: ${r.error}`,
      fix: 'Check the parameters the client sends against the query DTO, or answer an empty result instead of an error.',
    };
  if (r.bytes > LARGE_BYTES)
    return {
      severity: 'medium',
      category: 'large-payload',
      detail: `${(r.bytes / 1_000_000).toFixed(1)} MB in one response (${r.ms} ms, ${r.url}): the list is not paginated / not windowed.`,
      fix: 'Paginate (keyset) and window the list server-side; compute aggregates on the server instead of loading every row.',
    };
  if (r.ms > SLOW_MS)
    return {
      severity: r.ms > VERY_SLOW_MS ? 'medium' : 'low',
      category: 'slow',
      detail: `${r.ms} ms, ${r.bytes} bytes (${r.url}).`,
      fix: 'Profile the query (EXPLAIN ANALYZE), add indexes / caching with TTL, or move the work to a worker job.',
    };
  return null;
}

function probeVerdict(r: SmokeResult): Verdict | null {
  const failure = failureVerdict(r);
  if (failure) return failure;
  const status = r.status ?? 0;
  if (status < 200 || status >= 300) return null;
  if (r.method === 'GET')
    return {
      severity: 'low',
      category: 'absent-id',
      detail: `GET of an id no row has answers HTTP ${status} with an empty body instead of 404 (${r.url}).`,
      fix: 'Throw NotFoundException when findOne returns null.',
    };
  if (r.method === 'DELETE')
    return {
      severity: 'low',
      category: 'absent-id',
      detail: `DELETE of an id no row has answers HTTP ${status} instead of 404 (${r.url}).`,
      fix: 'Answer 404 when nothing was deleted (affected = 0), so a stale screen notices.',
    };
  return {
    severity: 'medium',
    category: 'validation-missing',
    detail: `${r.method} with an empty body on an id no row has answers HTTP ${status} (${r.url}): the unknown id is not reported and nothing is validated.`,
    fix: 'Answer 404 for an unknown id (check affected rows / findOne before saving).',
  };
}

function createVerdict(r: SmokeResult): Verdict | null {
  const failure = failureVerdict(r);
  if (failure) return failure;
  const status = r.status ?? 0;
  if (status >= 400 || r.note.includes('differs'))
    return {
      severity: 'high',
      category: 'live-4xx',
      detail: `${r.kind} HTTP ${status} as ${r.persona}: ${r.error || r.note}`,
      fix: 'The create → read-back journey the screen uses does not work; fix the route or payload.',
    };
  return null;
}

function verdictOf(r: SmokeResult): Verdict | null {
  if (r.kind === 'read') return readVerdict(r);
  if (r.kind === 'validation') return probeVerdict(r);
  return createVerdict(r);
}

/** Defects from live results; `targets` maps `METHOD path` to the frontend calls behind it. */
export function liveDefects(
  results: SmokeResult[],
  targets: Map<string, LiveTarget>,
): Defect[] {
  return results.flatMap((r) => {
    if (r.kind === 'skipped') return [];
    const verdict = verdictOf(r);
    if (!verdict) return [];
    const target = targets.get(`${r.method} ${r.path}`);
    return [
      {
        ...verdict,
        method: r.method,
        path: r.path,
        frontend: frontendOf(target),
        backend: backendOf(target),
        evidence: `${r.status} ${r.ms}ms ${r.url}`,
      },
    ];
  });
}
