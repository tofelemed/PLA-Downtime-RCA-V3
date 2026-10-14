import { EntityManager } from 'typeorm';
import { RuleDefinition } from '../../rules/grammar/rule-definition';
import { eventFacts } from '../../rules/rule-event-facts';
import { ProductionEvent } from '../../production-event/production-event.entity';
import {
  HintRule,
  isFunctionalFailure,
  TriggerEvent,
} from '../../domain/rca/rca-triggers';
import { isCriticalAsset, RcaPolicy } from '../../domain/rca/rca-policy';
import {
  failureModeKey,
  failureModeKeySql,
} from '../../domain/rca/failure-mode-key';
import { assetFailures } from '../rca-recurrence';

const DAY_MS = 86_400_000;

/** Unplanned stops and failure work orders that are live (CA8 incidents; planned stops never count). */
const INCIDENT = `e."physical_state" IN ('open', 'closed') AND (e."event_type" = 'FailureWO'
  OR (e."physical_type" = 'downtime' AND e."schedule_class" = 'unplanned'))`;

/** The trigger's view of a stored event (confirmed values only). */
export function triggerEventOf(event: ProductionEvent): TriggerEvent {
  return {
    eventId: event.id,
    occurrenceId: event.occurrenceId ?? null,
    unitId: event.unitId,
    assetId: event.assetId ?? null,
    physicalType: event.physicalType,
    scheduleClass: event.scheduleClass,
    physicalState: event.physicalState,
    eventType: event.eventType ?? null,
    failureMode: event.failureMode ?? null,
    solType: event.solType ?? null,
    severity: event.severity ?? null,
    start: event.startTime,
    end: event.endTime ?? null,
    facts: eventFacts(event),
  };
}

/** The repeat identity of a stored event under the policy (null = names no mode). */
export function modeKeyOf(
  event: ProductionEvent,
  policy: RcaPolicy,
): string | null {
  return failureModeKey(
    {
      failureMode: event.failureMode ?? null,
      failureMechanism: event.failureMechanism ?? null,
      reasonCodeId: event.reasonCodeId ?? null,
    },
    policy.repeatMatch,
  );
}

/** Active `rca_trigger_hint` rule versions of the tenant (plan 3.8 storage, consumed here). */
export async function activeHintRules(
  manager: EntityManager,
  tenantId: string,
): Promise<HintRule[]> {
  const rows: Array<{
    id: string;
    version: number;
    name: string;
    definition: RuleDefinition;
  }> = await manager.query(
    `SELECT r."id", v."version", r."name", v."definition"
       FROM "rules" r
       JOIN "rule_versions" v ON v."rule_id" = r."id" AND v."version" = r."active_version"
      WHERE r."tenant_id" = $1 AND r."kind" = 'rca_trigger_hint' AND r."state" = 'active'
      ORDER BY r."priority", r."name"`,
    [tenantId],
  );
  return rows;
}

interface ModeInput {
  tenantId: string;
  stored: ProductionEvent;
  event: TriggerEvent;
  policy: RcaPolicy;
}

/**
 * CA8 same-problem incidents of the event's asset in the repeat window ending at the event's start, this
 * one included: per asset and failure mode (or mode and mechanism) for CA8 versions; D13 functional
 * failures of the asset for versions before CA8. 0 when the event cannot be matched.
 */
export async function recentFailuresOf(
  manager: EntityManager,
  input: ModeInput,
): Promise<number> {
  const { event, policy } = input;
  if (!event.assetId) return 0;
  const from = new Date(
    event.start.getTime() - policy.repeatWindowDays * DAY_MS,
  );
  const to = new Date(event.start.getTime() + 1000);
  if (policy.repeatMatch === 'asset') {
    if (!isFunctionalFailure(event)) return 0;
    return assetFailures(manager, {
      tenantId: input.tenantId,
      assetId: event.assetId,
      from,
      to,
    });
  }
  const key = modeKeyOf(input.stored, policy);
  if (!key) return 0;
  const rows: Array<{ n: number }> = await manager.query(
    `SELECT count(DISTINCT COALESCE(e."occurrence_id", e."id"))::int AS "n" FROM "production_events" e
      WHERE e."tenant_id" = $1 AND e."asset_id" = $2 AND e."start_time" >= $3 AND e."start_time" < $4
        AND ${INCIDENT} AND ${failureModeKeySql(policy.repeatMatch)} = $5`,
    [input.tenantId, event.assetId, from, to, key],
  );
  return rows[0]?.n ?? 0;
}

/**
 * CA8 bad actor: unplanned downtime seconds of the same asset and mode starting in the cumulative window
 * that ends at this event's start (this one included, elapsed while open). 0 when off or unmatched.
 */
export async function cumulativeSecondsOf(
  manager: EntityManager,
  input: ModeInput & { now: Date },
): Promise<number> {
  const rule = input.policy.cumulative;
  const { event } = input;
  const key = modeKeyOf(input.stored, input.policy);
  if (!rule || !event.assetId || key === null) return 0;
  const rows: Array<{ seconds: string | null }> = await manager.query(
    `SELECT sum(EXTRACT(EPOCH FROM (COALESCE(e."end_time", $5) - e."start_time")))::text AS "seconds"
       FROM "production_events" e
      WHERE e."tenant_id" = $1 AND e."asset_id" = $2 AND e."start_time" >= $3 AND e."start_time" < $4
        AND e."physical_state" IN ('open', 'closed') AND e."physical_type" = 'downtime'
        AND e."schedule_class" = 'unplanned' AND ${failureModeKeySql(input.policy.repeatMatch)} = $6`,
    [
      input.tenantId,
      event.assetId,
      new Date(event.start.getTime() - rule.windowDays * DAY_MS),
      new Date(event.start.getTime() + 1000),
      input.now,
      key,
    ],
  );
  return Math.floor(Number(rows[0]?.seconds ?? 0));
}

/** D17: whether the asset's criticality is one the policy names critical. */
export async function criticalAssetOf(
  manager: EntityManager,
  input: { tenantId: string; assetId: string | null; policy: RcaPolicy },
): Promise<boolean> {
  if (!input.assetId || input.policy.criticalAssets.criticalities.length === 0)
    return false;
  const rows: Array<{ criticality: string | null }> = await manager.query(
    `SELECT "criticality" FROM "assets" WHERE "id"::text = $1 AND "tenant_id" = $2`,
    [input.assetId, input.tenantId],
  );
  return isCriticalAsset(input.policy, rows[0]?.criticality ?? null);
}

/**
 * The open case about the same problem (CA8): for CA8 versions a not-closed case of the asset with a
 * linked event of the same mode; for versions before CA8 any not-closed case of the asset (RCA-07
 * suppression). null when there is none.
 */
export async function openCaseOf(
  manager: EntityManager,
  input: { tenantId: string; stored: ProductionEvent; policy: RcaPolicy },
): Promise<string | null> {
  const assetId = input.stored.assetId ?? null;
  if (!assetId) return null;
  if (input.policy.repeatMatch === 'asset') {
    const rows: Array<{ id: string }> = await manager.query(
      `SELECT "id" FROM "rcas" WHERE "tenant_id" = $1 AND "asset_id" = $2
          AND COALESCE("status", 'Draft') <> 'Closed' ORDER BY "created_at" LIMIT 1`,
      [input.tenantId, assetId],
    );
    return rows[0]?.id ?? null;
  }
  const key = modeKeyOf(input.stored, input.policy);
  if (!key) return null;
  const rows: Array<{ id: string }> = await manager.query(
    `SELECT rca."id" FROM "rcas" rca
      WHERE rca."tenant_id" = $1 AND COALESCE(rca."status", 'Draft') <> 'Closed'
        AND EXISTS (SELECT 1 FROM "rca_case_links" k JOIN "production_events" e ON e."id"::text = k."target_id"
                     WHERE k."rca_id" = rca."id" AND k."tenant_id"::text = $1 AND k."link_type" = 'event'
                       AND e."asset_id" = $2 AND ${failureModeKeySql(input.policy.repeatMatch)} = $3)
      ORDER BY rca."created_at" LIMIT 1`,
    [input.tenantId, assetId, key],
  );
  return rows[0]?.id ?? null;
}
