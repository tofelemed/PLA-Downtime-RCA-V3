import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { scopedQuery } from '../common/query/scoped-query';
import { CodeDefaults } from '../code-library/classification-basis';
import { CodeDefaultsService } from '../code-library/code-defaults.service';
import { ProductionEvent } from '../production-event/production-event.entity';
import {
  EventChangeMessage,
  EventChangeNotifier,
} from '../production-event/revisions/event-change.notifier';
import { actorFromContext } from '../production-event/revisions/revision-actor';
import { applyUserChangeIn } from '../production-event/revisions/user-change';
import { Asset } from '../asset/asset.entity';
import {
  affectedWindows,
  assertAssetUnit,
  classifyItems,
  codingChanged,
  codingPatch,
  codingSnapshot,
  rejectExclusions,
} from './bulk-code-plan';
import {
  BulkCodeApplied,
  BulkCodeCommand,
  BulkCodePreview,
  BulkCodes,
} from './bulk-code.types';
import { BulkJob } from './bulk-job.entity';
import { lockScopedEvents } from './operation-support';

/**
 * DT10 bulk coding: preview (before/after per event, exclusions, affected windows), atomic apply of up
 * to 500 events through the user-change path of plan 1.2 (one coding + effective revision per event),
 * and enqueueing of larger batches as a `bulk_jobs` row the worker applies in chunks.
 */
@Injectable()
export class BulkCodeService {
  constructor(
    @InjectRepository(ProductionEvent)
    private readonly events: Repository<ProductionEvent>,
    @InjectRepository(BulkJob)
    private readonly jobs: Repository<BulkJob>,
    private readonly codeDefaults: CodeDefaultsService,
    private readonly notifier: EventChangeNotifier,
  ) {}

  async preview(
    context: RequestContext,
    command: BulkCodeCommand,
  ): Promise<BulkCodePreview> {
    const tenantId = requireTenantId(context);
    const events = await scopedQuery(this.events, 'event', {
      context,
      unitProperty: 'unitId',
    })
      .andWhere('event.id IN (:...ids)', { ids: idsOf(command) })
      .getMany();
    const { eligible, exclusions } = classifyItems(command.items, events);
    const targets = eligible.map(({ event }) => event);
    await assertBulkAsset(
      this.events.manager,
      tenantId,
      command.codes,
      targets,
    );
    const defaults = await this.defaultsFor(tenantId, command.codes, targets);
    const items = targets.map((event) => {
      const before = codingSnapshot(event);
      const after = codingSnapshot({
        ...event,
        ...codingPatch(event, command.codes, defaults.get(event.id) ?? {}),
      });
      return {
        eventId: event.id,
        before,
        after,
        changed: codingChanged(before, after),
      };
    });
    return {
      count: items.length,
      changedCount: items.filter((item) => item.changed).length,
      items,
      exclusions,
      affectedWindows: affectedWindows(targets),
    };
  }

  /**
   * Atomic apply: any exclusion or failure leaves every event unchanged. `within` runs last in the same
   * transaction (the job worker records the chunk there, so a crash never splits apply and record).
   */
  async apply(
    context: RequestContext,
    command: BulkCodeCommand,
    within?: (manager: EntityManager) => Promise<void>,
  ): Promise<BulkCodeApplied> {
    const { applied, messages } = await this.events.manager.transaction(
      async (manager) => {
        const result = await this.applyIn(manager, context, command);
        await this.notifier.recordIn(manager, result.messages);
        if (within) await within(manager);
        return result;
      },
    );
    for (const message of messages) {
      this.notifier.eventChanged(message);
      this.notifier.legacyUpdated(
        message.eventId,
        message.tenantId,
        message.unitId,
      );
    }
    return applied;
  }

  /** Validates scope and repeated ids now; versions and states are checked per chunk by the worker. */
  async enqueue(
    context: RequestContext,
    command: BulkCodeCommand,
  ): Promise<BulkJob> {
    const tenantId = requireTenantId(context);
    const visible = await scopedQuery(this.events, 'event', {
      context,
      unitProperty: 'unitId',
    })
      .select([
        'event.id',
        'event.rowVersion',
        'event.physicalState',
        'event.unitId',
      ])
      .andWhere('event.id IN (:...ids)', { ids: idsOf(command) })
      .getMany();
    const { exclusions } = classifyItems(command.items, visible);
    rejectExclusions(
      exclusions.filter(({ reason }) =>
        ['not_found', 'duplicate'].includes(reason),
      ),
    );
    await assertBulkAsset(
      this.events.manager,
      tenantId,
      command.codes,
      visible,
    );
    const actorId = actorFromContext(context).id;
    return this.jobs.save(
      this.jobs.create({
        tenantId,
        kind: 'bulk_code',
        state: 'queued',
        total: command.items.length,
        processed: 0,
        failed: 0,
        chunks: [],
        payload: { ...command, actorId },
        requestedBy: actorId,
        finishedAt: null,
        createdBy: actorId,
        updatedBy: actorId,
      }),
    );
  }

  private async applyIn(
    manager: EntityManager,
    context: RequestContext,
    command: BulkCodeCommand,
  ): Promise<{ applied: BulkCodeApplied; messages: EventChangeMessage[] }> {
    const tenantId = requireTenantId(context);
    const locked = await lockScopedEvents(manager, context, idsOf(command));
    const { eligible, exclusions } = classifyItems(command.items, locked);
    rejectExclusions(exclusions);
    await assertBulkAsset(
      manager,
      tenantId,
      command.codes,
      eligible.map(({ event }) => event),
    );
    const defaults = await this.defaultsFor(
      tenantId,
      command.codes,
      eligible.map(({ event }) => event),
    );
    const actor = actorFromContext(context);
    const applied: BulkCodeApplied = { applied: 0, events: [] };
    const messages: EventChangeMessage[] = [];
    for (const { item } of eligible) {
      const { result, message } = await applyUserChangeIn(manager, {
        actor,
        eventId: item.eventId,
        tenantId,
        expectedRowVersion: item.expectedVersion,
        patch: (event) =>
          codingPatch(event, command.codes, defaults.get(event.id) ?? {}),
        reason: `bulk code: ${command.reason}`,
      });
      applied.applied += 1;
      applied.events.push({
        eventId: item.eventId,
        rowVersion: result?.rowVersion ?? item.expectedVersion,
      });
      if (message) messages.push(message);
    }
    return { applied, messages };
  }

  /** Reason-code defaults per event (the rule in force at each event's start, plan 1.3). */
  private async defaultsFor(
    tenantId: string,
    codes: BulkCodes,
    events: readonly ProductionEvent[],
  ): Promise<Map<string, CodeDefaults>> {
    const defaults = new Map<string, CodeDefaults>();
    const reasonCodeId = codes.reasonCodeId;
    if (!reasonCodeId) return defaults;
    for (const event of events) {
      defaults.set(
        event.id,
        await this.codeDefaults.defaultsFor(
          tenantId,
          reasonCodeId,
          new Date(event.startTime),
        ),
      );
    }
    return defaults;
  }
}

/** UX A-1: the bulk asset is the tenant's and of every event's unit (422 INVALID_REFERENCE). */
async function assertBulkAsset(
  manager: EntityManager,
  tenantId: string,
  codes: BulkCodes,
  events: readonly ProductionEvent[],
): Promise<void> {
  if (!codes.assetId) return;
  const asset = await manager.findOne(Asset, {
    where: { id: codes.assetId, tenantId },
    select: { id: true, unitId: true },
  });
  assertAssetUnit(events, asset);
}

function idsOf(command: BulkCodeCommand): string[] {
  return [...new Set(command.items.map(({ eventId }) => eventId))];
}
