import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { scopedQuery } from '../common/query/scoped-query';
import { ProductionEvent } from '../production-event/production-event.entity';
import { CodeDefaults } from './classification-basis';
import { CodeDefaultsService } from './code-defaults.service';
import { CodeLibraryService } from './code-library.service';

/** Counts per value of one classification axis. */
export type AxisCounts = Record<string, number>;

/**
 * `GET /reason-codes/{id}/mapping-preview` (plan 3.8): what the reason code's defaults in force now
 * would classify, next to how the events coded with it in the window are classified today.
 */
export interface CodeMappingPreviewV2View {
  codeId: string;
  from: string;
  to: string;
  /** defaults in force now: a mapping rule version, else the code's own default columns */
  proposed: CodeDefaults;
  events: number;
  current: { scheduleClass: AxisCounts; oeeComponent: AxisCounts };
  /** events whose stored value differs from the proposed default (axes without a proposal: 0) */
  wouldDiffer: { scheduleClass: number; oeeComponent: number };
}

interface Bucket {
  scheduleClass: string;
  oeeComponent: string;
  count: number;
}

export const PREVIEW_DAYS_DEFAULT = 30;
const DAY_MS = 24 * 3600 * 1000;

@Injectable()
export class CodeMappingPreviewService {
  constructor(
    private readonly codes: CodeLibraryService,
    private readonly defaults: CodeDefaultsService,
    @InjectRepository(ProductionEvent)
    private readonly events: Repository<ProductionEvent>,
  ) {}

  async preview(
    context: RequestContext,
    id: string,
    days = PREVIEW_DAYS_DEFAULT,
  ): Promise<CodeMappingPreviewV2View> {
    const code = await this.codes.find(context, 'reason', id);
    const to = new Date();
    const from = new Date(to.getTime() - days * DAY_MS);
    const proposed = await this.defaults.defaultsFor(
      requireTenantId(context),
      code.id,
      to,
    );
    const buckets = await this.buckets(context, code.id, from, to);
    const current = {
      scheduleClass: {} as AxisCounts,
      oeeComponent: {} as AxisCounts,
    };
    const wouldDiffer = { scheduleClass: 0, oeeComponent: 0 };
    for (const bucket of buckets) {
      for (const axis of ['scheduleClass', 'oeeComponent'] as const) {
        current[axis][bucket[axis]] =
          (current[axis][bucket[axis]] ?? 0) + bucket.count;
        const target = proposed[axis]?.value;
        if (target && target !== bucket[axis])
          wouldDiffer[axis] += bucket.count;
      }
    }
    return {
      codeId: code.id,
      from: from.toISOString(),
      to: to.toISOString(),
      proposed,
      events: buckets.reduce((total, bucket) => total + bucket.count, 0),
      current,
      wouldDiffer,
    };
  }

  /** One grouped query in the caller's unit scope (index tenant + reason + start). */
  private async buckets(
    context: RequestContext,
    reasonCodeId: string,
    from: Date,
    to: Date,
  ): Promise<Bucket[]> {
    const rows: Array<{
      scheduleClass: string;
      oeeComponent: string;
      count: string | number;
    }> = await scopedQuery(this.events, 'event', {
      context,
      unitProperty: 'unitId',
    })
      .select('event.scheduleClass', 'scheduleClass')
      .addSelect('event.oeeComponent', 'oeeComponent')
      .addSelect('count(*)::int', 'count')
      .andWhere('event.reasonCodeId = :reasonCodeId', { reasonCodeId })
      .andWhere('event.startTime >= :from AND event.startTime < :to', {
        from,
        to,
      })
      .andWhere('event.physicalState IN (:...states)', {
        states: ['open', 'closed'],
      })
      .groupBy('event.scheduleClass')
      .addGroupBy('event.oeeComponent')
      .getRawMany();
    return rows.map((row) => ({
      scheduleClass: row.scheduleClass,
      oeeComponent: row.oeeComponent,
      count: Number(row.count),
    }));
  }
}
