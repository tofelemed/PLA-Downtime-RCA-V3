import { EntityManager } from 'typeorm';
import { RuleDefinition } from '../../rules/grammar/rule-definition';
import { eventFacts } from '../../rules/rule-event-facts';
import { ProductionEvent } from '../../production-event/production-event.entity';
import {
  HintRule,
  isFunctionalFailure,
  TriggerEvent,
} from '../../domain/rca/rca-triggers';
import { RcaPolicy } from '../../domain/rca/rca-policy';
import { assetFailures } from '../rca-recurrence';

const DAY_MS = 86_400_000;

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
    start: event.startTime,
    end: event.endTime ?? null,
    facts: eventFacts(event),
  };
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

/**
 * Functional failures (D13) of the event's asset in the repeat window ending at the event's start,
 * this one included; 0 when the event is not a failure with an asset (the repeat trigger cannot fire).
 */
export async function recentFailuresOf(
  manager: EntityManager,
  input: { tenantId: string; event: TriggerEvent; policy: RcaPolicy },
): Promise<number> {
  const { event, policy } = input;
  if (!event.assetId || !isFunctionalFailure(event)) return 0;
  return assetFailures(manager, {
    tenantId: input.tenantId,
    assetId: event.assetId,
    from: new Date(event.start.getTime() - policy.repeatWindowDays * DAY_MS),
    to: new Date(event.start.getTime() + 1000),
  });
}
