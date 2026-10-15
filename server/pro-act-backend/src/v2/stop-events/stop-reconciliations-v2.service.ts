import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { Brackets, EntityManager, In } from 'typeorm';
import { RequestContext } from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { ProductionEvent } from '../../production-event/production-event.entity';
import { StopReconciliation } from '../../stop-events/entities/stop-reconciliation.entity';
import { StopEventDecisionsService } from '../../stop-events/stop-event-decisions.service';
import { CursorCodec, invalidCursor } from '../common/cursor-codec';
import { StopReconciliationListQueryDto } from './stop-events-v2.dto';
import {
  StopReconciliationV2View,
  toReconciliationView,
} from './stop-events-v2.view';

export interface ReconciliationPage {
  items: StopReconciliationV2View[];
  nextCursor: string | null;
}

/**
 * DT-04 duplicate merges and suggestions over HTTP: keyset list (newest first) of the caller's units with
 * both events summarised, and the decisions (accept, reject, undo) of `StopEventDecisionsService`.
 */
@Injectable()
export class StopReconciliationsV2Service {
  constructor(
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly decisions: StopEventDecisionsService,
  ) {}

  async list(
    context: RequestContext,
    query: StopReconciliationListQueryDto,
  ): Promise<ReconciliationPage> {
    const qb = scopedQuery(
      this.manager.getRepository(StopReconciliation),
      'r',
      {
        context,
        unitProperty: 'unitId',
      },
    );
    if (query.unitId)
      qb.andWhere('r.unitId = :unitId', { unitId: query.unitId });
    if (query.state) qb.andWhere('r.state = :state', { state: query.state });
    if (query.eventId) {
      qb.andWhere(
        new Brackets((w) =>
          w
            .where('r.keptEventId = :eventId', { eventId: query.eventId })
            .orWhere('r.evidenceEventId = :eventId', {
              eventId: query.eventId,
            }),
        ),
      );
    }
    if (query.cursor) {
      const { sortValue, id } = CursorCodec.decode(query.cursor);
      if (typeof sortValue !== 'string') throw invalidCursor();
      qb.andWhere('(r.createdAt < :at OR (r.createdAt = :at AND r.id < :id))', {
        at: new Date(sortValue),
        id,
      });
    }
    const rows = await qb
      .orderBy('r.createdAt', 'DESC')
      .addOrderBy('r.id', 'DESC')
      .take(query.limit + 1)
      .getMany();
    const page = rows.slice(0, query.limit);
    const last = page[page.length - 1];
    return {
      items: await this.views(page),
      nextCursor:
        rows.length > query.limit && last
          ? CursorCodec.encode({
              sortValue: new Date(last.createdAt).toISOString(),
              id: last.id,
            })
          : null,
    };
  }

  async accept(context: RequestContext, id: string, reason: string) {
    return this.view(await this.decisions.accept(context, id, reason));
  }

  async reject(context: RequestContext, id: string, reason: string) {
    return this.view(await this.decisions.reject(context, id, reason));
  }

  async undo(context: RequestContext, id: string, reason: string) {
    return this.view(await this.decisions.undo(context, id, reason));
  }

  private async view(
    row: StopReconciliation,
  ): Promise<StopReconciliationV2View> {
    const [view] = await this.views([row]);
    return view;
  }

  private async views(
    rows: readonly StopReconciliation[],
  ): Promise<StopReconciliationV2View[]> {
    const ids = [
      ...new Set(rows.flatMap((r) => [r.keptEventId, r.evidenceEventId])),
    ];
    const events =
      ids.length === 0
        ? []
        : await this.manager
            .getRepository(ProductionEvent)
            .findBy({ id: In(ids) });
    const byId = new Map(events.map((e) => [e.id, e]));
    return rows.map((row) => toReconciliationView(row, byId));
  }
}
