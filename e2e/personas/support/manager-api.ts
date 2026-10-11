import { randomUUID } from 'node:crypto';

/**
 * Thin API client for the persona specs: like `call` / `command` of e2e/test-utils/downtime-world.ts but
 * returning the response headers too (ETag → `If-Match`). Only `GET`s and the persona's own writes are
 * sent; nothing is ever deleted or retired.
 */
const API = process.env.VITE_API_BASE_URL || 'http://localhost:4004/api';

export interface ApiReply<T> {
  status: number;
  body: T;
  headers: Headers;
}

export async function api<T>(token: string, method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<ApiReply<T>> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : undefined) as T, headers: response.headers };
}

/** POST with a fresh `Idempotency-Key` (every v2 command needs one). */
export const post = <T>(token: string, path: string, body: unknown, headers: Record<string, string> = {}): Promise<ApiReply<T>> =>
  api<T>(token, 'POST', path, body, { 'Idempotency-Key': randomUUID(), ...headers });

/** Resolves the body of a 2xx reply, otherwise throws with the status and body. */
export async function ok<T>(pending: Promise<ApiReply<T>>, what: string): Promise<T> {
  const reply = await pending;
  if (reply.status >= 300) throw new Error(`${what}: ${reply.status} ${JSON.stringify(reply.body)}`);
  return reply.body;
}

/** Id of a created resource (201 / 200 / 202 with `id` or `jobId`). */
export async function created(pending: Promise<ApiReply<{ id?: string; jobId?: string }>>, what: string): Promise<string> {
  const body = await ok(pending, what);
  const id = body.id ?? body.jobId;
  if (!id) throw new Error(`${what}: no id in ${JSON.stringify(body)}`);
  return id;
}

/** Polls `probe` once a second until it returns a value (not null). */
export async function until<T>(what: string, probe: () => Promise<T | null>, attempts = 90): Promise<T> {
  for (let i = 0; i < attempts; i += 1) {
    const value = await probe();
    if (value !== null) return value;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`timed out waiting for ${what}`);
}

/** Items of a v2 list reply (`{ items }`) or a v1 array. */
export function itemsOf<T>(body: T[] | { items?: T[] } | undefined): T[] {
  if (!body) return [];
  return Array.isArray(body) ? body : (body.items ?? []);
}
