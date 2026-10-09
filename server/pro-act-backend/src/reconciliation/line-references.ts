import { EntityManager } from 'typeorm';
import { ProductionPeriod } from '../periods/entities/production-period.entity';
import { LineEvidenceRef } from './entities/reconciliation-line.entity';
import { ShapedLine } from './line-shape';
import { lineInvalid } from './workflow-errors';

interface SliceRow {
  id: string;
  window_from: Date;
  window_to: Date;
}

interface CodeRow {
  id: string;
  active: boolean;
}

interface EventRow {
  id: string;
  unit_id: string;
  start_time: Date;
  end_time: Date | null;
  revision_id: string | null;
}

interface AdjustmentRow {
  id: string;
  period_id: string;
  state: string;
}

const uniq = (values: Array<string | undefined | null>): string[] => [
  ...new Set(values.filter((v): v is string => typeof v === 'string')),
];

/** The rows a save references, loaded once per kind (no N+1). */
interface References {
  slices: Map<string, SliceRow>;
  reasons: Map<string, CodeRow>;
  impacts: Map<string, CodeRow>;
  /** reason id → impact id of the reason_to_impact rule in force at the period start */
  reasonImpact: Map<string, string | null>;
  events: Map<string, EventRow>;
  adjustments: Map<string, AdjustmentRow>;
}

const ACTIVE_CODE = `"is_active" AND ("effective_from" IS NULL OR "effective_from" <= $3)
   AND ("effective_to" IS NULL OR "effective_to" > $3)`;

async function byId<T extends { id: string }>(
  manager: EntityManager,
  sql: string,
  params: unknown[],
): Promise<Map<string, T>> {
  const rows: T[] = await manager.query(sql, params);
  return new Map(rows.map((row) => [row.id, row]));
}

/** Reason and impact codes in force at the period start and the reason → impact rules. */
async function loadCodes(
  manager: EntityManager,
  period: ProductionPeriod,
  lines: readonly ShapedLine[],
): Promise<Pick<References, 'reasons' | 'impacts' | 'reasonImpact'>> {
  const tenant = period.tenantId;
  const at = period.utcStart;
  const reasons = uniq(lines.map((l) => l.input.reasonCodeId));
  const impacts = uniq(lines.map((l) => l.input.impactCodeId));
  const rules: Array<{
    source_code_id: string;
    target_code_id: string | null;
  }> = await manager.query(
    `SELECT DISTINCT ON ("source_code_id") "source_code_id", "target_code_id" FROM "code_mapping_rules"
        WHERE "tenant_id" = $1 AND "rule_kind" = 'reason_to_impact' AND "source_code_id" = ANY($2::uuid[])
          AND "effective_from" <= $3 AND ("effective_to" IS NULL OR "effective_to" > $3)
        ORDER BY "source_code_id", "version" DESC`,
    [tenant, reasons, at],
  );
  return {
    reasons: await byId<CodeRow>(
      manager,
      `SELECT "id", (${ACTIVE_CODE}) AS "active" FROM "reason_codes" WHERE "tenant_id" = $1 AND "id" = ANY($2::uuid[])`,
      [tenant, reasons, at],
    ),
    impacts: await byId<CodeRow>(
      manager,
      `SELECT "id", (${ACTIVE_CODE}) AS "active" FROM "impact_codes" WHERE "tenant_id" = $1 AND "id" = ANY($2::uuid[])`,
      [tenant, impacts, at],
    ),
    reasonImpact: new Map(
      rules.map((r) => [r.source_code_id, r.target_code_id]),
    ),
  };
}

async function loadReferences(
  manager: EntityManager,
  period: ProductionPeriod,
  lines: readonly ShapedLine[],
): Promise<References> {
  const tenant = period.tenantId;
  const events = uniq(lines.flatMap((l) => l.input.eventIds ?? []));
  const adjustments = uniq(lines.map((l) => l.input.adjustmentId));
  return {
    ...(await loadCodes(manager, period, lines)),
    slices: await byId<SliceRow>(
      manager,
      `SELECT "id", "window_from", "window_to" FROM "period_product_slices"
        WHERE "period_id" = $1 AND "superseded_at" IS NULL AND "tenant_id" = $2`,
      [period.id, tenant],
    ),
    events: await byId<EventRow>(
      manager,
      `SELECT e."id", e."unit_id", e."start_time", e."end_time", r."id" AS "revision_id"
         FROM "production_events" e
         LEFT JOIN LATERAL (SELECT er."id" FROM "event_revisions" er WHERE er."event_id" = e."id"
                             ORDER BY er."revision" DESC LIMIT 1) r ON true
        WHERE e."tenant_id" = $1 AND e."id" = ANY($2::uuid[])`,
      [tenant, events],
    ),
    adjustments: await byId<AdjustmentRow>(
      manager,
      `SELECT "id", "period_id", "state" FROM "actuals_adjustments" WHERE "tenant_id" = $1 AND "id" = ANY($2::uuid[])`,
      [tenant, adjustments],
    ),
  };
}

function checkCodes(line: ShapedLine, refs: References): void {
  const { reasonCodeId, impactCodeId } = line.input;
  const i = line.index;
  for (const [id, rows, field] of [
    [reasonCodeId, refs.reasons, 'reasonCodeId'],
    [impactCodeId, refs.impacts, 'impactCodeId'],
  ] as const) {
    if (!id) continue;
    const row = rows.get(id);
    if (!row)
      throw lineInvalid(
        'INVALID_REFERENCE',
        i,
        `${field} is not a code of the tenant`,
      );
    if (!row.active)
      throw lineInvalid(
        'CODE_NOT_EFFECTIVE',
        i,
        `${field} is not in force for the period`,
      );
  }
  const expected = reasonCodeId
    ? refs.reasonImpact.get(reasonCodeId)
    : undefined;
  if (impactCodeId && expected && expected !== impactCodeId) {
    throw lineInvalid(
      'CODE_COMBINATION_INVALID',
      i,
      'impactCodeId does not match the reason_to_impact rule of the reason code',
    );
  }
}

function overlaps(event: EventRow, slice: SliceRow): boolean {
  const start = new Date(event.start_time).getTime();
  const end = event.end_time ? new Date(event.end_time).getTime() : Infinity;
  return (
    start < new Date(slice.window_to).getTime() &&
    end > new Date(slice.window_from).getTime()
  );
}

function checkEvidence(
  line: ShapedLine,
  refs: References,
  period: ProductionPeriod,
): LineEvidenceRef[] {
  const slice = refs.slices.get(line.sliceId) as SliceRow;
  return (line.input.eventIds ?? []).map((eventId) => {
    const event = refs.events.get(eventId);
    if (!event)
      throw lineInvalid(
        'INVALID_REFERENCE',
        line.index,
        'eventIds names an event that is not of the tenant',
      );
    if (event.unit_id !== period.unitId || !overlaps(event, slice)) {
      throw lineInvalid(
        'EVIDENCE_OUTSIDE_SEGMENT',
        line.index,
        'the evidence event does not overlap the slice of this period',
      );
    }
    return { eventId, eventRevisionId: event.revision_id };
  });
}

function checkAdjustment(
  line: ShapedLine,
  refs: References,
  periodId: string,
): void {
  const id = line.input.adjustmentId;
  if (!id) return;
  const adjustment = refs.adjustments.get(id);
  if (!adjustment || adjustment.period_id !== periodId) {
    throw lineInvalid(
      'INVALID_REFERENCE',
      line.index,
      'adjustmentId is not an adjustment of this period',
    );
  }
  if (adjustment.state !== 'approved') {
    throw lineInvalid(
      'ADJUSTMENT_NOT_APPROVED',
      line.index,
      'only an approved adjustment explains a loss',
    );
  }
}

/**
 * Reference rules of a draft save (§15.3, WF05): the slice belongs to the period, codes are of the tenant
 * and in force at the period start and agree with the `reason_to_impact` rule, evidence events are of the
 * tenant, of the period's unit and overlap the slice, an adjustment is an approved one of this period.
 * Foreign ids are 422 INVALID_REFERENCE with the line index. Returns the pinned evidence per line.
 */
export async function checkReferences(
  manager: EntityManager,
  period: ProductionPeriod,
  lines: readonly ShapedLine[],
): Promise<LineEvidenceRef[][]> {
  const refs = await loadReferences(manager, period, lines);
  return lines.map((line) => {
    if (!refs.slices.has(line.sliceId)) {
      throw lineInvalid(
        'INVALID_REFERENCE',
        line.index,
        'sliceId is not a slice of this period',
      );
    }
    checkCodes(line, refs);
    checkAdjustment(line, refs, period.id);
    return checkEvidence(line, refs, period);
  });
}
