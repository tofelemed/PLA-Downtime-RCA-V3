import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { applyOverlapWindow } from '../common/query/overlap-window';
import { ScheduleClass } from '../domain/events/event-classification';
import {
  computeUnitDowntime,
  UnitDowntime,
} from '../domain/events/unit-downtime';
import { BoundedInterval } from '../domain/time/interval-algebra';
import { ProductionEvent } from './production-event.entity';

export interface UnitDowntimeFilter {
  /** limit to these schedule classes (e.g. unplanned only); all when omitted */
  scheduleClasses?: ScheduleClass[];
  /** moment running events are measured to; defaults to now */
  asOf?: Date;
}

/**
 * Unit downtime for a window (DT05): eligible events are downtime that is neither superseded nor
 * retracted; overlapping stops of several assets count once. Feeds the KPI engine (2.7) and the
 * Downtime Analysis page (3.3).
 */
@Injectable()
export class UnitDowntimeService {
  constructor(
    @InjectRepository(ProductionEvent)
    private readonly events: Repository<ProductionEvent>,
  ) {}

  async unionForWindow(
    tenantId: string,
    unitId: string,
    window: BoundedInterval,
    filter: UnitDowntimeFilter = {},
  ): Promise<UnitDowntime> {
    const qb = this.events
      .createQueryBuilder('event')
      .select([
        'event.id',
        'event.occurrenceId',
        'event.assetId',
        'event.startTime',
        'event.endTime',
      ])
      .where('event.tenantId = :tenantId AND event.unitId = :unitId', {
        tenantId,
        unitId,
      })
      .andWhere("event.physicalType = 'downtime'")
      .andWhere("event.physicalState IN ('open', 'closed')");
    if (filter.scheduleClasses?.length) {
      qb.andWhere('event.scheduleClass IN (:...scheduleClasses)', {
        scheduleClasses: filter.scheduleClasses,
      });
    }
    applyOverlapWindow(
      qb,
      { alias: 'event', start: 'startTime', end: 'endTime' },
      window.start,
      window.end,
    );
    const rows = await qb.getMany();
    return computeUnitDowntime(
      rows.map((row) => ({
        id: row.id,
        occurrenceId: row.occurrenceId,
        assetId: row.assetId ?? null,
        start: new Date(row.startTime),
        end: row.endTime ? new Date(row.endTime) : null,
      })),
      window,
      filter.asOf ?? new Date(),
    );
  }
}
