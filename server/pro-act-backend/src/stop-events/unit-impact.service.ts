import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  impactChanged,
  ResolvedImpact,
  resolveUnitImpact,
} from '../domain/reliability/unit-impact';
import { ProductionEvent } from '../production-event/production-event.entity';
import { EventChangeMessage } from '../production-event/revisions/event-change.notifier';
import { SYSTEM_ACTOR } from '../production-event/revisions/revision-actor';
import { applyUserChangeIn } from '../production-event/revisions/user-change';
import {
  AssetWindow,
  ImpactEvent,
  loadImpactEvent,
  loadImpactEventPage,
  loadImpactRule,
  loadRulesOfStandby,
  loadTakeoverRuns,
} from './unit-impact.loader';

const PAGE = 200;

const UPSERT_SQL = `INSERT INTO "event_impacts" ("tenant_id", "row_version", "event_id", "unit_id", "asset_id",
       "mode", "fraction", "basis", "rule_id", "rule_version", "standby_record_id", "resolved_at")
     VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
     ON CONFLICT ("event_id") DO UPDATE SET "unit_id" = EXCLUDED."unit_id", "asset_id" = EXCLUDED."asset_id",
       "mode" = EXCLUDED."mode", "fraction" = EXCLUDED."fraction", "basis" = EXCLUDED."basis",
       "rule_id" = EXCLUDED."rule_id", "rule_version" = EXCLUDED."rule_version",
       "standby_record_id" = EXCLUDED."standby_record_id", "resolved_at" = now(), "updated_at" = now(),
       "row_version" = "event_impacts"."row_version" + 1`;

/** What a stated (manual) impact records as its evidence: the event's own values. */
function statedImpact(event: ImpactEvent): ResolvedImpact {
  return {
    mode: event.impactMode,
    fraction: event.impactFraction,
    basis: 'stated',
    ruleId: null,
    ruleVersion: null,
    standbyRecordId: null,
  };
}

function reasonOf(resolved: ResolvedImpact): string {
  if (resolved.basis === 'standby_takeover')
    return `unit impact: standby took over (rule v${resolved.ruleVersion})`;
  if (resolved.basis === 'unit_rule')
    return `unit impact rule v${resolved.ruleVersion}: ${resolved.mode}`;
  return 'unit impact: no rule in force, the stop stops the unit';
}

/**
 * Plan 1.10 `ImpactResolver` (SME Q5 + D9) on stored events: for a live downtime event with an asset, the
 * unit impact rule in force at its start (and the rule standby's runs) give its impact; a changed impact
 * is written as a system coding revision (`impact_mode`, `impact_fraction`, `impact_basis`), so every
 * reader — ledgers, KPIs, the D12 gate, duplicate matching — reads one impact, and `event_impacts` keeps
 * the evidence. A stated impact (the manual override) is never replaced, only recorded. Idempotent.
 */
@Injectable()
export class UnitImpactService {
  /** Resolves one event; the messages of a changed event go to the caller's outbox. */
  async resolveEvent(
    manager: EntityManager,
    tenantId: string,
    eventId: string,
  ): Promise<EventChangeMessage[]> {
    const event = await loadImpactEvent(manager, tenantId, eventId);
    return event ? this.resolve(manager, event) : [];
  }

  /** Resolves the asset's stops of the unit starting in the window (a rule was approved or retired). */
  async resolveAsset(
    manager: EntityManager,
    window: AssetWindow,
  ): Promise<EventChangeMessage[]> {
    const messages: EventChangeMessage[] = [];
    let after: { start: Date; id: string } | null = null;
    for (;;) {
      const page = await loadImpactEventPage(manager, window, after, PAGE);
      for (const event of page)
        messages.push(...(await this.resolve(manager, event)));
      if (page.length < PAGE) return messages;
      const last = page[page.length - 1];
      after = { start: last.start, id: last.id };
    }
  }

  /** Standby runs changed: the stops of every asset whose rule names that standby, around the runs. */
  async resolveStandby(
    manager: EntityManager,
    input: {
      tenantId: string;
      standbyAssetId: string;
      from: Date;
      to: Date | null;
    },
  ): Promise<EventChangeMessage[]> {
    const messages: EventChangeMessage[] = [];
    for (const rule of await loadRulesOfStandby(manager, input)) {
      const from = new Date(input.from.getTime() - rule.takeoverSeconds * 1000);
      messages.push(
        ...(await this.resolveAsset(manager, {
          tenantId: input.tenantId,
          unitId: rule.unitId,
          assetId: rule.assetId,
          from,
          to: input.to,
        })),
      );
    }
    return messages;
  }

  private async resolve(
    manager: EntityManager,
    event: ImpactEvent,
  ): Promise<EventChangeMessage[]> {
    const rule = await loadImpactRule(manager, event);
    const runs = rule ? await loadTakeoverRuns(manager, event, rule) : [];
    const resolved = resolveUnitImpact(event, rule, runs);
    if (!resolved) {
      await record(manager, event, statedImpact(event));
      return [];
    }
    await record(manager, event, resolved);
    if (!impactChanged(event, resolved)) return [];
    const outcome = await applyUserChangeIn(manager, {
      actor: SYSTEM_ACTOR,
      eventId: event.id,
      tenantId: event.tenantId,
      reason: reasonOf(resolved),
      patch: {
        impactMode: resolved.mode,
        impactFraction:
          resolved.fraction === null ? null : Number(resolved.fraction),
        impactBasis: resolved.basis,
      } as Partial<ProductionEvent>,
    });
    return outcome.message ? [outcome.message] : [];
  }
}

async function record(
  manager: EntityManager,
  event: ImpactEvent,
  impact: ResolvedImpact,
): Promise<void> {
  await manager.query(UPSERT_SQL, [
    event.tenantId,
    event.id,
    event.unitId,
    event.assetId,
    impact.mode,
    impact.fraction,
    impact.basis,
    impact.ruleId,
    impact.ruleVersion,
    impact.standbyRecordId,
  ]);
}
