/**
 * Fills path parameters and query defaults for the live smoke test from the data that exists: each
 * `{param}` is read from the first item of the collection the path names (`/plans/{id}/versions`
 * → GET `/plans`), never hard-coded. Results are cached per collection.
 */
import { ApiSession, Persona } from './api-session';

const LOOKBACK_DAYS = 30;

function itemsOf(body: unknown): Record<string, unknown>[] {
  const pick = (value: unknown): unknown[] | null =>
    Array.isArray(value) ? value : null;
  const record =
    body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const inner =
    record.data && typeof record.data === 'object'
      ? (record.data as Record<string, unknown>)
      : {};
  const list =
    pick(body) ??
    pick(record.items) ??
    pick(record.data) ??
    pick(inner.items) ??
    pick(record.results) ??
    [];
  return list.filter(
    (x): x is Record<string, unknown> => !!x && typeof x === 'object',
  );
}

function fieldFor(item: Record<string, unknown>, param: string): string | null {
  const candidates = [
    param,
    param === 'id' ? 'id' : '',
    param.endsWith('Id') ? 'id' : '',
    'id',
    'key',
  ];
  for (const name of candidates.filter(Boolean)) {
    const value = item[name];
    if (typeof value === 'string' || typeof value === 'number')
      return String(value);
  }
  return null;
}

export class ParamResolver {
  private readonly collections = new Map<string, Record<string, unknown>[]>();
  private globals: Record<string, string> = {};

  constructor(
    private readonly session: ApiSession,
    private readonly reader: Persona,
  ) {}

  /** Ids every screen needs: tenant, organization, current user, first unit and period. */
  async init(): Promise<void> {
    const login = await this.session.identity(this.reader);
    const units = await this.list('/api/v2/units');
    const periods = await this.list('/api/v2/production-periods');
    const events = await this.list('/api/v2/production-events');
    const first = (items: Record<string, unknown>[]) =>
      items.length ? (fieldFor(items[0], 'id') ?? '') : '';
    this.globals = {
      tenantId: this.session.tenantId,
      organizationId: login.organizationId,
      userId: login.userId,
      unitId: first(units),
      periodId: first(periods),
      eventId: first(events),
    };
  }

  global(name: string): string {
    return this.globals[name] ?? '';
  }

  async list(path: string): Promise<Record<string, unknown>[]> {
    const cached = this.collections.get(path);
    if (cached) return cached;
    let response = await this.session.send({
      method: 'GET',
      path,
      persona: this.reader,
    });
    if (response.status === 400 || response.status === 422) {
      const query = this.defaults(['from', 'to'], !path.startsWith('/api/v2/'));
      response = await this.session.send({
        method: 'GET',
        path,
        query,
        persona: this.reader,
      });
    }
    const items =
      response.status >= 200 && response.status < 300
        ? itemsOf(response.body)
        : [];
    this.collections.set(path, items);
    return items;
  }

  /** Concrete path, or the name of the parameter that could not be resolved. */
  async resolve(
    template: string,
  ): Promise<{ path: string } | { missing: string }> {
    const segments = template.split('/');
    for (let i = 0; i < segments.length; i += 1) {
      const match = /^\{(.+)\}$/.exec(segments[i]);
      if (!match) continue;
      const value = await this.valueFor(
        match[1],
        segments.slice(0, i).join('/'),
      );
      if (!value) return { missing: match[1] };
      segments[i] = encodeURIComponent(value);
    }
    return { path: segments.join('/') };
  }

  private async valueFor(
    param: string,
    collection: string,
  ): Promise<string | null> {
    const items = await this.list(collection);
    const fromList = items.length ? fieldFor(items[0], param) : null;
    return fromList ?? (this.globals[param] || null);
  }

  /** Query values for parameters a list needs (`from`/`to` = the last 30 days, first unit / period). */
  defaults(fields: string[], v1: boolean): Record<string, string> {
    const now = new Date();
    const from = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000);
    const table: Record<string, string> = {
      from: from.toISOString(),
      to: now.toISOString(),
      start: from.toISOString(),
      end: now.toISOString(),
      startDate: from.toISOString(),
      endDate: now.toISOString(),
      startTime: from.toISOString(),
      endTime: now.toISOString(),
      dateFrom: from.toISOString(),
      dateTo: now.toISOString(),
      unitId: this.globals.unitId,
      unitIds: this.globals.unitId,
      periodId: this.globals.periodId,
      periodIds: this.globals.periodId,
      eventId: this.globals.eventId,
      organizationId: this.globals.organizationId,
      days: String(LOOKBACK_DAYS),
      ...(v1 ? { tenantId: this.globals.tenantId } : {}),
    };
    const out: Record<string, string> = {};
    for (const field of fields) if (table[field]) out[field] = table[field];
    return out;
  }
}
