/** The PI open-frame sentinel the simulator delivers for frames still running (D02 default). */
export const OPEN_SENTINEL = '9999-12-31T23:59:59Z';

/** One event frame held by the simulator; `attributes` are served by `streamsets/{webId}/value`. */
export interface SimFrame {
  WebId: string;
  Name: string;
  TemplateName: string;
  StartTime: string;
  /** an ISO time, or `OPEN_SENTINEL` while the frame runs */
  EndTime: string;
  databaseWebId: string;
  PrimaryReferencedElement: { WebId: string; Path: string | null } | null;
  attributes: Record<string, unknown>;
}

export interface SimElement {
  WebId: string;
  Path: string;
  TemplateName?: string;
}

/**
 * How the simulator shapes frames and elements. `compact` is the historical test shape (an embedded
 * `PrimaryReferencedElement` object, millisecond times); `piwebapi` is what a real PI Web API answers:
 * the primary element only as `Links.PrimaryReferencedElement` and in `RefElementWebIds`, the event frame
 * `Path`, `Id`, `Links` and times with up to seven fractional digits.
 */
export type SimShape = 'compact' | 'piwebapi';

/** An injected failure: answers `status` to matching requests, `remaining` times. */
export interface SimFailure {
  match: (request: SimRequest) => boolean;
  status: number;
  remaining: number;
}

export interface SimRequest {
  method: string;
  path: string;
  query: URLSearchParams;
}

/** `\\srv\db\a` and `//srv/db/a` and `\\SRV\db/a` are the same element path. */
export function pathKey(path: string): string {
  return path.replace(/\//g, '\\').replace(/^\\+/, '').toLowerCase();
}

/** The frame as the PI Web API search answers it (no attribute values). */
export function frameView(frame: SimFrame): Record<string, unknown> {
  return {
    WebId: frame.WebId,
    Name: frame.Name,
    TemplateName: frame.TemplateName,
    StartTime: frame.StartTime,
    EndTime: frame.EndTime,
    PrimaryReferencedElement: frame.PrimaryReferencedElement,
  };
}

/** Where the `piwebapi` shape points its links and paths. */
export interface SimSite {
  origin: string;
  assetServerName: string;
  databaseName: string;
}

/** PI Web API time text: whole seconds as `…:SSZ`, otherwise seven fractional digits (`….1230000Z`). */
export function piTime(iso: string): string {
  if (iso === OPEN_SENTINEL) return iso;
  const text = new Date(iso).toISOString();
  return text.endsWith('.000Z')
    ? text.replace('.000Z', 'Z')
    : text.replace(/\.(\d{3})Z$/, '.$10000Z');
}

/** A stable GUID-like `Id` derived from a WebId (the simulator keeps no separate ids). */
function idOf(webId: string): string {
  const hex = Buffer.from(webId).toString('hex').padEnd(32, '0').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** The frame as a real PI Web API search answers it (`shape = piwebapi`). */
export function piWebApiFrameView(
  frame: SimFrame,
  site: SimSite,
): Record<string, unknown> {
  const api = `${site.origin}/piwebapi`;
  const element = frame.PrimaryReferencedElement?.WebId ?? null;
  const self = `${api}/eventframes/${frame.WebId}`;
  return {
    WebId: frame.WebId,
    Id: idOf(frame.WebId),
    Name: frame.Name,
    Description: '',
    Path: `\\\\${site.assetServerName}\\${site.databaseName}\\EventFrames[${frame.Name}]`,
    TemplateName: frame.TemplateName,
    HasChildren: false,
    CategoryNames: [],
    ExtendedProperties: {},
    StartTime: piTime(frame.StartTime),
    EndTime: piTime(frame.EndTime),
    Severity: 'None',
    AcknowledgedBy: '',
    IsAcknowledged: false,
    CanBeAcknowledged: false,
    IsAnnotated: false,
    IsLocked: false,
    AreValuesCaptured: frame.EndTime !== OPEN_SENTINEL,
    RefElementWebIds: element ? [element] : [],
    Security: {
      CanAnnotate: false,
      CanDelete: false,
      CanExecute: false,
      CanRead: true,
      CanWrite: false,
    },
    Links: {
      Self: self,
      Attributes: `${self}/attributes`,
      EventFrames: `${self}/eventframes`,
      Database: `${api}/assetdatabases/${frame.databaseWebId}`,
      ReferencedElements: `${self}/referencedelements`,
      ...(element
        ? { PrimaryReferencedElement: `${api}/elements/${element}` }
        : {}),
      Template: `${api}/elementtemplates/${encodeURIComponent(frame.TemplateName)}`,
      Value: `${api}/streamsets/${frame.WebId}/value`,
    },
  };
}

/** An AF element as a real PI Web API answers it (`shape = piwebapi`). */
export function piWebApiElementView(
  element: SimElement,
  origin: string,
): Record<string, unknown> {
  const self = `${origin}/piwebapi/elements/${element.WebId}`;
  const segments = element.Path.split(/[\\/]/).filter(Boolean);
  return {
    WebId: element.WebId,
    Id: idOf(element.WebId),
    Name: segments[segments.length - 1] ?? element.WebId,
    Description: '',
    Path: element.Path,
    TemplateName: element.TemplateName ?? '',
    HasChildren: false,
    CategoryNames: [],
    ExtendedProperties: {},
    Links: {
      Self: self,
      Attributes: `${self}/attributes`,
      Elements: `${self}/elements`,
    },
  };
}

/** `searchMode=Overlapped`: the frame's span intersects `[start, end)`; open frames never end. */
export function overlaps(frame: SimFrame, start: number, end: number): boolean {
  const frameStart = Date.parse(frame.StartTime);
  const frameEnd =
    frame.EndTime === OPEN_SENTINEL ? Infinity : Date.parse(frame.EndTime);
  return frameStart < end && frameEnd > start;
}
