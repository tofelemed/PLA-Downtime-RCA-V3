/** Renders the audit as `docs/API_USAGE_AUDIT.md`. */
import { BackendRoute, Defect, FrontendCall, SmokeResult } from './audit-types';
import { CallMatch } from './cross-check';
import { SLOW_MS } from './live-defects';

export interface AuditReport {
  generatedAt: string;
  origin: string;
  tenantId: string;
  live: boolean;
  calls: FrontendCall[];
  routes: BackendRoute[];
  matches: CallMatch[];
  uncalled: BackendRoute[];
  defects: Defect[];
  results: SmokeResult[];
  creates: SmokeResult[];
  external: Array<{ location: string; target: string }>;
}

const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

function table(header: string[], rows: string[][]): string {
  const head = `| ${header.join(' | ')} |\n|${header.map(() => '---').join('|')}|`;
  return [head, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join(
    '\n',
  );
}

function countBy<T>(items: T[], key: (item: T) => string): Map<string, number> {
  const out = new Map<string, number>();
  items.forEach((i) => out.set(key(i), (out.get(key(i)) ?? 0) + 1));
  return out;
}

function summary(r: AuditReport): string {
  const reads = r.results.filter((x) => x.kind === 'read');
  const probes = r.results.filter(
    (x) => x.kind === 'validation' && x.method !== 'GET',
  );
  const absent = r.results.filter(
    (x) => x.kind === 'validation' && x.method === 'GET',
  );
  const skipped = r.results.filter((x) => x.kind === 'skipped');
  const ok = (x: SmokeResult) =>
    x.status !== null && x.status >= 200 && x.status < 300;
  const reachable = (x: SmokeResult) =>
    x.status !== null &&
    [400, 404, 409, 412, 422].includes(x.status) &&
    !/Cannot (POST|PUT|PATCH|DELETE)/.test(x.error);
  const uniqueRoutes = new Set(
    r.matches.filter((m) => m.route).map((m) => m.route),
  );
  const lines = [
    `- Frontend call sites: **${r.calls.length}** (${r.calls.filter((c) => c.client === 'v1').length} v1 \`httpClient\`, ${r.calls.filter((c) => c.client === 'v2').length} v2), reaching **${uniqueRoutes.size}** distinct backend routes.`,
    `- Backend routes registered: **${r.routes.length}**; never called by the frontend: **${r.uncalled.length}** (informational, listed below).`,
  ];
  if (r.live)
    lines.push(
      `- Live GETs: **${reads.filter(ok).length} / ${reads.length}** answered 2xx; ${reads.filter((x) => ok(x) && x.ms > SLOW_MS).length} took over ${SLOW_MS} ms.`,
      `- Live mutation probes: **${probes.filter(reachable).length} / ${probes.length}** reachable and validating (400/404/409/412/422 from the handler).`,
      `- Absent-id GETs: **${absent.filter((x) => x.status === 404).length} / ${absent.length}** answered 404 (the rest answer 2xx with an empty body).`,
      `- Not exercised live: **${skipped.length}** (no data to resolve an id, or a probe could change real data — listed below).`,
      `- Create → read-back flows: ${r.creates.filter((x) => x.kind === 'readback' && ok(x) && x.note.includes('matches')).length} / ${r.creates.filter((x) => x.kind === 'create').length} passed.`,
    );
  const byCategory = [...countBy(r.defects, (d) => d.category)]
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
  const bySeverity = [...countBy(r.defects, (d) => d.severity)]
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
  lines.push(
    `- Defects: **${r.defects.length}** (${bySeverity || 'none'}) — by category: ${byCategory || 'none'}.`,
  );
  return lines.join('\n');
}

function defectTable(defects: Defect[]): string {
  const sorted = [...defects].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.category.localeCompare(b.category) ||
      a.path.localeCompare(b.path),
  );
  return table(
    [
      '#',
      'Sev',
      'Category',
      'Call',
      'Frontend',
      'Backend',
      'Problem',
      'Recommended fix',
    ],
    sorted.map((d, i) => [
      String(i + 1),
      d.severity,
      d.category,
      `\`${d.method} ${d.path}\``,
      d.frontend,
      d.backend,
      `${d.detail}${d.evidence ? ` Evidence: ${d.evidence}` : ''}`,
      d.fix,
    ]),
  );
}

function slowest(results: SmokeResult[]): string {
  const rows = results
    .filter((r) => r.kind === 'read' && r.status !== null && r.status < 300)
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 20)
    .map((r) => [
      `\`GET ${r.path}\``,
      String(r.ms),
      String(r.bytes),
      r.persona,
      r.note,
    ]);
  return table(['Route', 'ms', 'bytes', 'persona', 'note'], rows);
}

function skippedTable(results: SmokeResult[]): string {
  const rows = results
    .filter((r) => r.kind === 'skipped')
    .map((r) => [
      `\`${r.method} ${r.path}\``,
      r.status === null ? '' : String(r.status),
      r.note,
    ]);
  return rows.length
    ? table(['Route', 'Status', 'Why not exercised'], rows)
    : '_None._';
}

function createTable(results: SmokeResult[]): string {
  const rows = results.map((r) => [
    r.kind,
    `\`${r.method} ${r.path}\``,
    r.persona,
    String(r.status),
    String(r.ms),
    r.note,
    r.error,
  ]);
  return rows.length
    ? table(['Step', 'Route', 'Persona', 'Status', 'ms', 'Note', 'Error'], rows)
    : '_Not run._';
}

function openMutations(matches: CallMatch[]): string {
  const routes = new Set(
    matches
      .map((m) => m.route)
      .filter(
        (route): route is BackendRoute =>
          !!route &&
          route.method !== 'GET' &&
          route.roles.length === 0 &&
          !route.isPublic,
      ),
  );
  return [...routes]
    .map((route) => `\`${route.method} ${route.path}\``)
    .sort()
    .join(', ');
}

function uncalledList(routes: BackendRoute[]): string {
  const byController = new Map<string, BackendRoute[]>();
  routes.forEach((r) =>
    byController.set(r.controller, [
      ...(byController.get(r.controller) ?? []),
      r,
    ]),
  );
  return [...byController]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([controller, list]) =>
        `- **${controller}** (${list.length}): ${list.map((r) => `\`${r.method} ${r.path}\``).join(', ')}`,
    )
    .join('\n');
}

function inventoryTable(r: AuditReport): string {
  const live = new Map<string, SmokeResult>();
  r.results.forEach((x) => {
    const key = `${x.method} ${x.path}`;
    if (!live.has(key)) live.set(key, x);
  });
  const rows = r.matches
    .slice()
    .sort(
      (a, b) =>
        a.call.path.localeCompare(b.call.path) ||
        a.call.method.localeCompare(b.call.method),
    )
    .map(({ call, route }) => {
      const result = route
        ? live.get(`${call.method} ${route.path}`)
        : undefined;
      const status = result
        ? `${result.kind === 'skipped' ? 'skipped' : result.status} ${result.kind === 'skipped' ? '' : `${result.ms}ms ${result.bytes}B`}`
        : '';
      return [
        call.method,
        `\`${call.path}\``,
        call.client,
        `${call.caller} — ${call.location}`,
        route
          ? `${route.controller}.${route.handler} — ${route.location}`
          : '**no route**',
        route ? route.roles.join(', ') || 'any' : '',
        status.trim(),
        call.usedBy.join(', ') || '—',
      ];
    });
  return table(
    [
      'Method',
      'Path',
      'Client',
      'Caller (file:line)',
      'Backend handler',
      'Roles',
      'Live',
      'Used by',
    ],
    rows,
  );
}

export function renderReport(r: AuditReport): string {
  return [
    '# API usage audit',
    '',
    `Generated ${r.generatedAt} by \`npm run api:audit\` (server/pro-act-backend/scripts/api-audit/) against ${r.origin}, tenant \`${r.tenantId}\`.` +
      ' Regenerate with the same command; the static part needs no running stack (`-- --static-only`).',
    '',
    'Method: the frontend inventory is built with the TypeScript type checker over `tsconfig.app.json` (every `httpClient`, `v2.*`, `v2Request`, `useV2InfiniteList` call, including helpers that forward a path); the backend inventory walks the `AppModule` controller tree (roles, `@Idempotent()`, `@IfMatch()`, the whitelisted fields of each `@Body()` DTO). Live: every GET as an allowed persona with ids read from list endpoints; every mutation probed with an absent id and/or an empty body (never executed on real data); bodies the DTO would reject are confirmed by sending only the rejected fields.',
    '',
    '## Summary',
    '',
    summary(r),
    '',
    '## Defects',
    '',
    r.defects.length ? defectTable(r.defects) : '_No defects found._',
    '',
    '## Slowest endpoints',
    '',
    r.live ? slowest(r.results) : '_Live test not run._',
    '',
    '## Create → read-back flows (AUDIT records kept)',
    '',
    createTable(r.creates),
    '',
    '## Not exercised live',
    '',
    r.live ? skippedTable(r.results) : '_Live test not run._',
    '',
    '## Mutations the frontend calls that any signed-in role may use (informational)',
    '',
    'No `@Roles()` on the route: every authenticated member of the tenant passes the role guard (the read-only guard still stops `viewer`). Review whether that is intended.',
    '',
    openMutations(r.matches),
    '',
    '## Other outbound calls (not the Pro-Act API)',
    '',
    'Direct `fetch` calls to third-party or user-configured URLs; outside this audit, listed for review.',
    '',
    table(
      ['Location', 'URL expression'],
      r.external.map((e) => [e.location, `\`${e.target}\``]),
    ),
    '',
    '## Backend routes the frontend never calls (informational)',
    '',
    uncalledList(r.uncalled),
    '',
    '## Full inventory of frontend calls',
    '',
    inventoryTable(r),
    '',
  ].join('\n');
}
