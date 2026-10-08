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
}

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

/** `searchMode=Overlapped`: the frame's span intersects `[start, end)`; open frames never end. */
export function overlaps(frame: SimFrame, start: number, end: number): boolean {
  const frameStart = Date.parse(frame.StartTime);
  const frameEnd =
    frame.EndTime === OPEN_SENTINEL ? Infinity : Date.parse(frame.EndTime);
  return frameStart < end && frameEnd > start;
}
