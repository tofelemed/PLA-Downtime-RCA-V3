import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  LossEvent,
  LossEventType,
  RateVersion,
  ScheduleSpan,
  SliceActualsInput,
  SliceInput,
  TransitionStandard,
} from '../domain/accounting/accounting.types';
import { sliceTarget } from '../domain/accounting/slice-target';
import { RateTimebase } from '../domain/actuals/actuals.types';
import { QualityClasses } from '../domain/actuals/period/quality-classes';
import { PeriodProductSlice } from '../periods/entities/period-product-slice.entity';
import { ProductionPeriod } from '../periods/entities/production-period.entity';
import { InputFingerprint } from './entities/calculation-run.entity';
import { KpiInputs, loadKpiInputs } from './kpi-inputs.loader';
import { loadTransitionStandards } from './transition-standards.loader';

/** Everything a calculation run reads, frozen once per run (plan 2.5 step 1). */
export interface AccountingInputs {
  schedule: ScheduleSpan[];
  events: LossEvent[];
  slices: SliceInput[];
  asOf: Date;
  /** approved transition standards of the unit (LA-08) */
  transitionStandards: TransitionStandard[];
  fingerprint: InputFingerprint;
  /** occurrence extents and failure candidates of the KPI engine (plan 2.7) */
  kpi: KpiInputs;
}

interface EventRow {
  id: string;
  occurrence_id: string;
  physical_type: LossEventType;
  start_time: Date;
  end_time: Date | null;
  schedule_class: string;
  oee_component: string;
  impact_mode: string;
  impact_fraction: string | null;
  quantity: string | null;
  reason_code_id: string | null;
  impact_code_id: string | null;
  failure_mode: string | null;
  asset_id: string | null;
  planned_end_time: Date | null;
  from_product_id: string | null;
  to_product_id: string | null;
  recovery_of_event_id: string | null;
  failure_severity: string | null;
  disposition_class: string | null;
  asset_type: string | null;
  reason_code: string | null;
  row_version: number;
  revision_id: string | null;
  revision: number | null;
}

interface RateRow {
  id: string;
  profile_id: string;
  rate_kind: 'sustained' | 'planning';
  rate: string;
  timebase: RateTimebase;
  effective_from: Date;
  effective_to: Date | null;
}

interface InstanceRow {
  utc_start: Date;
  utc_end: Date;
  is_excluded: boolean;
  exclusion_kind: string | null;
  calendar_version_id: string | null;
}

export const EVENTS_SQL = `SELECT e."id", e."occurrence_id", e."physical_type", e."start_time", e."end_time", e."schedule_class",
       e."oee_component", e."impact_mode", e."impact_fraction"::text AS "impact_fraction", e."quantity"::text AS "quantity",
       e."reason_code_id", e."impact_code_id", e."failure_mode", e."asset_id", e."planned_end_time", e."row_version",
       e."from_product_id", e."to_product_id", e."recovery_of_event_id",
       e."failure_severity", e."disposition_class", a."asset_type", rc."code" AS "reason_code",
       r."id" AS "revision_id", r."revision"
  FROM "production_events" e
  LEFT JOIN "assets" a ON a."id" = e."asset_id"
  LEFT JOIN "reason_codes" rc ON rc."id" = e."reason_code_id"
  LEFT JOIN LATERAL (SELECT er."id", er."revision" FROM "event_revisions" er WHERE er."event_id" = e."id"
                      ORDER BY er."revision" DESC LIMIT 1) r ON true
 WHERE e."tenant_id" = $1 AND e."unit_id" = $2
   AND e."physical_type" IN ('downtime', 'slowdown', 'quality_loss', 'grade_transition') AND e."physical_state" IN ('open', 'closed')
   AND tstzrange(e."start_time", e."end_time", '[)') && tstzrange($3, $4, '[)')
 ORDER BY e."start_time", e."id"`;

const RATES_SQL = `SELECT "id", "profile_id", "rate_kind", "rate"::text AS "rate", "timebase", "effective_from", "effective_to"
  FROM "unit_product_rates"
 WHERE "profile_id" = ANY($1::uuid[]) AND "state" = 'approved' AND "rate_kind" IN ('sustained', 'planning')
   AND "effective_from" < $3 AND ("effective_to" IS NULL OR "effective_to" > $2)
 ORDER BY "effective_from", "id"`;

const INSTANCES_SQL = `SELECT "utc_start", "utc_end", "is_excluded", "exclusion_kind", "calendar_version_id"
  FROM "shift_instances" WHERE "tenant_id" = $1 AND "unit_id" = $2 AND "utc_start" < $4 AND "utc_end" > $3
 ORDER BY "utc_start"`;

function toSpan(row: InstanceRow): ScheduleSpan {
  return {
    start: new Date(row.utc_start),
    end: new Date(row.utc_end),
    excluded: row.is_excluded,
    exclusionKind: row.exclusion_kind,
  };
}

function toEvent(row: EventRow): LossEvent {
  return {
    eventId: row.id,
    revisionId: row.revision_id,
    revision: row.revision,
    occurrenceId: row.occurrence_id,
    physicalType: row.physical_type,
    start: new Date(row.start_time),
    end: row.end_time ? new Date(row.end_time) : null,
    scheduleClass: row.schedule_class,
    oeeComponent: row.oee_component,
    impactMode: row.impact_mode,
    impactFraction: row.impact_fraction,
    quantity: row.quantity,
    reasonCodeId: row.reason_code_id,
    impactCodeId: row.impact_code_id,
    failureMode: row.failure_mode,
    assetId: row.asset_id,
    plannedEnd: row.planned_end_time ? new Date(row.planned_end_time) : null,
    transition:
      row.from_product_id && row.to_product_id
        ? { fromProductId: row.from_product_id, toProductId: row.to_product_id }
        : null,
    recoveryOfEventId: row.recovery_of_event_id,
    assetClass: row.asset_type,
    reasonCode: row.reason_code,
    failureSeverity: row.failure_severity,
    dispositionClass: row.disposition_class,
  };
}

function toRate(row: RateRow): RateVersion {
  return {
    id: row.id,
    rate: row.rate,
    timebase: row.timebase,
    from: new Date(row.effective_from),
    to: row.effective_to ? new Date(row.effective_to) : null,
  };
}

const sorted = (values: Iterable<string>) => [...new Set(values)].sort();

/** $1 tenant, $2 unit, $3 period start, $4 period end. */
const windowParams = (period: ProductionPeriod) => [
  period.tenantId,
  period.unitId,
  period.utcStart,
  period.utcEnd,
];

interface FingerprintSource {
  period: ProductionPeriod;
  slices: readonly PeriodProductSlice[];
  events: readonly EventRow[];
  instances: readonly InstanceRow[];
  rateIds: string[];
  standardIds: string[];
  actualsRunId: string | null;
  /** set while the period is running and an open event is measured to it */
  asOf: Date | null;
}

function fingerprintOf(source: FingerprintSource): InputFingerprint {
  const { period, slices, events, instances } = source;
  return {
    periodId: period.id,
    window: {
      start: period.utcStart.toISOString(),
      end: period.utcEnd.toISOString(),
    },
    sliceIds: slices.map((s) => s.id),
    eventRevisions: events.map((e) => ({
      eventId: e.id,
      revisionId: e.revision_id,
      rowVersion: e.row_version,
    })),
    occurrenceIds: sorted(events.map((e) => e.occurrence_id)),
    actualsRunId: source.actualsRunId,
    planVersionId: period.selectedPlanVersionId,
    planPeriodIds: sorted(
      slices.flatMap((s) => (s.planPeriodId ? [s.planPeriodId] : [])),
    ),
    rateVersionIds: source.rateIds,
    calendarVersionIds: sorted(
      [
        period.calendarVersionId,
        ...instances.map((i) => i.calendar_version_id),
      ].flatMap((v) => (v ? [v] : [])),
    ),
    transitionStandardIds: source.standardIds,
    asOf: source.asOf ? source.asOf.toISOString() : null,
  };
}

interface SliceLookups {
  slices: readonly PeriodProductSlice[];
  rates: readonly RateRow[];
  targets: Map<string, PlanPeriodTarget>;
  actuals: Map<string, SliceActualsInput>;
}

/** A plan period's target with the window it was planned for. */
interface PlanPeriodTarget {
  target: string;
  start: Date;
  end: Date;
}

/** The slice's time share of its plan period's target (LA-07); null without a plan period. */
function targetOf(
  slice: PeriodProductSlice,
  targets: ReadonlyMap<string, PlanPeriodTarget>,
): string | null {
  const planned = slice.planPeriodId ? targets.get(slice.planPeriodId) : null;
  if (!planned) return null;
  return sliceTarget(planned.target, planned, {
    start: slice.windowFrom,
    end: slice.windowTo,
  });
}

function toSliceInput(
  slice: PeriodProductSlice,
  lookups: SliceLookups,
): SliceInput {
  const own = lookups.rates.filter((r) => r.profile_id === slice.profileId);
  return {
    sliceId: slice.id,
    productId: slice.productId,
    window: { start: slice.windowFrom, end: slice.windowTo },
    uom: slice.quantityUom,
    sustainedRates: slice.profileId
      ? own.filter((r) => r.rate_kind === 'sustained').map(toRate)
      : null,
    planningRates: own.filter((r) => r.rate_kind === 'planning').map(toRate),
    target: targetOf(slice, lookups.targets),
    actuals: lookups.actuals.get(slice.id) ?? null,
    concurrent: lookups.slices.some(
      (other) =>
        other.id !== slice.id &&
        other.windowFrom < slice.windowTo &&
        other.windowTo > slice.windowFrom,
    ),
  };
}

/**
 * Loads a period's accounting inputs in the run's transaction: stored shift instances (exclusions),
 * downtime / slowdown / quality / grade-transition events effective now with their latest revision, the
 * approved sustained and planning rate versions of each slice's profile, the unit's approved transition
 * standards, the slices' plan targets and the actuals of the actuals run — and the fingerprint naming each of them by id and version (FND03).
 */
@Injectable()
export class AccountingInputsLoader {
  async load(
    manager: EntityManager,
    period: ProductionPeriod,
    slices: readonly PeriodProductSlice[],
    actualsRunId: string | null,
  ): Promise<AccountingInputs> {
    const now = new Date(Math.floor(Date.now() / 1000) * 1000);
    const running = period.utcEnd > now;
    const asOf = running ? now : period.utcEnd;
    const params = windowParams(period);
    const instances: InstanceRow[] = await manager.query(INSTANCES_SQL, params);
    const events: EventRow[] = await manager.query(EVENTS_SQL, params);
    const sliceInputs = await this.sliceInputs(
      manager,
      period,
      slices,
      actualsRunId,
    );
    const openMeasured = running && events.some((e) => e.end_time === null);
    const standards = await loadTransitionStandards(manager, period, events);
    return {
      schedule: instances.map(toSpan),
      events: events.map(toEvent),
      slices: sliceInputs.inputs,
      asOf,
      transitionStandards: standards,
      kpi: await loadKpiInputs(manager, period),
      fingerprint: fingerprintOf({
        period,
        slices,
        events,
        instances,
        rateIds: sliceInputs.rateIds,
        standardIds: sorted(standards.map((s) => s.id)),
        actualsRunId,
        asOf: openMeasured ? asOf : null,
      }),
    };
  }

  private async sliceInputs(
    manager: EntityManager,
    period: ProductionPeriod,
    slices: readonly PeriodProductSlice[],
    actualsRunId: string | null,
  ): Promise<{ inputs: SliceInput[]; rateIds: string[] }> {
    const profileIds = sorted(
      slices.flatMap((s) => (s.profileId ? [s.profileId] : [])),
    );
    const rates: RateRow[] = profileIds.length
      ? await manager.query(RATES_SQL, [
          profileIds,
          period.utcStart,
          period.utcEnd,
        ])
      : [];
    const lookups: SliceLookups = {
      slices,
      rates,
      targets: await this.targets(manager, slices),
      actuals: await this.actuals(manager, actualsRunId),
    };
    return {
      inputs: slices.map((slice) => toSliceInput(slice, lookups)),
      rateIds: sorted(rates.map((r) => r.id)),
    };
  }

  private async targets(
    manager: EntityManager,
    slices: readonly PeriodProductSlice[],
  ): Promise<Map<string, PlanPeriodTarget>> {
    const ids = slices.flatMap((s) => (s.planPeriodId ? [s.planPeriodId] : []));
    if (ids.length === 0) return new Map();
    const rows: Array<{
      id: string;
      target: string;
      utc_start: Date;
      utc_end: Date;
    }> = await manager.query(
      `SELECT "id", "target"::text AS "target", "utc_start", "utc_end" FROM "plan_periods" WHERE "id" = ANY($1::uuid[])`,
      [ids],
    );
    return new Map(
      rows.map((r) => [
        r.id,
        { target: r.target, start: r.utc_start, end: r.utc_end },
      ]),
    );
  }

  private async actuals(
    manager: EntityManager,
    actualsRunId: string | null,
  ): Promise<Map<string, SliceActualsInput>> {
    if (!actualsRunId) return new Map();
    const rows: Array<{
      slice_id: string;
      gross: string | null;
      good: string | null;
      uom: string | null;
      quality_state: string;
      coverage_ratio: string | null;
      quality_classes: QualityClasses | null;
    }> = await manager.query(
      `SELECT "slice_id", "gross"::text AS "gross", "good"::text AS "good", "uom", "quality_state",
              "coverage_ratio"::text AS "coverage_ratio", "quality_classes"
         FROM "actuals_results" WHERE "actuals_run_id" = $1`,
      [actualsRunId],
    );
    return new Map(
      rows.map((r) => [
        r.slice_id,
        {
          gross: r.gross,
          good: r.good,
          uom: r.uom,
          qualityState: r.quality_state,
          coverageRatio: r.coverage_ratio,
          // SME E3: absent on results of actuals runs before 2.4.2 (no classes, old behaviour)
          ...(r.quality_classes ? { classes: r.quality_classes } : {}),
        },
      ]),
    );
  }
}
