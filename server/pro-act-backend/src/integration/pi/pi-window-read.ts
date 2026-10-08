import { Injectable } from '@nestjs/common';
import { ReadPage, ReadRequest } from '../../intake/adapters/adapter.interface';
import { piFrameEnvelope, PiFramePayload } from '../pi-envelope';
import { PiEventFrame } from '../pi-frame-ingest.service';
import { PiFrameReader, PiSource } from './pi-frame-reader';
import { PiSearchScope, searchFramePage } from './pi-frame-search';
import { PiJobScope } from './pi-job-scope';
import { ManifestKey, PiManifestStore } from './pi-manifest-store';
import { PiOpenFrameStore } from './pi-open-frame-store';
import {
  activeWindow,
  advanceWindow,
  PiActiveWindow,
  parseWindowCursor,
} from './pi-window-cursor';

/**
 * `window` and `rescan` reads (PI04, PI05): one page of the active window per call, attributes in
 * batch, every frame an envelope. The page manifest records the read (`fetched`/`failed`) and is
 * marked `committed` after the runner commits; the window checkpoint moves only after its last page.
 * Open frames seen here are added to the open-frame tracker (PI03).
 */
@Injectable()
export class PiWindowRead {
  constructor(
    private readonly reader: PiFrameReader,
    private readonly manifests: PiManifestStore,
    private readonly openFrames: PiOpenFrameStore,
  ) {}

  async read(
    source: PiSource,
    request: ReadRequest,
    scope: PiJobScope & { search: PiSearchScope },
  ): Promise<ReadPage> {
    const cursor = parseWindowCursor(request.cursor);
    const window = activeWindow(cursor, scope, new Date());
    const key = manifestKey(request, window);
    const { frames, payloads } = await this.fetchPage(source, {
      scope: scope.search,
      window,
      pageSize: request.pageSize,
      key,
    });
    await this.openFrames.observe(trackerOf(request), frames);
    const manifestId = key
      ? await this.manifests.fetched(key, frames.length)
      : null;
    const next = advanceWindow(cursor, window, {
      itemCount: frames.length,
      pageSize: request.pageSize,
    });
    const correlationId = `pi-job:${request.jobId ?? 'adhoc'}:${window.start}:${window.page}`;
    return {
      records: payloads.map((payload) =>
        piFrameEnvelope(bindingOf(request), payload, {
          at: new Date(),
          correlationId,
        }),
      ),
      nextCursor: { ...next.cursor },
      hasMore: !next.complete,
      onCommitted: manifestId
        ? () => this.manifests.committed(manifestId)
        : undefined,
    };
  }

  /** Search page + attributes; a failure is written to the manifest before it propagates. */
  private async fetchPage(
    source: PiSource,
    page: {
      scope: PiSearchScope;
      window: PiActiveWindow;
      pageSize: number;
      key: ManifestKey | null;
    },
  ): Promise<{ frames: PiEventFrame[]; payloads: PiFramePayload[] }> {
    try {
      const frames = await searchFramePage(source.client, page.scope, {
        start: page.window.start,
        end: page.window.end,
        startIndex: page.window.startIndex,
        maxCount: page.pageSize,
      });
      return { frames, payloads: await this.reader.payloads(source, frames) };
    } catch (error) {
      if (page.key) await this.manifests.failed(page.key, messageOf(error));
      throw error;
    }
  }
}

function manifestKey(
  request: ReadRequest,
  window: PiActiveWindow,
): ManifestKey | null {
  return request.jobId
    ? { tenantId: request.connection.tenantId, jobId: request.jobId, window }
    : null;
}

function trackerOf(request: ReadRequest) {
  return {
    tenantId: request.connection.tenantId,
    connectionId: request.connection.id,
  };
}

function bindingOf(request: ReadRequest) {
  return {
    tenantId: request.connection.tenantId,
    connectionId: request.connection.id,
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
