import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PiEventFrame } from '../pi-frame-ingest.service';
import { isOpenEndTime } from './pi-time';

/** The connection a tracker change belongs to. */
export interface TrackerScope {
  tenantId: string;
  connectionId: string;
}

/**
 * The open-frame tracker (PI03, T08): frames read open are upserted (raw sentinel kept, poll time
 * stamped), frames read closed leave it. Bulk statements, one per call.
 */
@Injectable()
export class PiOpenFrameStore {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Tracks the open frames of a read and drops the closed ones. */
  async observe(scope: TrackerScope, frames: PiEventFrame[]): Promise<void> {
    const open = uniqueByWebId(
      frames.filter((frame) => isOpenEndTime(frame.EndTime)),
    );
    const closed = frames.filter((frame) => !isOpenEndTime(frame.EndTime));
    if (open.length > 0) await this.upsert(scope, open);
    await this.forget(
      scope.connectionId,
      closed.map((frame) => frame.WebId),
    );
  }

  /** Tracked WebIds, least recently polled first. */
  async due(connectionId: string, limit: number): Promise<string[]> {
    const rows: Array<{ web_id: string }> = await this.dataSource.query(
      `SELECT "web_id" FROM "pi_open_frames" WHERE "connection_id" = $1
        ORDER BY "last_polled_at" ASC NULLS FIRST, "first_seen" ASC LIMIT $2`,
      [connectionId, limit],
    );
    return rows.map((row) => row.web_id);
  }

  /** Marks tracked frames as polled (also those PI no longer finds; the inventory job decides). */
  async touch(connectionId: string, webIds: string[]): Promise<void> {
    if (webIds.length === 0) return;
    await this.dataSource.query(
      `UPDATE "pi_open_frames" SET "last_polled_at" = now()
        WHERE "connection_id" = $1 AND "web_id" = ANY($2::text[])`,
      [connectionId, webIds],
    );
  }

  async forget(connectionId: string, webIds: string[]): Promise<void> {
    if (webIds.length === 0) return;
    await this.dataSource.query(
      `DELETE FROM "pi_open_frames" WHERE "connection_id" = $1 AND "web_id" = ANY($2::text[])`,
      [connectionId, webIds],
    );
  }

  private async upsert(
    scope: TrackerScope,
    frames: PiEventFrame[],
  ): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO "pi_open_frames" ("tenant_id", "connection_id", "web_id", "start_time", "raw_end_time", "last_polled_at")
       SELECT $1, $2, "f"."web_id", "f"."start_time", "f"."raw_end_time", now()
         FROM unnest($3::text[], $4::timestamptz[], $5::text[]) AS "f"("web_id", "start_time", "raw_end_time")
       ON CONFLICT ("connection_id", "web_id") DO UPDATE
          SET "raw_end_time" = EXCLUDED."raw_end_time", "start_time" = EXCLUDED."start_time",
              "last_polled_at" = now()`,
      [
        scope.tenantId,
        scope.connectionId,
        frames.map((frame) => frame.WebId),
        frames.map((frame) => new Date(frame.StartTime).toISOString()),
        frames.map((frame) => frame.EndTime ?? null),
      ],
    );
  }
}

function uniqueByWebId(frames: PiEventFrame[]): PiEventFrame[] {
  return [...new Map(frames.map((frame) => [frame.WebId, frame])).values()];
}
