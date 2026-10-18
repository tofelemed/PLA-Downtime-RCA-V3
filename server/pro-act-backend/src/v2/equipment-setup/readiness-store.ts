import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import {
  EntityManager,
  EntityTarget,
  ObjectLiteral,
  SelectQueryBuilder,
} from 'typeorm';
import { RequestContext } from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { Unit } from '../../unit/unit.entity';

export const READINESS_ROW_LIMIT = 500;
@Injectable()
export class ReadinessStore {
  constructor(@InjectEntityManager() readonly manager: EntityManager) {}
  query<T extends ObjectLiteral>(
    entity: EntityTarget<T>,
    context: RequestContext,
    unitProperty?: string,
  ) {
    return scopedQuery(this.manager.getRepository(entity), 'r', {
      context,
      unitProperty,
    });
  }
  async rows<T extends ObjectLiteral>(
    query: SelectQueryBuilder<T>,
  ): Promise<T[]> {
    const rows = await query.take(READINESS_ROW_LIMIT + 1).getMany();
    if (rows.length > READINESS_ROW_LIMIT)
      throw new UnprocessableEntityException({
        code: 'READINESS_LIMIT',
        message:
          'Too many versions for one readiness check. Select a shorter window.',
      });
    return rows;
  }
  async unit(context: RequestContext, id: string) {
    const unit = await this.query(Unit, context, 'id')
      .andWhere('r.id = :id', { id })
      .getOne();
    if (!unit)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Production unit not found',
      });
    return unit;
  }
}
