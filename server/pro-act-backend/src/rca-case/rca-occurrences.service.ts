import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RequestContext } from '../common/context/request-context';
import { listResponse, ListResponse } from '../v2/common/response';
import { RcaOccurrenceV2ListQueryDto } from '../v2/rca/rca-links-v2.dto';
import {
  OCCURRENCE_PICKER_SQL,
  OccurrenceRow,
  occurrencePage,
  occurrencePickerParams,
  RcaOccurrenceV2View,
} from './occurrence-picker';
import { scopeOf } from './rca-scope';

/** UX G-3: searchable, paginated stop occurrences of your scope for the RCA occurrence link picker. */
@Injectable()
export class RcaOccurrencesService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async list(
    context: RequestContext,
    query: RcaOccurrenceV2ListQueryDto,
  ): Promise<ListResponse<RcaOccurrenceV2View>> {
    const scope = scopeOf(context);
    const rows: OccurrenceRow[] = await this.dataSource.query(
      OCCURRENCE_PICKER_SQL,
      occurrencePickerParams(query, scope),
    );
    const page = occurrencePage(rows, query.limit);
    return listResponse(page.items, page.nextCursor, {
      tenantId: scope.tenantId,
      ...(scope.units ? { unitIds: scope.units } : {}),
    });
  }
}
