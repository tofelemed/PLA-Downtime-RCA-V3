import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import {
  restrictedUnitIds,
  scopedQuery,
} from '../../common/query/scoped-query';
import { ProductionEvent } from '../../production-event/production-event.entity';
import { invalid, notFound } from '../../profiles/profile-errors';
import { escapeLike } from '../administration/users/plant-user-directory';
import { approvedSnapshotView } from '../../rca-case/approved-snapshot-view';
import { defaultValuationBasis } from '../../valuation/valuation-policy.store';
import { listResponse, ListResponse } from '../common/response';
import {
  ATTRIBUTED_QUANTITIES_SQL,
  ATTRIBUTED_VALUES_SQL,
} from './event-attributed-losses.sql';
import {
  attributedPeriods,
  EventAttributedLossesV2View,
  QuantityRow,
  ValueRow,
} from './event-attributed-losses.view';
import { LossLinePickerV2View, lossLinePickerPage } from './loss-line-picker';
import { LossLineListQueryDto, PICKER_LOSS_KINDS } from './loss-lines-v2.dto';

/** At most this many periods are listed for one event (a long stop spans a few shifts). */
export const MAX_ATTRIBUTED_PERIODS = 200;

/**
 * Reads of stored loss lines by their cause (UX G-2b) and a plant-wide loss-line picker (UX G-3). Tenant and
 * unit scope from identity; nothing is recomputed — the figures are the engine's and the approval's.
 */
@Injectable()
export class LossAttributionV2Service {
  constructor(
    @InjectRepository(ProductionEvent)
    private readonly events: Repository<ProductionEvent>,
  ) {}

  /** Loss lines attributing one event, per period revision; 404 for an event outside tenant or scope. */
  async attributedLosses(
    context: RequestContext,
    eventId: string,
  ): Promise<EventAttributedLossesV2View> {
    const tenantId = requireTenantId(context);
    const event = await scopedQuery(this.events, 'e', {
      context,
      unitProperty: 'unitId',
    })
      .select(['e.id'])
      .andWhere('e.id = :eventId', { eventId })
      .getOne();
    if (!event) throw notFound('Production event');
    const manager = this.events.manager;
    // owner 18 Oct 2026: the view frozen when the event's periods were approved, as on the investigation
    const frozen = await approvedSnapshotView(manager, tenantId, {
      eventIds: [event.id],
    });
    const view =
      frozen?.view ?? (await defaultValuationBasis(manager, tenantId));
    const params = [
      tenantId,
      event.id,
      PICKER_LOSS_KINDS,
      restrictedUnitIds(context, tenantId),
      MAX_ATTRIBUTED_PERIODS + 1,
    ];
    const quantities: QuantityRow[] = await manager.query(
      ATTRIBUTED_QUANTITIES_SQL,
      params,
    );
    const values: ValueRow[] =
      quantities.length > 0
        ? await manager.query(ATTRIBUTED_VALUES_SQL, [...params, view])
        : [];
    const { items, truncated } = attributedPeriods(
      quantities,
      values,
      MAX_ATTRIBUTED_PERIODS,
    );
    return {
      eventId: event.id,
      valuationView: view,
      valuationViewSource: frozen ? 'approved_snapshot' : 'policy_default',
      items,
      truncated,
      asOf: new Date().toISOString(),
    };
  }

  /** One keyset page of loss lines across the caller's units (newest period first). */
  async lossLines(
    context: RequestContext,
    query: LossLineListQueryDto,
  ): Promise<ListResponse<LossLinePickerV2View>> {
    const tenantId = requireTenantId(context);
    if (
      query.from &&
      query.to &&
      !(Date.parse(query.from) < Date.parse(query.to))
    ) {
      throw invalid('INVALID_RANGE', 'from must be before to');
    }
    const scopeUnitIds = restrictedUnitIds(context, tenantId);
    const page = await lossLinePickerPage(this.events.manager, {
      tenantId,
      scopeUnitIds,
      unitIds: query.unitIds,
      reasonCodeIds: query.reasonCodeIds,
      kinds: query.kinds ?? PICKER_LOSS_KINDS,
      pattern: query.q ? `%${escapeLike(query.q)}%` : null,
      from: query.from,
      to: query.to,
      cursor: query.cursor,
      limit: query.limit,
    });
    return listResponse(page.items, page.nextCursor, {
      tenantId,
      ...(scopeUnitIds ? { unitIds: scopeUnitIds } : {}),
    });
  }
}
