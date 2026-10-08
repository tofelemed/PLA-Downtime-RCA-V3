import { SimRequest } from './sim-model';

/** One archived value of a simulated PI stream. */
export interface SimValue {
  Timestamp: string;
  Value: unknown;
  UnitsAbbreviation?: string;
  Good?: boolean;
  Questionable?: boolean;
  Substituted?: boolean;
}

interface SimAnswer {
  status: number;
  body: unknown;
}

/**
 * Streams of the PI Web API simulator (plan 1.7, test data only): recorded values per WebId with archive
 * corrections, `streamsets/recorded` (Inside, maxCount per stream), `streams/{id}/summary` (time-weighted
 * Total, step, per `totalTimebaseSeconds`), and stream updates with markers that can be dropped or
 * switched off entirely (no updates controller → 404 on register).
 */
export class SimStreams {
  readonly values = new Map<string, SimValue[]>();
  /** every value added or corrected, in order (the update feed) */
  private readonly log = new Map<string, SimValue[]>();
  private readonly lostMarkers = new Set<string>();
  updatesSupported = true;
  totalTimebaseSeconds = 3600;

  add(webId: string, values: SimValue[]): void {
    const stream = this.values.get(webId) ?? [];
    for (const value of values) {
      const at = Date.parse(value.Timestamp);
      const index = stream.findIndex(
        (held) => Date.parse(held.Timestamp) === at,
      );
      if (index >= 0) stream[index] = value;
      else stream.push(value);
      this.logOf(webId).push(value);
    }
    stream.sort((a, b) => Date.parse(a.Timestamp) - Date.parse(b.Timestamp));
    this.values.set(webId, stream);
  }

  /** Archive correction: replaces the value at `timestamp`. */
  correct(webId: string, timestamp: string, value: unknown): void {
    const held = (this.values.get(webId) ?? []).find(
      (candidate) => Date.parse(candidate.Timestamp) === Date.parse(timestamp),
    );
    if (!held)
      throw new Error(`simulator has no value of ${webId} at ${timestamp}`);
    this.add(webId, [{ ...held, Value: value }]);
  }

  /** Every marker handed out so far becomes unknown to the server (expired / server restart). */
  dropMarkers(): void {
    for (const [webId, log] of this.log) {
      for (let index = 0; index <= log.length; index++)
        this.lostMarkers.add(`${webId}:${index}`);
    }
  }

  routeGet(request: SimRequest, parts: string[]): SimAnswer | null {
    const [controller, id, action] = parts;
    if (controller === 'streamsets' && id === 'recorded')
      return this.recorded(request.query);
    if (controller === 'streams' && id === 'updates' && action)
      return this.poll(action);
    if (controller === 'streams' && action === 'summary')
      return this.summary(id, request.query);
    return null;
  }

  routePost(parts: string[]): SimAnswer | null {
    const [controller, id, action] = parts;
    if (controller !== 'streams' || action !== 'updates') return null;
    if (!this.updatesSupported)
      return { status: 404, body: { Errors: ['No stream updates'] } };
    if (!this.values.has(id))
      return { status: 404, body: { Errors: [`stream ${id} not found`] } };
    const marker = `${id}:${this.logOf(id).length}`;
    return {
      status: 202,
      body: { Source: id, Status: 'Succeeded', LatestMarker: marker },
    };
  }

  private recorded(query: URLSearchParams): SimAnswer {
    const start = Date.parse(query.get('startTime') ?? '');
    const end = Date.parse(query.get('endTime') ?? '');
    const maxCount = Number(query.get('maxCount') ?? 1000);
    const items = query.getAll('webId').map((webId) => {
      const stream = this.values.get(webId);
      if (!stream)
        return {
          WebId: webId,
          Items: [],
          Errors: [`stream ${webId} not found`],
        };
      const inside = stream.filter((value) => {
        const at = Date.parse(value.Timestamp);
        return at >= start && at <= end;
      });
      return { WebId: webId, Items: inside.slice(0, maxCount) };
    });
    return { status: 200, body: { Items: items } };
  }

  private poll(marker: string): SimAnswer {
    const [webId, position] = marker.split(':');
    const log = this.log.get(webId);
    if (!log || this.lostMarkers.has(marker)) {
      return { status: 400, body: { Errors: ['Marker not found or expired'] } };
    }
    const events = log
      .slice(Number(position))
      .map((value) => ({ ...value, Action: 'Add' }));
    return {
      status: 200,
      body: {
        Source: webId,
        Status: 'Succeeded',
        Events: events,
        LatestMarker: `${webId}:${log.length}`,
      },
    };
  }

  /** Step time-weighted total per interval: Σ value × seconds / totalTimebaseSeconds. */
  private summary(webId: string, query: URLSearchParams): SimAnswer {
    const stream = this.values.get(webId);
    if (!stream)
      return { status: 404, body: { Errors: [`stream ${webId} not found`] } };
    const start = Date.parse(query.get('startTime') ?? '');
    const end = Date.parse(query.get('endTime') ?? '');
    const minutes = Number(
      (query.get('summaryDuration') ?? '60m').replace(/m$/, ''),
    );
    const items: unknown[] = [];
    for (let from = start; from < end; from += minutes * 60_000) {
      const to = from + minutes * 60_000;
      items.push({
        Type: 'Total',
        Value: {
          Timestamp: new Date(from).toISOString(),
          Value: this.total(stream, from, to),
          UnitsAbbreviation: 't',
          Good: true,
        },
      });
    }
    return { status: 200, body: { Links: {}, Items: items } };
  }

  private total(stream: SimValue[], from: number, to: number): number {
    let total = 0;
    stream.forEach((value, index) => {
      const next = stream[index + 1];
      const a = Math.max(Date.parse(value.Timestamp), from);
      const b = Math.min(next ? Date.parse(next.Timestamp) : to, to);
      if (b > a)
        total +=
          (Number(value.Value) * (b - a)) / 1000 / this.totalTimebaseSeconds;
    });
    return total;
  }

  private logOf(webId: string): SimValue[] {
    const log = this.log.get(webId) ?? [];
    this.log.set(webId, log);
    return log;
  }
}
