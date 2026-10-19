import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { restrictedUnitIds } from '../../common/query/scoped-query';
import { BufferLevelRecord } from '../../plant-model/entities/buffer-level.entity';
import { PlantFlowRoute } from '../../plant-model/entities/plant-flow-route.entity';
import { keysetPage } from '../common/keyset-page';
import { listResponse, ListResponse } from '../common/response';
import {
  BufferLevelListQueryDto,
  FlowRouteListQueryDto,
} from './plant-flow-v2.dto';
import {
  BufferLevelV2View,
  FlowRouteV2View,
  toBufferLevelView,
  toFlowRouteView,
} from './plant-flow-v2.view';

const NO_MATCH_ID = '00000000-0000-0000-0000-000000000000';

/**
 * v2 lists of the material-flow map (SME E2): routes touching the caller's units (either end), keyset on
 * (effectiveFrom, id); buffer levels of buffers feeding the caller's units, newest first.
 */
@Injectable()
export class PlantFlowV2Service {
  constructor(
    @InjectRepository(PlantFlowRoute)
    private readonly routes: Repository<PlantFlowRoute>,
    @InjectRepository(BufferLevelRecord)
    private readonly levels: Repository<BufferLevelRecord>,
  ) {}

  async listRoutes(
    context: RequestContext,
    query: FlowRouteListQueryDto,
  ): Promise<ListResponse<FlowRouteV2View>> {
    const tenantId = requireTenantId(context);
    const qb = this.routes
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId });
    const units = restrictedUnitIds(context, tenantId);
    if (units) {
      const ids = units.length ? units : [NO_MATCH_ID];
      qb.andWhere(
        new Brackets((w) =>
          w
            .where('r.fromUnitId IN (:...ids)', { ids })
            .orWhere('r.toUnitId IN (:...ids)', { ids }),
        ),
      );
    }
    if (query.unitId) {
      qb.andWhere('(r.fromUnitId = :unit OR r.toUnitId = :unit)', {
        unit: query.unitId,
      });
    }
    if (query.state) qb.andWhere('r.state = :state', { state: query.state });
    const page = await keysetPage(qb, {
      alias: 'r',
      property: 'effectiveFrom',
      direction: 'ASC',
      cursor: query.cursor,
      limit: query.limit,
      focus: query.focus,
    });
    return listResponse(page.items.map(toFlowRouteView), page.nextCursor, {
      tenantId,
    });
  }

  async listLevels(
    context: RequestContext,
    query: BufferLevelListQueryDto,
  ): Promise<ListResponse<BufferLevelV2View>> {
    const tenantId = requireTenantId(context);
    const qb = this.levels
      .createQueryBuilder('l')
      .where('l.tenantId = :tenantId', { tenantId });
    const units = restrictedUnitIds(context, tenantId);
    if (units)
      qb.andWhere('l.toUnitId IN (:...ids)', {
        ids: units.length ? units : [NO_MATCH_ID],
      });
    if (query.toUnitId) qb.andWhere('l.toUnitId = :to', { to: query.toUnitId });
    const page = await keysetPage(qb, {
      alias: 'l',
      property: 'observedAt',
      direction: 'DESC',
      cursor: query.cursor,
      limit: query.limit,
    });
    return listResponse(page.items.map(toBufferLevelView), page.nextCursor, {
      tenantId,
    });
  }
}
