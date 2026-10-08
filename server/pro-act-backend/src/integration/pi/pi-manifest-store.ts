import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PageOutcome } from './entities/pi-page-manifest.entity';
import { PiActiveWindow } from './pi-window-cursor';

/** Which page of which window of which job. */
export interface ManifestKey {
  tenantId: string;
  jobId: string;
  window: PiActiveWindow;
}

/**
 * Writes the page manifest of PI window reads (PI04): a row per job/window/page, `fetched` when PI
 * answered, `failed` when it did not (with the error), `committed` once the runner committed the
 * cursor after every record was accepted. A re-read of the same page bumps `attempts`.
 */
@Injectable()
export class PiManifestStore {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Records a page PI answered; returns the manifest id. */
  async fetched(key: ManifestKey, itemCount: number): Promise<string> {
    return this.upsert(key, { outcome: 'fetched', itemCount, error: null });
  }

  async failed(key: ManifestKey, error: string): Promise<void> {
    await this.upsert(key, {
      outcome: 'failed',
      itemCount: null,
      error: error.slice(0, 2000),
    });
  }

  async committed(id: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE "pi_page_manifests" SET "outcome" = 'committed', "updated_at" = now() WHERE "id" = $1`,
      [id],
    );
  }

  private async upsert(
    key: ManifestKey,
    row: {
      outcome: PageOutcome;
      itemCount: number | null;
      error: string | null;
    },
  ): Promise<string> {
    const rows: Array<{ id: string }> = await this.dataSource.query(
      `INSERT INTO "pi_page_manifests" ("tenant_id", "job_id", "window_start", "window_end", "page_index",
              "start_index", "item_count", "outcome", "error")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT ("job_id", "window_start", "window_end", "page_index") DO UPDATE
          SET "attempts" = "pi_page_manifests"."attempts" + 1, "item_count" = EXCLUDED."item_count",
              "outcome" = EXCLUDED."outcome", "error" = EXCLUDED."error", "updated_at" = now()
       RETURNING "id"`,
      [
        key.tenantId,
        key.jobId,
        key.window.start,
        key.window.end,
        key.window.page,
        key.window.startIndex,
        row.itemCount,
        row.outcome,
        row.error,
      ],
    );
    return rows[0].id;
  }
}
