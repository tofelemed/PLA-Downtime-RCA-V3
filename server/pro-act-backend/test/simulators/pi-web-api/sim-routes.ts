import {
  frameView,
  overlaps,
  pathKey,
  piTime,
  piWebApiElementView,
  piWebApiFrameView,
  SimElement,
  SimFrame,
  SimRequest,
  SimShape,
} from './sim-model';

/** What the router reads from the simulator. */
export interface SimState {
  frames: Map<string, SimFrame>;
  elements: Map<string, SimElement>;
  assetServer: { Name: string; WebId: string };
  database: { Name: string; WebId: string };
  shape: SimShape;
  origin: string;
}

export interface SimAnswer {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

/** The frame in the simulator's response shape. */
function viewOf(state: SimState, frame: SimFrame): Record<string, unknown> {
  return state.shape === 'piwebapi'
    ? piWebApiFrameView(frame, {
        origin: state.origin,
        assetServerName: state.assetServer.Name,
        databaseName: state.database.Name,
      })
    : frameView(frame);
}

function elementViewOf(state: SimState, found: SimElement): unknown {
  return state.shape === 'piwebapi'
    ? piWebApiElementView(found, state.origin)
    : found;
}

const notFound = (what: string): SimAnswer => ({
  status: 404,
  body: { Errors: [`${what} not found`] },
});
const ok = (body: unknown): SimAnswer => ({ status: 200, body });

/** GET routes of the PI Web API subset the adapter uses (paths relative to `/piwebapi`). */
export function routeGet(state: SimState, request: SimRequest): SimAnswer {
  const parts = request.path.split('/').filter(Boolean).map(decodeURIComponent);
  const [controller, id, action] = parts;
  if (parts.length === 0) return ok({ Links: { Self: '/piwebapi/' } });
  if (controller === 'system') {
    return ok({ ProductTitle: 'PI Web API', ProductVersion: '1.13.0-sim' });
  }
  if (controller === 'assetservers') return assetServers(state, id, action);
  if (action === 'eventframes') return search(state, parts, request.query);
  if (controller === 'eventframes' && id) {
    const frame = state.frames.get(id);
    return frame ? ok(viewOf(state, frame)) : notFound(`event frame ${id}`);
  }
  if (controller === 'streamsets' && action === 'value') {
    return streamValues(state, id);
  }
  if (controller === 'elements') return element(state, id, request.query);
  return notFound(`route ${request.path}`);
}

function assetServers(
  state: SimState,
  id: string | undefined,
  action: string | undefined,
): SimAnswer {
  if (!id) return ok({ Items: [state.assetServer] });
  if (id === state.assetServer.WebId && action === 'assetdatabases') {
    return ok({ Items: [state.database] });
  }
  return notFound(`asset server ${id}`);
}

/** `assetdatabases/{id}/eventframes` and `elements/{id}/eventframes` with Overlapped paging. */
function search(
  state: SimState,
  parts: string[],
  query: URLSearchParams,
): SimAnswer {
  const [controller, scopeId] = parts;
  const start = Date.parse(query.get('startTime') ?? '');
  const end = Date.parse(query.get('endTime') ?? '');
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return { status: 400, body: { Errors: ['startTime/endTime required'] } };
  }
  const template = query.get('templateName');
  const inScope = (frame: SimFrame) =>
    controller === 'assetdatabases'
      ? frame.databaseWebId === scopeId
      : frame.PrimaryReferencedElement?.WebId === scopeId;
  const matching = [...state.frames.values()]
    .filter((frame) => inScope(frame) && overlaps(frame, start, end))
    .filter((frame) => !template || frame.TemplateName === template)
    .sort(
      (a, b) =>
        Date.parse(a.StartTime) - Date.parse(b.StartTime) ||
        a.WebId.localeCompare(b.WebId),
    );
  const startIndex = Number(query.get('startIndex') ?? 0);
  const maxCount = Number(query.get('maxCount') ?? 1000);
  const page = matching.slice(startIndex, startIndex + maxCount);
  const webIdsOnly = query.get('selectedFields') === 'Items.WebId';
  return ok({
    Items: page.map((frame) =>
      webIdsOnly ? { WebId: frame.WebId } : viewOf(state, frame),
    ),
  });
}

function streamValues(state: SimState, webId: string): SimAnswer {
  const frame = state.frames.get(webId);
  if (!frame) return notFound(`event frame ${webId}`);
  return ok({
    Items: Object.entries(frame.attributes).map(([Name, raw]) => ({
      WebId: `${webId}-${Name}`,
      Name,
      Value: {
        Timestamp: piTime(frame.StartTime),
        ...valueOf(raw),
        Good: true,
        Questionable: false,
        Substituted: false,
        Annotated: false,
      },
    })),
  });
}

/** `{ Value, UnitsAbbreviation }` in a fixture carries a unit; anything else is the bare value. */
function valueOf(raw: unknown): { Value: unknown; UnitsAbbreviation?: string } {
  if (raw && typeof raw === 'object' && 'UnitsAbbreviation' in raw) {
    const held = raw as { Value?: unknown; UnitsAbbreviation?: unknown };
    return {
      Value: held.Value ?? null,
      UnitsAbbreviation: String(held.UnitsAbbreviation),
    };
  }
  return { Value: raw };
}

function element(
  state: SimState,
  id: string | undefined,
  query: URLSearchParams,
): SimAnswer {
  if (id) {
    const found = state.elements.get(id);
    return found ? ok(elementViewOf(state, found)) : notFound(`element ${id}`);
  }
  const path = query.get('path');
  const key = path ? pathKey(path) : '';
  const match = [...state.elements.values()].find(
    (candidate) => pathKey(candidate.Path) === key,
  );
  return match
    ? ok(elementViewOf(state, match))
    : notFound(`element path ${path ?? ''}`);
}
