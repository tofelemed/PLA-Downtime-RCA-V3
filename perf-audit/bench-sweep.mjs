// GET sweep over every route in the OpenAPI documents of the perf API (perf-audit/start-api.sh).
// Path / required query parameters are filled with real ids from the perf clone. Each route is called once
// (cold: first call since boot) then WARM times sequentially, per role; every request carries
// `x-perf-tag: <role>|<METHOD> <template>|<n>` so perf-audit/report.mjs can join it with instrument.cjs output.
// Response sizes (raw, gzip, brotli) are measured here. Read-only (GET only).
//   node perf-audit/bench-sweep.mjs [--roles SuperAdmin,Analyst] [--warm 10] [--filter /v2/]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import zlib from 'node:zlib';

const BASE = process.env.PERF_BASE || 'http://127.0.0.1:4014';
const PASSWORD = process.env.PERF_PASSWORD;
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const ROLES = arg('roles', 'SuperAdmin,Analyst').split(',');
const WARM = Number(arg('warm', '10'));
const FILTER = arg('filter', '');
const OUT = arg('out', 'perf-audit/out/sweep.jsonl');
if (!PASSWORD) throw new Error('Set PERF_PASSWORD (the perf-clone password, never the real one)');

const psql = (sql) =>
  execFileSync('docker', ['exec', 'proact-perf-postgres', 'psql', '-U', 'postgres', '-d', 'proact', '-X', '-At', '-c', sql], {
    encoding: 'utf8',
    env: { ...process.env, MSYS_NO_PATHCONV: '1' },
  }).trim();

const TENANT = psql(`SELECT id FROM tenants ORDER BY created_at LIMIT 1`);
const TABLE_FOR = {
  'production-plans': 'plan_versions', jobs: 'ingestion_jobs', connections: 'integration_connections',
  profiles: 'production_profiles', rates: 'unit_product_rates', adjustments: 'actuals_adjustments',
  'flow-routes': 'plant_flow_routes', versions: 'plan_versions', exports: 'export_jobs',
  'rca-knowledge': 'rca_knowledge_base', 'rca-causes': 'rca_cause_codes', 'failure-dictionary': 'failure_dictionary_entries',
};
const PREFERRED = {
  production_periods: `SELECT p.id FROM production_periods p JOIN calculation_runs r ON r.period_id = p.id GROUP BY p.id ORDER BY count(*) DESC LIMIT 1`,
  production_events: `SELECT id FROM production_events WHERE tenant_id = '${TENANT}' ORDER BY start_time DESC LIMIT 1`,
};
const idCache = new Map();
function idOf(table) {
  if (idCache.has(table)) return idCache.get(table);
  let id = '';
  try {
    if (PREFERRED[table]) id = psql(PREFERRED[table]);
    else {
      const hasTenant = psql(`SELECT 1 FROM information_schema.columns WHERE table_name='${table}' AND column_name='tenant_id'`);
      id = psql(`SELECT id FROM "${table}" ${hasTenant ? `WHERE tenant_id = '${TENANT}'` : ''} LIMIT 1`);
    }
  } catch { id = ''; }
  idCache.set(table, id || null);
  return id || null;
}

const now = new Date();
const daysAgo = (n) => new Date(now.getTime() - n * 86400000);
const isoDate = (d) => d.toISOString().slice(0, 10);
const NAMED = {
  runId: () => psql(`SELECT current_run_id FROM accounting_revisions WHERE current_run_id IS NOT NULL LIMIT 1`),
  eventId: () => idOf('production_events'), unitId: () => idOf('units'), month: () => isoDate(now).slice(0, 7),
  tenantId: () => TENANT, organizationId: () => psql(`SELECT organization_id FROM tenants WHERE id='${TENANT}'`),
  productId: () => idOf('products'), periodIds: () => idOf('production_periods'), scopeId: () => TENANT,
  entityId: () => idOf('production_events'), version: () => '1', key: () => psql(`SELECT key FROM feature_flags LIMIT 1`) || 'x',
};
const QUERY_VALUES = {
  from: () => daysAgo(7).toISOString(), to: () => now.toISOString(), at: () => now.toISOString(),
  fromDate: () => isoDate(daysAgo(7)), toDate: () => isoDate(now), isActive: () => 'true', status: () => 'open',
  scopeType: () => 'tenant', views: () => 'economic', email: () => 'nobody@example.invalid', entityType: () => 'production_event',
};
const valueFor = (name) => {
  try { return (NAMED[name] || QUERY_VALUES[name] || (() => null))(); } catch { return null; }
};

function buildUrl(template, op) {
  let unresolved = null;
  let p = template.replace(/\/([^/{}]+)\/\{(\w+)\}/g, (all, seg, name) => {
    const v = name === 'id' ? idOf(TABLE_FOR[seg] || seg.replace(/-/g, '_')) : valueFor(name);
    if (!v) unresolved = name === 'id' ? `id@${seg}` : name;
    return `/${seg}/${encodeURIComponent(v || 'missing')}`;
  });
  p = p.replace(/\{(\w+)\}/g, (all, name) => {
    const v = valueFor(name);
    if (!v) unresolved = name;
    return encodeURIComponent(v || 'missing');
  });
  const qs = new URLSearchParams();
  for (const prm of op.parameters || []) {
    if (prm.in !== 'query' || !prm.required) continue;
    const v = valueFor(prm.name);
    if (v) qs.set(prm.name, v);
    else unresolved = unresolved || `query:${prm.name}`;
  }
  return { url: p + (qs.size ? `?${qs}` : ''), unresolved };
}

async function login(role) {
  const email = psql(`SELECT email FROM users WHERE role='${role}' AND email LIKE '%@hdpe-train.mpc' ORDER BY email LIMIT 1`);
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }),
  });
  const body = await res.json();
  if (!body.access_token) throw new Error(`login failed for ${role}: ${res.status}`);
  return body.access_token;
}

const routes = [];
for (const file of ['api-json', 'api_docs_v2-json']) {
  const doc = JSON.parse(fs.readFileSync(`perf-audit/out/${file}.json`, 'utf8'));
  for (const [template, ops] of Object.entries(doc.paths)) {
    if (ops.get && template.includes(FILTER) && !/\/(export|download|stream|events\/stream)\b|\{fileName\}/.test(template)) {
      routes.push({ template, op: ops.get });
    }
  }
}

const out = fs.createWriteStream(OUT, { flags: 'a' });
for (const role of ROLES) {
  const token = await login(role);
  const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-Id': TENANT, 'Accept-Encoding': 'identity' };
  for (const { template, op } of routes) {
    const { url, unresolved } = buildUrl(template, op);
    for (let n = 0; n <= WARM; n += 1) {
      const started = performance.now();
      let status = 0, buf = Buffer.alloc(0), error = null;
      try {
        const res = await fetch(BASE + url, { headers: { ...headers, 'x-perf-tag': `${role}|GET ${template}|${n}` } });
        status = res.status;
        buf = Buffer.from(await res.arrayBuffer());
      } catch (e) { error = String(e); }
      const ms = performance.now() - started;
      const rec = { role, template, n, status, clientMs: +ms.toFixed(2), bytes: buf.length, unresolved, error };
      if (n === 0) {
        rec.gzip = zlib.gzipSync(buf).length;
        rec.br = zlib.brotliCompressSync(buf).length;
        if (status >= 400) rec.errorBody = buf.toString('utf8').slice(0, 200);
      }
      out.write(JSON.stringify(rec) + '\n');
      if (status >= 400 && n === 0) break; // do not repeat failing calls
    }
  }
  console.log(`${role}: ${routes.length} GET routes done`);
}
out.end();
