import { PiEventFrame } from '../pi-frame-ingest.service';
import { PiHttpClient, PiRequestError } from './pi-http-client';

const DEFAULT_TTL_MS = 10 * 60_000;
const MAX_ENTRIES = 20_000;

/**
 * AF path in one form: `\` separators (a `/` is the same separator, ING03 mixed separators), repeated
 * separators collapsed, the `\\server` prefix kept.
 */
export function normalizeAfPath(path: string): string {
  const body = path.replace(/\//g, '\\').replace(/^\\+/, '');
  return `\\\\${body.replace(/\\+/g, '\\').replace(/\\$/, '')}`;
}

/**
 * Paths of the ancestors of an AF element below its database, closest first:
 * `\\srv\db\Plant\Line\Unit` → `\\srv\db\Plant\Line`, `\\srv\db\Plant`.
 */
export function ancestorPaths(path: string): string[] {
  const segments = normalizeAfPath(path).slice(2).split('\\');
  const paths: string[] = [];
  for (let length = segments.length - 1; length >= 3; length--) {
    paths.push(`\\\\${segments.slice(0, length).join('\\')}`);
  }
  return paths;
}

/**
 * Ancestor WebIds of each frame's primary element (plan 1.3 hand-off: mapping walks element → ancestors,
 * so a binding on a line also places frames of its units). Element paths and WebIds are looked up by
 * path (`elements?path=`) or by WebId when the frame carries no path, and cached per connection with a
 * TTL (`PI_ELEMENT_CACHE_TTL_MS`, 10 min); the cache is cleared when it grows past 20 000 entries. A
 * path PI does not know is cached as absent; any other lookup failure fails the page.
 */
export class PiAncestorResolver {
  private readonly cache = new Map<
    string,
    { value: string | null; expires: number }
  >();

  constructor(private readonly ttlMs = DEFAULT_TTL_MS) {}

  /** Ancestor WebIds (closest first) by frame WebId; frames without a primary element get none. */
  async resolve(
    client: PiHttpClient,
    connectionId: string,
    frames: PiEventFrame[],
  ): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>();
    for (const frame of frames) {
      const path = await this.primaryPath(client, connectionId, frame);
      const ancestors: string[] = [];
      for (const ancestor of path ? ancestorPaths(path) : []) {
        const webId = await this.lookup(client, connectionId, {
          kind: 'path',
          key: ancestor,
        });
        if (webId) ancestors.push(webId);
      }
      result.set(frame.WebId, ancestors);
    }
    return result;
  }

  private async primaryPath(
    client: PiHttpClient,
    connectionId: string,
    frame: PiEventFrame,
  ): Promise<string | null> {
    const primary = frame.PrimaryReferencedElement;
    if (primary?.Path) return primary.Path;
    if (!primary?.WebId) return null;
    return this.lookup(client, connectionId, {
      kind: 'webId',
      key: primary.WebId,
    });
  }

  /** `path` → element WebId, `webId` → element path; null when PI does not know it. */
  private async lookup(
    client: PiHttpClient,
    connectionId: string,
    query: { kind: 'path' | 'webId'; key: string },
  ): Promise<string | null> {
    const cacheKey = `${connectionId}|${query.kind}|${query.key.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.value;
    const value = await fetchElement(client, query);
    if (this.cache.size >= MAX_ENTRIES) this.cache.clear();
    this.cache.set(cacheKey, { value, expires: Date.now() + this.ttlMs });
    return value;
  }
}

async function fetchElement(
  client: PiHttpClient,
  query: { kind: 'path' | 'webId'; key: string },
): Promise<string | null> {
  try {
    if (query.kind === 'path') {
      const element = await client.get<{ WebId?: unknown }>('elements', {
        path: normalizeAfPath(query.key),
        selectedFields: 'WebId',
      });
      return typeof element?.WebId === 'string' ? element.WebId : null;
    }
    const element = await client.get<{ Path?: unknown }>(
      `elements/${encodeURIComponent(query.key)}`,
      { selectedFields: 'WebId;Path' },
    );
    return typeof element?.Path === 'string' ? element.Path : null;
  } catch (error) {
    if (error instanceof PiRequestError && error.kind === 'not_found') {
      return null;
    }
    throw error;
  }
}
