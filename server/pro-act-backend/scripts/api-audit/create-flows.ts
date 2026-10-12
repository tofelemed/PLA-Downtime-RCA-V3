/**
 * Additive create → read-back flows of the audit. Each creates one clearly named `AUDIT-<date>` record
 * through the same route the frontend uses and reads it back; nothing is updated or deleted (the owner
 * keeps the records). Only flows without side effects on other users' work are listed here.
 */
import { randomUUID } from 'crypto';
import { ApiSession, Persona } from './api-session';
import { SmokeResult } from './audit-types';

interface CreateFlow {
  label: string;
  persona: string;
  path: string;
  /** read-back path; `{id}` is the created id */
  readBack: string;
  body: (ctx: FlowContext) => Record<string, unknown>;
}

interface FlowContext {
  stamp: string;
  userId: string;
  organizationId: string;
  tenantId: string;
}

const FLOWS: CreateFlow[] = [
  {
    label: 'task assigned to the auditing user',
    persona: 'noah',
    path: '/api/tasks',
    readBack: '/api/tasks/{id}',
    body: (c) => ({
      title: `${c.stamp} API usage audit task`,
      description:
        'Created by npm run api:audit (docs/API_USAGE_AUDIT.md). Safe to close.',
      assignedTo: c.userId,
      assignedBy: c.userId,
      priority: 'Low',
      status: 'Open',
      entityType: 'General',
      organizationId: c.organizationId,
      tenantId: c.tenantId,
    }),
  },
  {
    label: 'RCA case (v2)',
    persona: 'viktor',
    path: '/api/v2/rcas',
    readBack: '/api/v2/rcas/{id}',
    body: (c) => ({
      title: `${c.stamp} API usage audit RCA`,
      description:
        'Created by npm run api:audit (docs/API_USAGE_AUDIT.md). No events linked.',
    }),
  },
];

function idOf(body: unknown): string {
  const record = (body ?? {}) as Record<string, unknown>;
  const inner = (record.data ?? {}) as Record<string, unknown>;
  const id = record.id ?? inner.id;
  return typeof id === 'string' || typeof id === 'number' ? String(id) : '';
}

function titleOf(body: unknown): string {
  const record = (body ?? {}) as Record<string, unknown>;
  const inner = (record.data ?? {}) as Record<string, unknown>;
  const title = record.title ?? inner.title;
  return typeof title === 'string' ? title : '';
}

function row(
  kind: SmokeResult['kind'],
  path: string,
  url: string,
  persona: Persona,
): (
  r: { status: number; ms: number; bytes: number; error: string },
  note: string,
) => SmokeResult {
  return (r, note) => ({
    method: kind === 'create' ? 'POST' : 'GET',
    path,
    url,
    persona: persona.key,
    kind,
    status: r.status,
    ms: r.ms,
    bytes: r.bytes,
    note,
    error: r.error,
  });
}

async function runFlow(
  session: ApiSession,
  flow: CreateFlow,
  stamp: string,
): Promise<SmokeResult[]> {
  const persona = session.persona(flow.persona);
  const login = await session.identity(persona);
  const ctx = {
    stamp,
    userId: login.userId,
    organizationId: login.organizationId,
    tenantId: session.tenantId,
  };
  const created = await session.send({
    method: 'POST',
    path: flow.path,
    persona,
    body: flow.body(ctx),
    headers: { 'Idempotency-Key': randomUUID() },
  });
  const id = idOf(created.body);
  const out = [
    row(
      'create',
      flow.path,
      flow.path,
      persona,
    )(created, `${flow.label}${id ? ` → ${id}` : ''}`),
  ];
  if (!id) return out;
  const url = flow.readBack.replace('{id}', encodeURIComponent(id));
  const read = await session.send({ method: 'GET', path: url, persona });
  const same =
    titleOf(read.body) === titleOf(created.body) && titleOf(read.body) !== '';
  out.push(
    row(
      'readback',
      flow.readBack,
      url,
      persona,
    )(
      read,
      same ? 'read back: title matches' : 'read back: title differs or missing',
    ),
  );
  return out;
}

/** Runs every flow once; `AUDIT-YYYY-MM-DD` names the records. */
export async function runCreateFlows(
  session: ApiSession,
  date: string,
): Promise<SmokeResult[]> {
  const results: SmokeResult[] = [];
  for (const flow of FLOWS)
    results.push(...(await runFlow(session, flow, `AUDIT-${date}`)));
  return results;
}
