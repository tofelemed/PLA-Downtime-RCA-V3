import { Injectable } from '@nestjs/common';
import { ReadPage, ReadRequest } from '../../intake/adapters/adapter.interface';
import { piFrameEnvelope } from '../pi-envelope';
import { PiFrameReader, PiSource } from './pi-frame-reader';
import { PiOpenFrameStore } from './pi-open-frame-store';
import { isOpenEndTime } from './pi-time';

/**
 * `open_frames` reads (PI03, T08): up to one page of tracked open frames, least recently polled first,
 * re-read by WebId whatever the search window — so a frame that closes with an end time before the
 * current window, or started before the lookback, is still captured. A closure is an ordinary newer
 * revision for intake; the frame leaves the tracker only after the runner committed it. Frames PI no
 * longer finds stay tracked: only the inventory job may confirm a deletion (PI06).
 */
@Injectable()
export class PiOpenFrameRefresh {
  constructor(
    private readonly reader: PiFrameReader,
    private readonly openFrames: PiOpenFrameStore,
  ) {}

  async read(source: PiSource, request: ReadRequest): Promise<ReadPage> {
    const connectionId = request.connection.id;
    const webIds = await this.openFrames.due(connectionId, request.pageSize);
    const refreshedAt = new Date();
    if (webIds.length === 0) {
      return emptyPage(refreshedAt);
    }
    const { found, missing } = await this.reader.framesById(source, webIds);
    const payloads = await this.reader.payloads(source, found);
    await this.openFrames.touch(connectionId, webIds);
    const closed = found
      .filter((frame) => !isOpenEndTime(frame.EndTime))
      .map((frame) => frame.WebId);
    const binding = { tenantId: request.connection.tenantId, connectionId };
    const correlationId = `pi-open-frames:${refreshedAt.toISOString()}`;
    return {
      records: payloads.map((payload) =>
        piFrameEnvelope(binding, payload, { at: refreshedAt, correlationId }),
      ),
      nextCursor: {
        lastRefreshAt: refreshedAt.toISOString(),
        tracked: webIds.length,
        closed: closed.length,
        notFound: missing.length,
      },
      hasMore: false,
      onCommitted: () => this.openFrames.forget(connectionId, closed),
    };
  }
}

function emptyPage(at: Date): ReadPage {
  return {
    records: [],
    nextCursor: { lastRefreshAt: at.toISOString(), tracked: 0 },
    hasMore: false,
  };
}
