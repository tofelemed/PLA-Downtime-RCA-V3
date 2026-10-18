import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { EquipmentReadinessService } from './equipment-readiness.service';
import { EquipmentReadinessQueryDto } from './readiness-v2.dto';
import { EquipmentReadinessView } from './readiness-v2.view';

/** Read-only evidence snapshot: existing versions/samples only, no first-use defaults or workflow commands. */
@ApiTags('v2 · Equipment setup')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'equipment-setup', version: '2' })
export class EquipmentReadinessV2Controller {
  constructor(private readonly readiness: EquipmentReadinessService) {}
  @Get('readiness')
  @ApiOperation({
    summary:
      'Read equipment configuration, approval and telemetry gaps for one unit/product/window (maximum 31 days); no writes or automatic certification.',
  })
  @ApiOkResponse({ type: EquipmentReadinessView })
  read(
    @Ctx() context: RequestContext,
    @Query() query: EquipmentReadinessQueryDto,
  ): Promise<EquipmentReadinessView> {
    return this.readiness.read(context, query);
  }
}
