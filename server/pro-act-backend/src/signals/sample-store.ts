import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { SampleQualityValue } from './entities/measurement-sample.entity';

/** One sample to store (identity: signal + observed time + source revision). */
export interface NewSample {
  tenantId: string;
  signalId: string;
  observedAt: Date;
  value: string | null;
  stateName: string | null;
  stateValue: number | null;
  quality: SampleQualityValue;
  qualityFlags: string[] | null;
  rawId: string;
  rawReceivedAt: Date;
  sourceRevision: string;
}

/** One summary to store (identity: signal + period + source revision). */
export interface NewSummary {
  tenantId: string;
  signalId: string;
  periodStart: Date;
  periodEnd: Date;
  total: string | null;
  timebase: string;
  quality: SampleQualityValue;
  rawId: string;
  rawReceivedAt: Date;
  sourceRevision: string;
}

/** A stored sample as the engine and the preview read it (latest revision per timestamp). */
export interface StoredSample {
  observedAt: Date;
  value: string | null;
  stateName: string | null;
  quality: SampleQualityValue;
  sourceRevision: string;
  revisions: number;
}

/**
 * Writes and reads `measurement_samples` / `signal_summaries` (plan 1.7). Inserts are idempotent on the
 * measurement identity (a re-normalised raw record changes nothing); the monthly partition of a sample is
 * created on first use per process (`measurement_samples_ensure_partition`, migration SignalsAndSamples).
 * Values travel as text so `numeric(24,8)` is never rounded through a JS number.
 */
@Injectable()
export class SampleStore {
  private readonly ensured = new Set<string>();

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Stores the sample; false when that revision of signal + time was already stored. */
  async insertSample(sample: NewSample): Promise<boolean> {
    await this.ensurePartition(sample.observedAt);
    const rows: Array<{ id: string }> = await this.dataSource.query(
      `INSERT INTO "measurement_samples" ("id", "observed_at", "tenant_id", "signal_id", "value", "state_name",
              "state_value", "quality", "quality_flags", "raw_id", "raw_received_at", "source_revision")
       VALUES ($1, $2, $3, $4, $5::numeric, $6, $7, $8::measurement_sample_quality, $9::jsonb, $10, $11, $12)
       ON CONFLICT ("signal_id", "observed_at", "source_revision") DO NOTHING RETURNING "id"`,
      [
        randomUUID(),
        sample.observedAt,
        sample.tenantId,
        sample.signalId,
        sample.value,
        sample.stateName,
        sample.stateValue,
        sample.quality,
        sample.qualityFlags ? JSON.stringify(sample.qualityFlags) : null,
        sample.rawId,
        sample.rawReceivedAt,
        sample.sourceRevision,
      ],
    );
    return rows.length > 0;
  }

  async insertSummary(summary: NewSummary): Promise<boolean> {
    const rows: Array<{ id: string }> = await this.dataSource.query(
      `INSERT INTO "signal_summaries" ("tenant_id", "signal_id", "period_start", "period_end", "total",
              "summary_type", "calculation_basis", "timebase", "quality", "raw_id", "raw_received_at", "source_revision")
       VALUES ($1, $2, $3, $4, $5::numeric, 'Total', 'TimeWeighted', $6, $7::measurement_sample_quality, $8, $9, $10)
       ON CONFLICT ("signal_id", "period_start", "period_end", "source_revision") DO NOTHING RETURNING "id"`,
      [
        summary.tenantId,
        summary.signalId,
        summary.periodStart,
        summary.periodEnd,
        summary.total,
        summary.timebase,
        summary.quality,
        summary.rawId,
        summary.rawReceivedAt,
        summary.sourceRevision,
      ],
    );
    return rows.length > 0;
  }

  /**
   * Latest revision of every sample of `signalId` in `[from, to]`, oldest first, at most `limit` rows
   * (the caller asks for one more to detect truncation).
   */
  async latestSamples(
    manager: EntityManager,
    query: {
      tenantId: string;
      signalId: string;
      from: Date;
      to: Date;
      limit: number;
    },
  ): Promise<StoredSample[]> {
    const rows: Array<Record<string, unknown>> = await manager.query(
      `SELECT DISTINCT ON ("observed_at") "observed_at", "value"::text AS "value", "state_name", "quality",
              "source_revision", count(*) OVER (PARTITION BY "observed_at")::int AS "revisions"
         FROM "measurement_samples"
        WHERE "tenant_id" = $1 AND "signal_id" = $2 AND "observed_at" >= $3 AND "observed_at" <= $4
        ORDER BY "observed_at", "inserted_at" DESC, "id" DESC
        LIMIT $5`,
      [query.tenantId, query.signalId, query.from, query.to, query.limit],
    );
    return rows.map((row) => ({
      observedAt: new Date(row.observed_at as string),
      value: (row.value as string | null) ?? null,
      stateName: (row.state_name as string | null) ?? null,
      quality: row.quality as SampleQualityValue,
      sourceRevision: row.source_revision as string,
      revisions: row.revisions as number,
    }));
  }

  /** Makes sure the month partition holding `at` exists (one query per process and month). */
  async ensurePartition(at: Date): Promise<void> {
    const month = at.toISOString().slice(0, 7);
    if (this.ensured.has(month)) return;
    await this.dataSource.query(
      `SELECT "measurement_samples_ensure_partition"($1::timestamptz)`,
      [at],
    );
    this.ensured.add(month);
  }
}
