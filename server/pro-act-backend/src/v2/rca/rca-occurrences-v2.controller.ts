import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { RcaOccurrenceV2View } from '../../rca-case/occurrence-picker';
import { RcaOccurrencesService } from '../../rca-case/rca-occurrences.service';
import { ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { RcaOccurrenceV2ListQueryDto } from './rca-links-v2.dto';

/** UX G-3: plant-wide stop occurrence search for the RCA link picker (`linkType: occurrence`). */
@ApiTags('v2 · RCA')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'occurrences', version: '2' })
export class RcaOccurrencesV2Controller {
  constructor(private readonly occurrences: RcaOccurrencesService) {}

  @Get()
  @ApiOperation({
    summary:
      'Stop occurrences of your scope to link to an RCA case, newest first',
    description:
      'Needs a window (from/to, overlap, at most 366 days) or an eventId (422 WINDOW_REQUIRED / WINDOW_TOO_LONG / ' +
      'INVALID_RANGE). Filters: unit, asset, reason, description text (q). Each row: first and last time, event ' +
      'count, the first event (description, asset, reason) and the cases of your scope it is already linked to.',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: RcaOccurrenceV2ListQueryDto,
  ): Promise<ListResponse<RcaOccurrenceV2View>> {
    return this.occurrences.list(ctx, query);
  }
}
