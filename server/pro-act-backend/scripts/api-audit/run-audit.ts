/**
 * API usage audit: which backend routes the frontend calls, whether they exist and accept what the
 * frontend sends, and whether they answer on the running stack.
 *
 *   npm run api:audit -- [--origin http://localhost:4004] [--tenant <uuid>] [--static-only]
 *                        [--skip-creates] [--out ../../docs/API_USAGE_AUDIT.md] [--json <file>]
 *
 * Origin defaults to API_AUDIT_ORIGIN; the tenant defaults to the SuperAdmin persona's home tenant
 * (Demo Plant). Live mode logs in as the demo personas (`npm run db:seed-demo-personas`), never
 * deletes, and creates only the `AUDIT-<date>` records listed in create-flows.ts.
 */
import { Logger } from '@nestjs/common';
import { writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { AppModule } from '../../src/app.module';
import { IfMatch } from '../../src/common/concurrency/revision';
import { ApiSession } from './api-session';
import {
  Defect,
  FrontendCall,
  MUTATING_METHODS,
  SmokeResult,
} from './audit-types';
import { buildBackendInventory } from './backend-inventory';
import { runCreateFlows } from './create-flows';
import {
  CallMatch,
  matchCalls,
  shadowedDefects,
  staticDefects,
  uncalledRoutes,
} from './cross-check';
import { FrontendInventory } from './frontend-inventory';
import { liveDefects } from './live-defects';
import { ParamResolver } from './param-resolver';
import { AuditReport, renderReport } from './report-writer';
import { LiveTarget, SmokeRunner } from './smoke-runner';
import { applyTriage, MANUAL_FINDINGS } from './triage';

const logger = new Logger('ApiAudit');
const BACKEND_ROOT = resolve(__dirname, '../..');
const REPO_ROOT = resolve(BACKEND_ROOT, '../..');

interface Options {
  origin: string;
  tenant: string;
  staticOnly: boolean;
  /** skip the AUDIT create → read-back flows (re-runs without adding records) */
  skipCreates: boolean;
  out: string;
  json: string;
}

function parseArgs(argv: string[]): Options {
  const value = (flag: string) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  return {
    origin:
      value('--origin') ??
      process.env.API_AUDIT_ORIGIN ??
      `http://localhost:${process.env.PORT ?? '4004'}`,
    tenant: value('--tenant') ?? process.env.API_AUDIT_TENANT_ID ?? '',
    staticOnly: argv.includes('--static-only'),
    skipCreates: argv.includes('--skip-creates'),
    out: resolve(value('--out') ?? join(REPO_ROOT, 'docs/API_USAGE_AUDIT.md')),
    json: value('--json') ?? '',
  };
}

/** One live target per backend route the frontend reaches, with every call site behind it. */
function liveTargets(matches: CallMatch[]): Map<string, LiveTarget> {
  const targets = new Map<string, LiveTarget>();
  for (const { call, route } of matches) {
    if (!route) continue;
    const key = `${route.method} ${route.path}`;
    const target = targets.get(key) ?? {
      method: route.method,
      route,
      calls: [] as FrontendCall[],
    };
    target.calls.push(call);
    targets.set(key, target);
  }
  return targets;
}

async function defaultTenant(session: ApiSession): Promise<string> {
  const login = await session.identity(session.persona('helena'));
  const payload = JSON.parse(
    Buffer.from(login.token.split('.')[1], 'base64url').toString(),
  ) as { tenantId?: string };
  return payload.tenantId ?? '';
}

/** Confirms each "extra field" body defect by sending only those fields (400 before any handler). */
async function confirmBodies(
  runner: SmokeRunner,
  defects: Defect[],
  targets: Map<string, LiveTarget>,
): Promise<void> {
  const seen = new Map<string, string>();
  for (const defect of defects.filter((d) => d.extraFields?.length)) {
    const key = `${defect.method} ${defect.path} ${defect.extraFields?.join(',')}`;
    const target = [...targets.values()].find((t) =>
      t.calls.some((c) => c.method === defect.method && c.path === defect.path),
    );
    if (!target) continue;
    if (!seen.has(key)) {
      const result = await runner.confirmRejected(
        target,
        defect.extraFields ?? [],
      );
      seen.set(key, `${result.status} as ${result.persona}, ${result.note}`);
    }
    defect.evidence = seen.get(key);
  }
}

/** Mutations: one safe probe; reads: the real read plus the absent-id read. */
async function exercise(
  runner: SmokeRunner,
  target: LiveTarget,
): Promise<SmokeResult[]> {
  if (MUTATING_METHODS.includes(target.method))
    return [await runner.probe(target)];
  const read = await runner.read(target);
  const absent = await runner.absentRead(target);
  return absent ? [read, absent] : [read];
}

async function runLive(
  options: Options,
  matches: CallMatch[],
  defects: Defect[],
) {
  const session = new ApiSession(options.origin, options.tenant || 'pending');
  const tenant = options.tenant || (await defaultTenant(session));
  const live = new ApiSession(options.origin, tenant);
  const resolver = new ParamResolver(live, live.persona('helena'));
  await resolver.init();
  const runner = new SmokeRunner(live, resolver);
  const targets = liveTargets(matches);
  const results: SmokeResult[] = [];
  let done = 0;
  for (const target of targets.values()) {
    results.push(...(await exercise(runner, target)));
    done += 1;
    if (done % 25 === 0)
      logger.log(`${done} / ${targets.size} routes exercised`);
  }
  await confirmBodies(runner, defects, targets);
  const creates = options.skipCreates
    ? []
    : await runCreateFlows(live, new Date().toISOString().slice(0, 10));
  return {
    tenant,
    results,
    creates,
    defects: liveDefects([...results, ...creates], targets),
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  logger.log('building the backend route inventory');
  const routes = buildBackendInventory({
    appModule: AppModule,
    ifMatch: IfMatch,
    srcDir: join(BACKEND_ROOT, 'src'),
    repoRoot: REPO_ROOT,
  });
  logger.log('building the frontend call inventory (type checker)');
  const frontend = new FrontendInventory(REPO_ROOT);
  const calls = frontend.build();
  const matches = matchCalls(calls, routes);
  const defects = [
    ...staticDefects(matches),
    ...shadowedDefects(matches, routes),
  ];
  const live = options.staticOnly
    ? null
    : await runLive(options, matches, defects);
  const report: AuditReport = {
    generatedAt: new Date().toISOString(),
    origin: options.origin,
    tenantId: live?.tenant ?? options.tenant,
    live: live !== null,
    calls,
    routes,
    matches,
    uncalled: uncalledRoutes(matches, routes),
    defects: applyTriage([
      ...defects,
      ...(live?.defects ?? []),
      ...MANUAL_FINDINGS,
    ]),
    results: live?.results ?? [],
    creates: live?.creates ?? [],
    external: frontend.externalFetches(),
  };
  writeFileSync(options.out, renderReport(report));
  if (options.json)
    writeFileSync(options.json, JSON.stringify(report, null, 1));
  logger.log(
    `${calls.length} calls, ${routes.length} routes, ${report.defects.length} defects → ${options.out}`,
  );
}

main().catch((error: unknown) => {
  logger.error(
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
  process.exitCode = 1;
});
