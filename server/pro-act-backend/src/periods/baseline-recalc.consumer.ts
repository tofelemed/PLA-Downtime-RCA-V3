import { Injectable, OnModuleInit } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { InProcessEventBus } from '../common/outbox/in-process-event-bus';
import { InboxService } from '../common/outbox/inbox.service';
import { PublishedMessage } from '../common/outbox/outbox-transport';
import { PROFILE_BASELINE_CHANGED } from '../profiles/profile-events';
import { ActualsJobsService } from './actuals-jobs.service';
import {
  BaselineChangedPayload,
  BaselineLookups,
  baselineRecalcScope,
  VALUATION_SUBJECTS,
} from './baseline-recalc-scope';

const CONSUMER = 'period-baseline';

/**
 * LA-03: an approved, superseded, retired or imported baseline (profile, rate, valuation rate) queues a
 * recompute of the periods it covers, consumed once through the inbox. The calculation run decides
 * what changed (input fingerprint): unchanged periods keep their run, in-review revisions go stale and
 * approved ones get a change proposal (`AccountingRevisionHooks`).
 */
@Injectable()
export class BaselineRecalcConsumer implements OnModuleInit {
  constructor(
    private readonly bus: InProcessEventBus,
    private readonly inbox: InboxService,
    private readonly jobs: ActualsJobsService,
  ) {}

  onModuleInit(): void {
    this.bus.subscribe(PROFILE_BASELINE_CHANGED, async (message) => {
      await this.inbox.runOnce(
        {
          key: `${CONSUMER}:${message.id}`,
          tenantId: message.tenantId,
          consumer: CONSUMER,
          type: message.type,
        },
        (manager) => this.onBaselineChanged(manager, message),
      );
    });
  }

  private async onBaselineChanged(
    manager: EntityManager,
    message: PublishedMessage,
  ): Promise<void> {
    const payload = message.payload as BaselineChangedPayload;
    const lookups = await lookupsOf(manager, message, payload);
    const scope = baselineRecalcScope(message.aggregateId, payload, lookups);
    if (!scope) return;
    await this.jobs.enqueue(manager, {
      tenantId: message.tenantId,
      ...scope,
      trigger: recalcTriggerOf(payload),
      scopeUnitIds: null,
      requestedBy: null,
    });
  }
}

/**
 * The recalculation reason: `<subject>_changed` for a valuation input (FX rate, valuation policy, demand
 * status — its change proposal reads "valuation change"), else `profile_baseline_changed`.
 */
export function recalcTriggerOf(payload: BaselineChangedPayload): string {
  const subject = payload.subject ?? '';
  return (VALUATION_SUBJECTS as readonly string[]).includes(subject)
    ? `${subject}_changed`
    : 'profile_baseline_changed';
}

async function lookupsOf(
  manager: EntityManager,
  message: PublishedMessage,
  payload: BaselineChangedPayload,
): Promise<BaselineLookups> {
  const ids = [message.aggregateId, ...(payload.profileIds ?? [])];
  const profiles: Array<{ id: string; unit_id: string }> = await manager.query(
    `SELECT "id", "unit_id" FROM "production_profiles"
      WHERE "tenant_id" = $1 AND "id"::text = ANY($2::text[])`,
    [message.tenantId, ids],
  );
  const profileUnits = new Map(profiles.map((p) => [p.id, p.unit_id]));
  if (payload.subject !== 'rate_import') {
    return { profileUnits, importWindow: null };
  }
  return { profileUnits, importWindow: await importWindowOf(manager, message) };
}

/** Effective window of the rates an applied import wrote (open-ended when any of them is). */
async function importWindowOf(
  manager: EntityManager,
  message: PublishedMessage,
): Promise<BaselineLookups['importWindow']> {
  const rows: Array<{ from: Date | null; to: Date | null; open: boolean }> =
    await manager.query(
      `SELECT min("effective_from") AS "from", max("effective_to") AS "to",
              bool_or("effective_to" IS NULL) AS "open"
         FROM "unit_product_rates"
        WHERE "tenant_id" = $1 AND "rate_import_id" = $2`,
      [message.tenantId, message.aggregateId],
    );
  const row = rows[0];
  if (!row?.from) return null;
  return {
    from: new Date(row.from),
    to: row.open || !row.to ? null : new Date(row.to),
  };
}
