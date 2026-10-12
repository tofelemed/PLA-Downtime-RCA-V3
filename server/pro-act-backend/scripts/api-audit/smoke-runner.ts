/**
 * Live smoke test of the routes the frontend calls. Reads: called as an allowed persona with resolved
 * ids, expecting 2xx, and once more with an absent id, expecting 404. Mutations: never executed
 * against real data — path ids are a uuid no row has, and an empty body is sent only where the DTO has
 * required fields, so the expected answer is a validation error (400/422) or "not found" from the
 * handler, never a 404 "Cannot …" or a 5xx.
 */
import { randomUUID } from 'crypto';
import { ApiResponse, ApiSession, Persona } from './api-session';
import {
  BackendRoute,
  FrontendCall,
  HttpMethod,
  SmokeResult,
} from './audit-types';
import { ParamResolver } from './param-resolver';

/** A uuid no row has (version 4 layout, so ParseUUIDPipe accepts it). */
export const ABSENT_ID = '00000000-0000-4000-8000-0000a0d17000';

export interface LiveTarget {
  method: HttpMethod;
  route: BackendRoute;
  calls: FrontendCall[];
}

/** `{tenantId}` is the acting tenant (an absent one is refused as "tenant mismatch" before any lookup). */
const isTenantParam = (name: string) => name === 'tenantId';
const isAbsentIdParam = (name: string) =>
  /id$/i.test(name) && !isTenantParam(name);

function paramsOf(path: string): string[] {
  return [...path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
}

function fieldErrorNames(body: unknown): string[] {
  const errors = (body as { fieldErrors?: Array<{ field?: unknown }> } | null)
    ?.fieldErrors;
  return Array.isArray(errors)
    ? errors
        .map((e) => (typeof e.field === 'string' ? e.field : ''))
        .filter(Boolean)
    : [];
}

const isValidationStatus = (status: number) => status === 400 || status === 422;

export class SmokeRunner {
  constructor(
    private readonly session: ApiSession,
    private readonly resolver: ParamResolver,
  ) {}

  /** Path with every id replaced by one no row has (`{tenantId}` stays the acting tenant). */
  absentPath(template: string): string {
    return template.replace(/\{([^}]+)\}/g, (_m, name: string) => {
      if (isTenantParam(name)) return this.session.tenantId;
      if (/id$/i.test(name)) return ABSENT_ID;
      if (/version|revision/i.test(name)) return '999999';
      return 'api-audit-absent';
    });
  }

  private result(
    target: LiveTarget,
    persona: Persona,
    url: string,
    kind: SmokeResult['kind'],
  ) {
    return (response: ApiResponse, note = ''): SmokeResult => ({
      method: target.method,
      path: target.route.path,
      url,
      persona: persona.key,
      kind,
      status: response.status,
      ms: response.ms,
      bytes: response.bytes,
      note,
      error: response.error,
    });
  }

  skipped(
    target: LiveTarget,
    note: string,
    status: number | null = null,
  ): SmokeResult {
    return {
      method: target.method,
      path: target.route.path,
      url: '',
      persona: '',
      kind: 'skipped',
      status,
      ms: 0,
      bytes: 0,
      note,
      error: '',
    };
  }

  /**
   * GET with resolved ids; on 400/422 retried once with defaults for the query parameters the client
   * declares or the error names. Still 400/422 → "needs input" (not exercised), not a defect.
   */
  async read(target: LiveTarget): Promise<SmokeResult> {
    const resolved = await this.resolver.resolve(target.route.path);
    if ('missing' in resolved)
      return this.skipped(target, `no data to resolve {${resolved.missing}}`);
    const persona = this.session.pick(target.route.roles, false);
    const done = this.result(target, persona, resolved.path, 'read');
    const path = resolved.path;
    const first = await this.session.send({ method: 'GET', path, persona });
    if (!isValidationStatus(first.status)) return done(first);
    const fields = [
      ...new Set([
        ...target.calls.flatMap((c) => c.queryFields),
        ...fieldErrorNames(first.body),
      ]),
    ];
    const v1 = !target.route.path.startsWith('/api/v2/');
    const query = this.resolver.defaults(fields, v1);
    const second = Object.keys(query).length
      ? await this.session.send({ method: 'GET', path, query, persona })
      : first;
    if (isValidationStatus(second.status))
      return this.skipped(
        target,
        `needs input: ${second.error}`,
        second.status,
      );
    return done(second, `query: ${Object.keys(query).join(', ')}`);
  }

  /** A GET by id with an id no row has: expected 404 (a 2xx tells the screen an empty row exists). */
  async absentRead(target: LiveTarget): Promise<SmokeResult | null> {
    if (!paramsOf(target.route.path).some(isAbsentIdParam)) return null;
    const persona = this.session.pick(target.route.roles, false);
    const url = this.absentPath(target.route.path);
    const response = await this.session.send({
      method: 'GET',
      path: url,
      persona,
    });
    return this.result(
      target,
      persona,
      url,
      'validation',
    )(response, 'absent id');
  }

  /** Why a mutation is not probed, or null when the probe cannot change data. */
  static unsafeReason(target: LiveTarget): string | null {
    const params = paramsOf(target.route.path);
    if ((target.route.body?.required.length ?? 0) > 0) return null;
    if (params.some(isAbsentIdParam)) return null;
    if (target.method === 'DELETE' && params.length) return null;
    if (target.method === 'DELETE')
      return 'DELETE without an id would act on real data';
    if (!params.length || params.every(isTenantParam))
      return 'no required body field: an empty request would execute the command';
    return `{${params.join('}, {')}} is not an id: an absent key could be created (upsert)`;
  }

  private headersFor(target: LiveTarget): Record<string, string> {
    const headers: Record<string, string> = {};
    if (target.method === 'POST') headers['Idempotency-Key'] = randomUUID();
    if (target.route.requiresIfMatch) headers['If-Match'] = '"1"';
    return headers;
  }

  /** Mutation reachability: absent ids, empty body, the headers the route requires. */
  async probe(target: LiveTarget): Promise<SmokeResult> {
    const reason = SmokeRunner.unsafeReason(target);
    if (reason) return this.skipped(target, reason);
    const persona = this.session.pick(target.route.roles, true);
    const url = this.absentPath(target.route.path);
    const response = await this.session.send({
      method: target.method,
      path: url,
      persona,
      body: target.method === 'DELETE' ? undefined : {},
      headers: this.headersFor(target),
    });
    return this.result(target, persona, url, 'validation')(response);
  }

  /** Sends only the fields the DTO does not whitelist: forbidNonWhitelisted answers 400 before any handler. */
  async confirmRejected(
    target: LiveTarget,
    fields: string[],
  ): Promise<SmokeResult> {
    const persona = this.session.pick(target.route.roles, true);
    const url = this.absentPath(target.route.path);
    const response = await this.session.send({
      method: target.method,
      path: url,
      persona,
      body: Object.fromEntries(fields.map((f) => [f, 'api-audit'])),
      headers: this.headersFor(target),
    });
    const rejected = fields.filter((f) =>
      response.error.includes(`property ${f} should not exist`),
    );
    const note = `rejected: ${rejected.join(', ') || 'none'}`;
    return this.result(target, persona, url, 'validation')(response, note);
  }
}
