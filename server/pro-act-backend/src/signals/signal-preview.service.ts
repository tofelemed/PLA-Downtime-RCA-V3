import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EngineSignal, TimeWindow } from '../domain/actuals/actuals.types';
import {
  quantifySignal,
  SignalQuantity,
} from '../domain/actuals/signal-quantity';
import { Signal } from './entities/signal.entity';
import { SampleStore, StoredSample } from './sample-store';

/** At most this many samples are evaluated by one preview (a longer window is 422). */
const PREVIEW_SAMPLE_CAP = 50_000;
const PREVIEW_MAX_DAYS = 31;
const DAY_MS = 86_400_000;

/** A PI `Total` stored for the window (cross-check of rate integration). */
export interface StoredTotal {
  periodStart: Date;
  periodEnd: Date;
  total: string | null;
  quality: string;
  timebase: string;
}

export interface SignalPreview {
  window: TimeWindow;
  quantity: SignalQuantity;
  /** the samples the engine saw (latest revision per timestamp; includes the boundary neighbours) */
  samples: StoredSample[];
  piTotals: StoredTotal[];
}

/**
 * Preview of a signal's quantity over a window (UX06 "preview quantities, units and times", plan 1.7
 * step 6): the latest sample revisions in `[from − maxGap, to + maxGap]` (boundary neighbours) go
 * through the engine; nothing is stored. Known reset instants come with the state engine (1.10), so
 * `known_instant` counters report their drops as unresolved here.
 */
@Injectable()
export class SignalPreviewService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly store: SampleStore,
  ) {}

  async preview(signal: Signal, window: TimeWindow): Promise<SignalPreview> {
    assertWindow(window);
    const margin = signal.maxGapSeconds * 1000;
    const samples = await this.store.latestSamples(this.dataSource.manager, {
      tenantId: signal.tenantId,
      signalId: signal.id,
      from: new Date(window.from.getTime() - margin),
      to: new Date(window.to.getTime() + margin),
      limit: PREVIEW_SAMPLE_CAP + 1,
    });
    if (samples.length > PREVIEW_SAMPLE_CAP) {
      throw new UnprocessableEntityException({
        code: 'TOO_MANY_SAMPLES',
        message: `More than ${PREVIEW_SAMPLE_CAP} samples; preview a shorter window`,
      });
    }
    const quantity = quantifySignal(
      samples.map((sample) => ({
        at: sample.observedAt,
        value: sample.value,
        quality: sample.quality,
      })),
      engineSignalOf(signal),
      window,
    );
    return {
      window,
      quantity,
      samples,
      piTotals: await this.totals(signal, window),
    };
  }

  private async totals(
    signal: Signal,
    window: TimeWindow,
  ): Promise<StoredTotal[]> {
    if (signal.semanticType !== 'rate') return [];
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT DISTINCT ON ("period_start", "period_end") "period_start", "period_end", "total"::text AS "total",
              "quality", "timebase"
         FROM "signal_summaries"
        WHERE "tenant_id" = $1 AND "signal_id" = $2 AND "period_start" < $4 AND "period_end" > $3
        ORDER BY "period_start", "period_end", "inserted_at" DESC
        LIMIT 1000`,
      [signal.tenantId, signal.id, window.from, window.to],
    );
    return rows.map((row) => ({
      periodStart: new Date(row.period_start as string),
      periodEnd: new Date(row.period_end as string),
      total: (row.total as string | null) ?? null,
      quality: row.quality as string,
      timebase: row.timebase as string,
    }));
  }
}

/** The engine view of a signal row. */
export function engineSignalOf(signal: Signal): EngineSignal {
  return {
    semanticType: signal.semanticType,
    interpolation: signal.interpolation,
    maxGapSeconds: signal.maxGapSeconds,
    rateTimebase: signal.rateTimebase,
    resetPolicy: signal.resetPolicy,
    rolloverModulus: signal.rolloverModulus,
    expectedMin: signal.expectedMin,
    expectedMax: signal.expectedMax,
    acceptUncertain: signal.qualityPolicy?.acceptUncertain === true,
    canonicalUom: signal.canonicalUom,
  };
}

function assertWindow(window: TimeWindow): void {
  const span = window.to.getTime() - window.from.getTime();
  if (!(span > 0)) {
    throw new UnprocessableEntityException({
      code: 'INVALID_RANGE',
      message: 'from must be before to',
    });
  }
  if (span > PREVIEW_MAX_DAYS * DAY_MS) {
    throw new UnprocessableEntityException({
      code: 'WINDOW_TOO_LARGE',
      message: `A preview covers at most ${PREVIEW_MAX_DAYS} days`,
    });
  }
}
