import { PiEventFrame } from '../pi-frame-ingest.service';
import { normalizeFrame } from './pi-frame-shape';
import { PiHttpClient, PiRequestError } from './pi-http-client';

/** Where a job searches: an AF database or element, optionally one template. */
export interface PiSearchScope {
  scopeType: 'database' | 'element';
  scopeId: string;
  templateName?: string | null;
}

/** One page of a time-window search. */
export interface PiSearchPage {
  start: string;
  end: string;
  startIndex: number;
  maxCount: number;
  /** e.g. `Items.WebId` for an inventory listing; omitted = full frames */
  selectedFields?: string;
}

/**
 * One page of event frames overlapping `[start, end)` (PI04/PI05): `searchMode=Overlapped` so frames
 * that started earlier and are still open (or closed inside the window) are included, sorted by start
 * time, paged by `startIndex`/`maxCount`. Frames are returned as PI delivered them.
 */
export async function searchFramePage(
  client: PiHttpClient,
  scope: PiSearchScope,
  page: PiSearchPage,
): Promise<PiEventFrame[]> {
  const params: Record<string, string | number> = {
    startTime: page.start,
    endTime: page.end,
    searchMode: 'Overlapped',
    sortField: 'StartTime',
    sortOrder: 'Ascending',
    startIndex: page.startIndex,
    maxCount: page.maxCount,
  };
  if (scope.templateName) params.templateName = scope.templateName;
  if (page.selectedFields) params.selectedFields = page.selectedFields;
  const reply = await client.get<{ Items?: unknown }>(
    framesPath(scope),
    params,
  );
  if (!Array.isArray(reply?.Items)) {
    throw new PiRequestError(
      'PI event frame search returned no Items array',
      'unavailable',
    );
  }
  return (reply.Items as PiEventFrame[]).map(normalizeFrame);
}

/** Every page of a window (v1 on-demand pull): reads until a page comes back short (PI04, I8). */
export async function searchAllFrames(
  client: PiHttpClient,
  scope: PiSearchScope,
  window: { start: string; end: string; pageSize: number },
): Promise<PiEventFrame[]> {
  const frames: PiEventFrame[] = [];
  for (let startIndex = 0; ; startIndex += window.pageSize) {
    const page = await searchFramePage(client, scope, {
      start: window.start,
      end: window.end,
      startIndex,
      maxCount: window.pageSize,
    });
    frames.push(...page);
    if (page.length < window.pageSize) return frames;
  }
}

function framesPath(scope: PiSearchScope): string {
  const id = encodeURIComponent(scope.scopeId);
  return scope.scopeType === 'database'
    ? `assetdatabases/${id}/eventframes`
    : `elements/${id}/eventframes`;
}
