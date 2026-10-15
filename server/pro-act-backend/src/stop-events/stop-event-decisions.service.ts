import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { scopedQuery } from '../common/query/scoped-query';
import {
  CAUSE_FIELDS,
  CauseValues,
} from '../domain/events/stop-reconciliation';
import { ProductionEvent } from '../production-event/production-event.entity';
import {
  EventChangeMessage,
  EventChangeNotifier,
} from '../production-event/revisions/event-change.notifier';
import { actorFromContext } from '../production-event/revisions/revision-actor';
import { mergeDuplicate, undoMerge } from './duplicate-merge';
import { StopIncidentBreak } from './entities/stop-incident-break.entity';
import { StopReconciliation } from './entities/stop-reconciliation.entity';
import { IncidentGroupingService } from './incident-grouping.service';

const notFound = () =>
  new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
const invalidState = (message: string) =>
  new ConflictException({ code: 'INVALID_STATE', message });

/**
 * People's decisions on stop duplicates and incidents (DT-04 / SME D5): accept or reject a suggested
 * duplicate merge, undo a merge (automatic or accepted), and mark an occurrence as a new failure (or undo
 * the mark) so the incident grouping breaks the chain before it. Each runs in one transaction with the
 * events locked; event writes are revisions with the user as actor and go to the outbox (realtime after
 * commit). Rows outside the caller's tenant or units are 404.
 */
@Injectable()
export class StopEventDecisionsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly notifier: EventChangeNotifier,
    private readonly incidents: IncidentGroupingService,
  ) {}

  accept(
    context: RequestContext,
    id: string,
    reason: string,
  ): Promise<StopReconciliation> {
    return this.decide(
      context,
      id,
      async (manager, row) => {
        if (row.state !== 'suggested')
          throw invalidState(`The pair is ${row.state}, not suggested`);
        const evidence = await manager.findOneByOrFail(ProductionEvent, {
          id: row.evidenceEventId,
        });
        const outcome = await mergeDuplicate(
          manager,
          {
            keptId: row.keptEventId,
            evidenceId: row.evidenceEventId,
            copied: causeOf(evidence),
          },
          {
            actor: actorFromContext(context),
            reason: `duplicate stop merged: ${reason}`,
          },
        );
        if (!outcome) throw invalidState('One of the stops is no longer live');
        Object.assign(row, {
          state: 'merged',
          mode: 'manual',
          copied: outcome.copied,
          evidenceOccurrenceId: outcome.evidenceOccurrenceId,
        });
        return outcome.messages;
      },
      reason,
    );
  }

  reject(
    context: RequestContext,
    id: string,
    reason: string,
  ): Promise<StopReconciliation> {
    return this.decide(
      context,
      id,
      (_manager, row) => {
        if (row.state !== 'suggested' && row.state !== 'expired') {
          throw invalidState(
            `The pair is ${row.state}; only a suggestion can be rejected`,
          );
        }
        row.state = 'rejected';
        return Promise.resolve([]);
      },
      reason,
    );
  }

  undo(
    context: RequestContext,
    id: string,
    reason: string,
  ): Promise<StopReconciliation> {
    return this.decide(
      context,
      id,
      async (manager, row) => {
        if (row.state !== 'merged')
          throw invalidState(`The pair is ${row.state}, not merged`);
        const messages = await undoMerge(
          manager,
          {
            keptId: row.keptEventId,
            evidenceId: row.evidenceEventId,
            copied: row.copied,
            evidenceOccurrenceId: row.evidenceOccurrenceId,
          },
          {
            actor: actorFromContext(context),
            reason: `duplicate merge undone: ${reason}`,
          },
        );
        if (!messages)
          throw invalidState(
            'The kept stop changed since the merge (split, merged or retracted)',
          );
        row.state = 'undone';
        return messages;
      },
      reason,
    );
  }

  /** SME D5: the occurrence is a new failure (function restored before it); regroups its unit. */
  async markNewFailure(
    context: RequestContext,
    occurrenceId: string,
    reason: string,
  ): Promise<StopIncidentBreak> {
    const tenantId = requireTenantId(context);
    return this.dataSource.transaction(async (manager) => {
      const unitId = await this.unitOfOccurrence(
        manager,
        context,
        occurrenceId,
      );
      const repository = manager.getRepository(StopIncidentBreak);
      const existing = await repository.findOneBy({ tenantId, occurrenceId });
      const saved =
        existing ??
        (await repository.save(
          repository.create({
            tenantId,
            unitId,
            occurrenceId,
            reason,
            createdBy: context.userId,
            updatedBy: context.userId,
          }),
        ));
      await this.regroupAround(manager, { tenantId, unitId }, occurrenceId);
      return saved;
    });
  }

  /** Undo of a "new failure" mark: the grouping may join the occurrence to the stop before it again. */
  async clearNewFailure(
    context: RequestContext,
    occurrenceId: string,
  ): Promise<void> {
    const tenantId = requireTenantId(context);
    await this.dataSource.transaction(async (manager) => {
      const unitId = await this.unitOfOccurrence(
        manager,
        context,
        occurrenceId,
      );
      await manager
        .getRepository(StopIncidentBreak)
        .delete({ tenantId, occurrenceId });
      await this.regroupAround(manager, { tenantId, unitId }, occurrenceId);
    });
  }

  private async decide(
    context: RequestContext,
    id: string,
    work: (
      manager: EntityManager,
      row: StopReconciliation,
    ) => Promise<EventChangeMessage[]>,
    reason: string,
  ): Promise<StopReconciliation> {
    const { row, messages } = await this.dataSource.transaction(
      async (manager) => {
        const locked = await scopedQuery(
          manager.getRepository(StopReconciliation),
          'r',
          {
            context,
            unitProperty: 'unitId',
          },
        )
          .andWhere('r.id = :id', { id })
          .setLock('pessimistic_write')
          .getOne();
        if (!locked) throw notFound();
        const changes = await work(manager, locked);
        Object.assign(locked, {
          decidedBy: context.userId,
          decidedAt: new Date(),
          decisionReason: reason,
          updatedBy: context.userId,
        });
        const saved = await manager.save(locked);
        await this.notifier.recordIn(manager, changes);
        return { row: saved, messages: changes };
      },
    );
    messages.forEach((message) => this.notifier.eventChanged(message));
    return row;
  }

  private async unitOfOccurrence(
    manager: EntityManager,
    context: RequestContext,
    occurrenceId: string,
  ): Promise<string> {
    const event = await scopedQuery(
      manager.getRepository(ProductionEvent),
      'e',
      {
        context,
        unitProperty: 'unitId',
      },
    )
      .andWhere('e.occurrenceId = :occurrenceId', { occurrenceId })
      .andWhere(`e.physicalType = 'downtime'`)
      .orderBy('e.startTime', 'ASC')
      .getOne();
    if (!event) throw notFound();
    return event.unitId;
  }

  private async regroupAround(
    manager: EntityManager,
    scope: { tenantId: string; unitId: string },
    occurrenceId: string,
  ): Promise<void> {
    const [span] = await manager.query<
      Array<{ start_time: Date; end_time: Date | null }>
    >(
      `SELECT min("start_time") AS "start_time", max("end_time") AS "end_time" FROM "production_events"
        WHERE "tenant_id" = $1 AND "occurrence_id" = $2`,
      [scope.tenantId, occurrenceId],
    );
    const start = new Date(span.start_time);
    await this.incidents.regroupUnit(
      manager,
      scope,
      { start, end: span.end_time ? new Date(span.end_time) : null },
      new Date(),
    );
  }
}

/** The event's cause values (what a duplicate can contribute to the stop that is kept). */
function causeOf(event: ProductionEvent): CauseValues {
  const values: CauseValues = {};
  for (const field of CAUSE_FIELDS) values[field] = event[field] ?? null;
  return values;
}
