import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, In } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { assertBodyUnitsInScope } from '../../periods/period-scope';
import { ProductionEvent } from '../../production-event/production-event.entity';
import { StopIncidentBreak } from '../../stop-events/entities/stop-incident-break.entity';
import { StopIncidentMember } from '../../stop-events/entities/stop-incident-member.entity';
import { StopIncident } from '../../stop-events/entities/stop-incident.entity';
import { StopEventDecisionsService } from '../../stop-events/stop-event-decisions.service';
import { CursorCodec, invalidCursor } from '../common/cursor-codec';
import { StopIncidentListQueryDto } from './stop-events-v2.dto';
import {
  StopIncidentV2View,
  toEventSummary,
  toIncidentView,
} from './stop-events-v2.view';

const notFound = () =>
  new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });

/**
 * SME D5 repeat-stop incidents over HTTP: keyset list of a unit's incidents overlapping the window (newest
 * first) with their stops, the incident of one event, and the "new failure" marks that break a chain.
 */
@Injectable()
export class StopIncidentsV2Service {
  constructor(
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly decisions: StopEventDecisionsService,
  ) {}

  async list(
    context: RequestContext,
    query: StopIncidentListQueryDto,
  ): Promise<{ items: StopIncidentV2View[]; nextCursor: string | null }> {
    assertBodyUnitsInScope(context, [query.unitId], 'unitId');
    const qb = scopedQuery(this.manager.getRepository(StopIncident), 'i', {
      context,
      unitProperty: 'unitId',
    }).andWhere('i.unitId = :unitId', { unitId: query.unitId });
    if (query.from) {
      qb.andWhere('(i.endTime IS NULL OR i.endTime > :from)', {
        from: new Date(query.from),
      });
    }
    if (query.to) qb.andWhere('i.startTime < :to', { to: new Date(query.to) });
    if (query.cursor) {
      const { sortValue, id } = CursorCodec.decode(query.cursor);
      if (typeof sortValue !== 'string') throw invalidCursor();
      qb.andWhere('(i.startTime < :at OR (i.startTime = :at AND i.id < :id))', {
        at: new Date(sortValue),
        id,
      });
    }
    const rows = await qb
      .orderBy('i.startTime', 'DESC')
      .addOrderBy('i.id', 'DESC')
      .take(query.limit + 1)
      .getMany();
    const page = rows.slice(0, query.limit);
    const last = page[page.length - 1];
    return {
      items: await this.views(requireTenantId(context), page),
      nextCursor:
        rows.length > query.limit && last
          ? CursorCodec.encode({
              sortValue: new Date(last.startTime).toISOString(),
              id: last.id,
            })
          : null,
    };
  }

  /** The incident of the event's occurrence; null when it is not a repeat stop. */
  async forEvent(
    context: RequestContext,
    eventId: string,
  ): Promise<StopIncidentV2View | null> {
    const tenantId = requireTenantId(context);
    const event = await scopedQuery(
      this.manager.getRepository(ProductionEvent),
      'e',
      {
        context,
        unitProperty: 'unitId',
      },
    )
      .andWhere('e.id = :eventId', { eventId })
      .getOne();
    if (!event) throw notFound();
    const member = await this.manager
      .getRepository(StopIncidentMember)
      .findOneBy({ tenantId, occurrenceId: event.occurrenceId });
    if (!member) return null;
    const incident = await this.manager
      .getRepository(StopIncident)
      .findOneBy({ tenantId, id: member.incidentId });
    if (!incident) return null;
    const [view] = await this.views(tenantId, [incident]);
    return view;
  }

  markNewFailure(
    context: RequestContext,
    occurrenceId: string,
    reason: string,
  ) {
    return this.decisions.markNewFailure(context, occurrenceId, reason);
  }

  clearNewFailure(
    context: RequestContext,
    occurrenceId: string,
  ): Promise<void> {
    return this.decisions.clearNewFailure(context, occurrenceId);
  }

  private async views(
    tenantId: string,
    incidents: readonly StopIncident[],
  ): Promise<StopIncidentV2View[]> {
    if (incidents.length === 0) return [];
    const members = await this.manager
      .getRepository(StopIncidentMember)
      .findBy({
        tenantId,
        incidentId: In(incidents.map((i) => i.id)),
      });
    const occurrenceIds = members.map((m) => m.occurrenceId);
    const events = await this.liveEvents(tenantId, occurrenceIds);
    const breaks = await this.manager
      .getRepository(StopIncidentBreak)
      .findBy({ tenantId, occurrenceId: In(occurrenceIds) });
    const marked = new Set(breaks.map((b) => b.occurrenceId));
    return incidents.map((incident) => {
      const own = new Set(
        members
          .filter((m) => m.incidentId === incident.id)
          .map((m) => m.occurrenceId),
      );
      return toIncidentView(
        incident,
        events.filter((e) => own.has(e.occurrenceId)).map(toEventSummary),
        [...own].filter((id) => marked.has(id)).sort(),
      );
    });
  }

  private liveEvents(
    tenantId: string,
    occurrenceIds: string[],
  ): Promise<ProductionEvent[]> {
    if (occurrenceIds.length === 0) return Promise.resolve([]);
    return this.manager
      .getRepository(ProductionEvent)
      .createQueryBuilder('e')
      .where(
        'e.tenantId = :tenantId AND e.occurrenceId IN (:...occurrenceIds)',
        {
          tenantId,
          occurrenceIds,
        },
      )
      .andWhere(`e.physicalState IN ('open', 'closed')`)
      .andWhere(`e.physicalType = 'downtime'`)
      .orderBy('e.startTime', 'ASC')
      .addOrderBy('e.id', 'ASC')
      .getMany();
  }
}
