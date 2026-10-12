import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { RequestContext } from '../common/context/request-context';
import { ProductionEvent } from '../production-event/production-event.entity';
import { EventChangeNotifier } from '../production-event/revisions/event-change.notifier';
import { closeIn } from './close-command';
import { mergeIn } from './merge-command';
import {
  OperationOutcome,
  OperationResult,
  withViolations,
} from './operation-support';
import { retractEventIn } from './retract-command';
import { splitIn } from './split-command';

export interface SplitInput {
  splitAt: Date;
  reason: string;
  expectedVersion: number;
}

export interface MergeInput {
  events: ReadonlyArray<{ eventId: string; expectedVersion: number }>;
  maxGapSeconds: number;
  overrideClassification: boolean;
  reason: string;
}

export interface CloseInput {
  endTime: Date;
  reason: string;
  expectedVersion: number;
}

export interface RetractInput {
  reason: string;
  expectedVersion: number;
}

/**
 * Event operations of plan 1.4 (spec DT09–DT11): split, merge and close, each in one transaction with
 * the events locked, immutable revisions, lineage in `event_relations` and nothing deleted. Change
 * messages (`EventChanged` with the affected interval, the Phase 2 recalculation trigger) go to the
 * outbox in the same transaction and are broadcast to browsers after commit.
 */
@Injectable()
export class EventCommandService {
  constructor(
    @InjectRepository(ProductionEvent)
    private readonly events: Repository<ProductionEvent>,
    private readonly notifier: EventChangeNotifier,
  ) {}

  split(
    context: RequestContext,
    eventId: string,
    input: SplitInput,
  ): Promise<OperationOutcome> {
    return this.run((manager) =>
      splitIn(manager, { ...input, context, eventId, now: new Date() }),
    );
  }

  merge(context: RequestContext, input: MergeInput): Promise<OperationOutcome> {
    return this.run((manager) => mergeIn(manager, { ...input, context }));
  }

  close(
    context: RequestContext,
    eventId: string,
    input: CloseInput,
  ): Promise<OperationOutcome> {
    return this.run((manager) =>
      closeIn(manager, { ...input, context, eventId, now: new Date() }),
    );
  }

  /** Tombstones a manual event (409 SOURCE_OWNED for source-delivered events). */
  retract(
    context: RequestContext,
    eventId: string,
    input: RetractInput,
  ): Promise<OperationOutcome> {
    return this.run((manager) =>
      retractEventIn(manager, { ...input, context, eventId }),
    );
  }

  private async run(
    work: (manager: EntityManager) => Promise<OperationResult>,
  ): Promise<OperationOutcome> {
    const { outcome, messages } = await withViolations(() =>
      this.events.manager.transaction(async (manager) => {
        const result = await work(manager);
        await this.notifier.recordIn(manager, result.messages);
        return result;
      }),
    );
    for (const message of messages) this.notifier.eventChanged(message);
    // one command acts in one tenant; without messages nothing changed
    const tenantId = messages[0]?.tenantId;
    if (!tenantId) return outcome;
    for (const id of [
      ...outcome.createdEventIds,
      ...outcome.supersededEventIds,
      ...outcome.updatedEventIds,
    ]) {
      this.notifier.legacyUpdated(id, tenantId);
    }
    return outcome;
  }
}
