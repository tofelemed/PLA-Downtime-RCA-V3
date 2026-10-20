/*
 * Performance-audit preload (no application code changes). Load with
 *   node -r ../../perf-audit/instrument.cjs dist/src/main.js      (cwd: server/pro-act-backend)
 * Per HTTP request it records, as one JSON line in PERF_OUT (default perf-audit/out/requests.jsonl):
 *   method, route template, url (no query values), status, total ms, DB query count / summed DB ms,
 *   RLS binding queries, repeated identical queries (same SQL + parameters), serialize+send ms, body bytes.
 * Every 5 s it appends a runtime sample (event-loop delay, heap, rss, CPU). PERF_SQL=1 also writes each
 * request's SQL texts (parameters are never written) to <PERF_OUT>.sql.jsonl.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { AsyncLocalStorage } = require('async_hooks');
const { monitorEventLoopDelay } = require('perf_hooks');

const OUT = process.env.PERF_OUT || path.resolve(__dirname, 'out', 'requests.jsonl');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const out = fs.createWriteStream(OUT, { flags: 'a' });
const sqlOut = process.env.PERF_SQL === '1' ? fs.createWriteStream(`${OUT}.sql.jsonl`, { flags: 'a' }) : null;
const als = new AsyncLocalStorage();
const nowMs = () => Number(process.hrtime.bigint()) / 1e6;

// --- request context -------------------------------------------------------------------------
const emit = http.Server.prototype.emit;
http.Server.prototype.emit = function (event, req, res) {
  if (event !== 'request') return emit.apply(this, arguments);
  const store = { start: nowMs(), queries: 0, dbMs: 0, binding: 0, keys: new Map(), sql: [], serializeMs: 0, bytes: 0 };
  res.on('finish', () => record(req, res, store));
  return als.run(store, () => emit.apply(this, arguments));
};

function countBytes(chunk, encoding) {
  if (!chunk || typeof chunk === 'function') return 0;
  return Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk, typeof encoding === 'string' ? encoding : 'utf8');
}
for (const name of ['write', 'end']) {
  const original = http.ServerResponse.prototype[name];
  http.ServerResponse.prototype[name] = function (chunk, encoding) {
    const store = als.getStore();
    if (store) store.bytes += countBytes(chunk, encoding);
    return original.apply(this, arguments);
  };
}

function routeOf(req) {
  const template = req.route && req.route.path ? `${req.baseUrl || ''}${req.route.path}` : null;
  return template || (req.originalUrl || req.url || '').split('?')[0];
}

function record(req, res, store) {
  let repeated = 0;
  for (const n of store.keys.values()) if (n > 1) repeated += n - 1;
  const url = (req.originalUrl || req.url || '');
  out.write(JSON.stringify({
    t: new Date().toISOString(), kind: 'req', method: req.method, route: routeOf(req),
    path: url.split('?')[0], query: url.includes('?') ? url.split('?')[1].replace(/=([^&]*)/g, '=…') : '',
    status: res.statusCode, ms: +(nowMs() - store.start).toFixed(2), queries: store.queries,
    dbMs: +store.dbMs.toFixed(2), binding: store.binding, repeated, serializeMs: +store.serializeMs.toFixed(2),
    bytes: store.bytes, tag: req.headers['x-perf-tag'] || null,
  }) + '\n');
  if (sqlOut) sqlOut.write(JSON.stringify({ route: routeOf(req), method: req.method, tag: req.headers['x-perf-tag'] || null, sql: store.sql }) + '\n');
}

// --- pg queries --------------------------------------------------------------------------------
const pg = require(require.resolve('pg', { paths: [process.cwd()] }));
const query = pg.Client.prototype.query;
pg.Client.prototype.query = function (config, values, callback) {
  const store = als.getStore();
  if (!store) return query.apply(this, arguments);
  const text = typeof config === 'string' ? config : (config && config.text) || '';
  const params = Array.isArray(values) ? values : (config && config.values) || [];
  store.queries += 1;
  if (/^\s*(SET ROLE|RESET ROLE)/.test(text)) store.binding += 1;
  else if (!/^\s*(START TRANSACTION|BEGIN|COMMIT|ROLLBACK)/i.test(text)) {
    const key = `${text}\u0000${safeJson(params)}`;
    store.keys.set(key, (store.keys.get(key) || 0) + 1);
  }
  if (sqlOut) store.sql.push(text.replace(/\s+/g, ' ').slice(0, 400));
  const started = nowMs();
  const done = () => { store.dbMs += nowMs() - started; };
  const args = Array.from(arguments);
  const cbIndex = args.findIndex((a) => typeof a === 'function');
  if (cbIndex >= 0) {
    const cb = args[cbIndex];
    args[cbIndex] = function () { done(); return cb.apply(this, arguments); };
    return query.apply(this, args);
  }
  const result = query.apply(this, args);
  if (result && typeof result.then === 'function') result.then(done, done);
  return result;
};
function safeJson(v) { try { return JSON.stringify(v); } catch { return String(v); } }

// --- serialization (Express res.json: JSON.stringify + send) -----------------------------------
const express = require(require.resolve('express', { paths: [process.cwd()] }));
const json = express.response.json;
express.response.json = function () {
  const store = als.getStore();
  const started = nowMs();
  try { return json.apply(this, arguments); } finally { if (store) store.serializeMs += nowMs() - started; }
};

// --- optional CPU profile: PERF_PROFILE_DELAY_MS after boot, for PERF_PROFILE_MS, to <PERF_OUT>.cpuprofile
if (process.env.PERF_PROFILE_DELAY_MS) {
  const inspector = require('inspector');
  setTimeout(() => {
    const session = new inspector.Session();
    session.connect();
    session.post('Profiler.enable', () => session.post('Profiler.start', () => {
      setTimeout(() => session.post('Profiler.stop', (err, res) => {
        if (!err) fs.writeFileSync(`${OUT}.cpuprofile`, JSON.stringify(res.profile));
        session.disconnect();
      }), Number(process.env.PERF_PROFILE_MS || 60000));
    }));
  }, Number(process.env.PERF_PROFILE_DELAY_MS)).unref();
}

// --- runtime samples -------------------------------------------------------------------------
const loop = monitorEventLoopDelay({ resolution: 10 });
loop.enable();
let lastCpu = process.cpuUsage();
let lastAt = nowMs();
setInterval(() => {
  const cpu = process.cpuUsage(lastCpu);
  const at = nowMs();
  const mem = process.memoryUsage();
  out.write(JSON.stringify({
    t: new Date().toISOString(), kind: 'runtime',
    elP50: +(loop.percentile(50) / 1e6).toFixed(2), elP99: +(loop.percentile(99) / 1e6).toFixed(2), elMax: +(loop.max / 1e6).toFixed(2),
    cpuPct: +(((cpu.user + cpu.system) / 1000 / (at - lastAt)) * 100).toFixed(1),
    heapMb: +(mem.heapUsed / 1048576).toFixed(1), rssMb: +(mem.rss / 1048576).toFixed(1),
  }) + '\n');
  loop.reset(); lastCpu = process.cpuUsage(); lastAt = at;
}, 5000).unref();
