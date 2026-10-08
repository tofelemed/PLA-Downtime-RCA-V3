import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { envInt } from '../../common/helpers/time-bounds';
import { ReadPage, ReadRequest } from '../../intake/adapters/adapter.interface';
import { piDeletionEnvelope } from '../pi-envelope';
import { PiFrameReader, PiSource } from './pi-frame-reader';
import { PiSearchScope, searchFramePage } from './pi-frame-search';
import { PiJobScope } from './pi-job-scope';
import { PiOpenFrameStore } from './pi-open-frame-store';
import { activeWindow, PiActiveWindow } from './pi-window-cursor';

/** What one inventory comparison found. */
export interface InventoryResult {
  listed: number;
  candidates: number;
  /** WebIds absent from the complete listing and answered 404 by PI */
  deleted: string[];
}

/**
 * Deletion detection by inventory comparison (PI06, T46). A deletion is confirmed only when (1) the
 * listing of every page of the window completed, (2) intake knows an active frame of the same template
 * overlapping the window that the listing lacks, and (3) PI answers 404 for that WebId. A failed or
 * partial listing or lookup throws: nothing is ever retracted from an incomplete comparison, and a
 * frame that still exists outside the job scope is left alone.
 */
@Injectable()
export class PiInventory {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly reader: PiFrameReader,
    private readonly openFrames: PiOpenFrameStore,
  ) {}

  /** `inventory` job read: one complete comparison per run; confirmed deletions become retractions. */
  async read(
    source: PiSource,
    request: ReadRequest,
    scope: PiJobScope & { search: PiSearchScope },
  ): Promise<ReadPage> {
    const window = activeWindow(
      { checkpoint: null, window: null },
      scope,
      new Date(),
    );
    const result = await this.compare(source, scope.search, window);
    const binding = {
      tenantId: request.connection.tenantId,
      connectionId: request.connection.id,
    };
    const confirmedAt = new Date();
    const correlationId = `pi-inventory:${request.jobId ?? 'adhoc'}:${window.end}`;
    return {
      records: result.deleted.map((webId) =>
        piDeletionEnvelope(binding, {
          webId,
          confirmedAt,
          window: { start: window.start, end: window.end },
          correlationId,
        }),
      ),
      nextCursor: {
        checkpoint: window.end,
        lastInventory: {
          listed: result.listed,
          candidates: result.candidates,
          deleted: result.deleted.length,
        },
      },
      hasMore: false,
      onCommitted: () =>
        this.openFrames.forget(request.connection.id, result.deleted),
    };
  }

  async compare(
    source: PiSource,
    search: PiSearchScope,
    window: PiActiveWindow,
  ): Promise<InventoryResult> {
    const listed = await this.listWebIds(source, search, window);
    const known = await this.knownWebIds(source, search, window);
    const absent = known.filter((webId) => !listed.has(webId));
    const confirmed =
      absent.length > 0
        ? (await this.reader.framesById(source, absent)).missing
        : [];
    return {
      listed: listed.size,
      candidates: known.length,
      deleted: confirmed,
    };
  }

  /** Every WebId PI lists for the window; any failed page throws. */
  private async listWebIds(
    source: PiSource,
    search: PiSearchScope,
    window: PiActiveWindow,
  ): Promise<Set<string>> {
    const pageSize = envInt('PI_INVENTORY_PAGE_SIZE', 1000);
    const listed = new Set<string>();
    for (let startIndex = 0; ; startIndex += pageSize) {
      const frames = await searchFramePage(source.client, search, {
        start: window.start,
        end: window.end,
        startIndex,
        maxCount: pageSize,
        selectedFields: 'Items.WebId',
      });
      frames.forEach((frame) => listed.add(frame.WebId));
      if (frames.length < pageSize) return listed;
    }
  }

  /** Active PI frames intake holds whose latest version overlaps the window (same template). */
  private async knownWebIds(
    source: PiSource,
    search: PiSearchScope,
    window: PiActiveWindow,
  ): Promise<string[]> {
    const rows: Array<{ source_object_id: string }> =
      await this.dataSource.query(
        `SELECT "so"."source_object_id" FROM "source_objects" "so"
           JOIN "raw_observations" "r" ON "r"."id" = "so"."latest_raw_id" AND "r"."received_at" = "so"."latest_received_at"
          WHERE "so"."tenant_id" = $1 AND "so"."connection_id" = $2 AND "so"."kind" = 'interval_event'
            AND "so"."state" = 'active'
            AND ("r"."payload"->>'startTime')::timestamptz < $4
            AND ("r"."payload"->>'endTime' IS NULL OR ("r"."payload"->>'endTime')::timestamptz > $3)
            AND ($5::text IS NULL OR "r"."payload"->'values'->>'templateName' = $5)`,
        [
          source.connection.tenantId,
          source.connection.id,
          window.start,
          window.end,
          search.templateName ?? null,
        ],
      );
    return rows.map((row) => row.source_object_id);
  }
}
