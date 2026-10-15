import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { EngineSample } from '../domain/actuals/actuals.types';
import { ExternalLineInput } from '../domain/actuals/period/external-line-candidate';
import { ExternalReportLine } from '../domain/actuals/period/external-report';
import {
  PeriodOutputEvent,
  StoppedSpan,
} from '../domain/actuals/period/output-distribution';
import { ActualsSource } from '../domain/actuals/period/period-actuals.types';
import {
  DispositionClass,
  LotDispositionInput,
} from '../domain/actuals/period/quality-classes';
import { Dec } from '../domain/actuals/decimal';
import { Signal } from '../signals/entities/signal.entity';
import { SampleStore } from '../signals/sample-store';
import { ActualsAdjustment } from './entities/actuals-adjustment.entity';
import { ProductionPeriod } from './entities/production-period.entity';

/** Stops of a unit (downtime that halts production, SME Q5) overlapping ($3, $4). */
const STOPS_SQL = `SELECT "start_time", "end_time" FROM "production_events"
 WHERE "tenant_id" = $1 AND "unit_id" = $2 AND "physical_type" = 'downtime'
   AND "physical_state" IN ('open', 'closed') AND "impact_mode" NOT IN ('none', 'fractional')
   AND tstzrange("start_time", "end_time", '[)') && tstzrange($3, $4, '[)')
 ORDER BY "start_time", "id"`;

/** Production output events overlapping the period ($3, $4) of a unit. */
export const OUTPUT_EVENTS_SQL = `SELECT "id", "canonical_id", "current_source_revision", "row_version", "start_time", "end_time",
       "quantity"::text AS "quantity", "defective_quantity"::text AS "rejects", "quantity_uom"
  FROM "production_events"
 WHERE "tenant_id" = $1 AND "unit_id" = $2 AND "physical_type" = 'production_output'
   AND "physical_state" IN ('open', 'closed')
   AND tstzrange("start_time", "end_time", '[)') && tstzrange($3, $4, '[)')
 ORDER BY "start_time", "id"`;

/**
 * SME E3: approved lot dispositions and recovery movements of a unit whose production interval overlaps
 * the period ($3, $4) — superseded, proposed and rejected rows are not evidence.
 */
export const LOT_DISPOSITIONS_SQL = `SELECT "id", "product_id", "production_start", "production_end", "disposition_class",
       "quantity"::text AS "quantity", "uom", "remeasured"
  FROM "lot_dispositions"
 WHERE "tenant_id" = $1 AND "unit_id" = $2 AND "state" = 'approved'
   AND "production_start" < $4 AND "production_end" > $3
 ORDER BY "production_start", "id"`;

/** A lot disposition of the period's unit with the product it belongs to. */
export type PeriodLotDisposition = LotDispositionInput & { productId: string };

/** Samples read per signal for one period at most (more → `too_many_samples`, not quantified). */
export const PERIOD_SAMPLE_CAP = 50_000;

/** A counter or rate signal of the unit (latest version over the period) with its samples. */
export interface SignalInput {
  signal: Signal;
  source: ActualsSource;
  /** latest revision per timestamp, oldest first, boundary neighbours included */
  samples: EngineSample[];
  versions: number;
  truncated: boolean;
}

export interface PeriodInputs {
  events: PeriodOutputEvent[];
  /** stops of the unit under output events that cross the period boundary (LA-06: running-time split) */
  stops: StoppedSpan[];
  signals: SignalInput[];
  adjustments: ActualsAdjustment[];
  reportLines: Array<ExternalLineInput & { unitId: string; productId: string }>;
  /** SME E3: approved lot dispositions of the unit overlapping the period; absent = none */
  dispositions?: PeriodLotDisposition[];
}

/**
 * Everything the actuals of one period depend on (plan 2.4 step 2), loaded once per run: production
 * output events of the unit overlapping the period (not retracted or superseded; latest state per event),
 * counter and rate signals of the unit (PI, MQTT or Kafka connections) with their latest sample
 * revisions in `[start − maxGap, end + maxGap]`, approved adjustments of the period, and lines of current
 * certified external reports overlapping the period.
 */
@Injectable()
export class ActualsInputsLoader {
  constructor(private readonly samples: SampleStore) {}

  async load(
    manager: EntityManager,
    period: ProductionPeriod,
  ): Promise<PeriodInputs> {
    const [events, signals, adjustments, reportLines, dispositions] =
      await Promise.all([
        this.events(manager, period),
        this.signals(manager, period),
        manager.find(ActualsAdjustment, {
          where: { periodId: period.id, state: 'approved' },
          order: { decidedAt: 'ASC', id: 'ASC' },
        }),
        this.reportLines(manager, period),
        this.dispositions(manager, period),
      ]);
    const stops = await this.stopsUnder(manager, period, events);
    return { events, stops, signals, adjustments, reportLines, dispositions };
  }

  private async dispositions(
    manager: EntityManager,
    period: ProductionPeriod,
  ): Promise<PeriodLotDisposition[]> {
    const rows: Array<{
      id: string;
      product_id: string;
      production_start: Date;
      production_end: Date;
      disposition_class: DispositionClass;
      quantity: string;
      uom: string;
      remeasured: boolean;
    }> = await manager.query(LOT_DISPOSITIONS_SQL, [
      period.tenantId,
      period.unitId,
      period.utcStart,
      period.utcEnd,
    ]);
    return rows.map((row) => ({
      id: row.id,
      productId: row.product_id,
      start: new Date(row.production_start),
      end: new Date(row.production_end),
      dispositionClass: row.disposition_class,
      quantity: new Dec(row.quantity),
      uom: row.uom,
      remeasured: row.remeasured,
    }));
  }

  /** Stops of the unit overlapping the output events that cross the period boundary (none when none do). */
  private async stopsUnder(
    manager: EntityManager,
    period: ProductionPeriod,
    events: readonly PeriodOutputEvent[],
  ): Promise<StoppedSpan[]> {
    const spanning = events.filter(
      (e) =>
        e.end !== null && (e.start < period.utcStart || e.end > period.utcEnd),
    );
    if (spanning.length === 0) return [];
    const from = new Date(Math.min(...spanning.map((e) => e.start.getTime())));
    const to = new Date(
      Math.max(...spanning.map((e) => (e.end as Date).getTime())),
    );
    const rows: Array<{ start_time: Date; end_time: Date | null }> =
      await manager.query(STOPS_SQL, [
        period.tenantId,
        period.unitId,
        from,
        to,
      ]);
    return rows.map((r) => ({
      start: new Date(r.start_time),
      end: r.end_time ? new Date(r.end_time) : to,
    }));
  }

  private async events(
    manager: EntityManager,
    period: ProductionPeriod,
  ): Promise<PeriodOutputEvent[]> {
    const rows: Array<Record<string, unknown>> = await manager.query(
      OUTPUT_EVENTS_SQL,
      [period.tenantId, period.unitId, period.utcStart, period.utcEnd],
    );
    return rows.map((row) => ({
      identity: (row.canonical_id as string | null) ?? (row.id as string),
      revision: row.row_version as number,
      start: new Date(row.start_time as string),
      end: row.end_time ? new Date(row.end_time as string) : null,
      quantity: (row.quantity as string | null) ?? null,
      rejects: (row.rejects as string | null) ?? null,
      uom: (row.quantity_uom as string | null) ?? null,
    }));
  }

  private async signals(
    manager: EntityManager,
    period: ProductionPeriod,
  ): Promise<SignalInput[]> {
    const versions = await manager
      .getRepository(Signal)
      .createQueryBuilder('g')
      .where('g.tenantId = :tenantId AND g.unitId = :unitId', {
        tenantId: period.tenantId,
        unitId: period.unitId,
      })
      .andWhere(`g.semanticType IN ('counter', 'rate')`)
      .andWhere(
        'g.effectiveFrom < :to AND (g.effectiveTo IS NULL OR g.effectiveTo > :from)',
        {
          from: period.utcStart,
          to: period.utcEnd,
        },
      )
      .orderBy('g.version', 'ASC')
      .getMany();
    if (versions.length === 0) return [];
    const types = await this.connectionTypes(manager, versions);
    const groups = new Map<string, Signal[]>();
    for (const version of versions) {
      const key = `${version.connectionId}|${version.sourceKey}`;
      groups.set(key, [...(groups.get(key) ?? []), version]);
    }
    const inputs: SignalInput[] = [];
    for (const group of groups.values()) {
      const latest = group[group.length - 1];
      const source = sourceOf(
        types.get(latest.connectionId),
        latest.semanticType,
      );
      if (!source) continue;
      inputs.push(await this.withSamples(manager, period, group, source));
    }
    return inputs;
  }

  private async withSamples(
    manager: EntityManager,
    period: ProductionPeriod,
    group: Signal[],
    source: ActualsSource,
  ): Promise<SignalInput> {
    const latest = group[group.length - 1];
    const margin = latest.maxGapSeconds * 1000;
    const all: EngineSample[] = [];
    let truncated = false;
    for (const version of group) {
      const rows = await this.samples.latestSamples(manager, {
        tenantId: period.tenantId,
        signalId: version.id,
        from: new Date(period.utcStart.getTime() - margin),
        to: new Date(period.utcEnd.getTime() + margin),
        limit: PERIOD_SAMPLE_CAP + 1,
      });
      truncated ||= rows.length > PERIOD_SAMPLE_CAP;
      all.push(
        ...rows.map((row) => ({
          at: row.observedAt,
          value: row.value,
          quality: row.quality,
        })),
      );
    }
    all.sort((a, b) => a.at.getTime() - b.at.getTime());
    return {
      signal: latest,
      source,
      samples: all,
      versions: group.length,
      truncated,
    };
  }

  private async connectionTypes(
    manager: EntityManager,
    signals: Signal[],
  ): Promise<Map<string, string>> {
    const ids = [...new Set(signals.map((signal) => signal.connectionId))];
    const rows: Array<{ id: string; source_type: string }> =
      await manager.query(
        `SELECT "id", "source_type" FROM "integration_connections" WHERE "id" = ANY($1::uuid[])`,
        [ids],
      );
    return new Map(rows.map((row) => [row.id, row.source_type]));
  }

  private async reportLines(
    manager: EntityManager,
    period: ProductionPeriod,
  ): Promise<PeriodInputs['reportLines']> {
    const rows: Array<Record<string, unknown>> = await manager.query(
      `SELECT "id", "external_report_id", "external_revision", "utc_start", "utc_end", "basis", "lines"
         FROM "external_production_reports"
        WHERE "tenant_id" = $1 AND "state" = 'current' AND "certified_eligible"
          AND "utc_start" < $3 AND "utc_end" > $2
          AND "lines" @> jsonb_build_array(jsonb_build_object('unitId', $4::text))
        ORDER BY "utc_start", "id"`,
      [period.tenantId, period.utcStart, period.utcEnd, period.unitId],
    );
    return rows.flatMap((row) =>
      (row.lines as ExternalReportLine[])
        .filter((line) => line.unitId === period.unitId)
        .map((line) => ({
          reportId: row.id as string,
          externalReportId: row.external_report_id as string,
          externalRevision: row.external_revision as string,
          window: {
            from: new Date(row.utc_start as string),
            to: new Date(row.utc_end as string),
          },
          basis: row.basis as 'gross' | 'good',
          gross: line.gross,
          good: line.good,
          reject: line.reject,
          uom: line.uom,
          unitId: line.unitId,
          productId: line.productId,
        })),
    );
  }
}

/** Policy source of a signal: PI counters / rates, MQTT and Kafka signals; other connections none. */
export function sourceOf(
  connectionType: string | undefined,
  semanticType: string,
): ActualsSource | null {
  if (connectionType === 'pi_web_api') {
    return semanticType === 'counter' ? 'pi_counter' : 'pi_rate';
  }
  if (connectionType === 'mqtt' || connectionType === 'kafka')
    return connectionType;
  return null;
}
