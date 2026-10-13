import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { Ctx } from '../../../common/context/ctx.decorator';
import { RequestContext } from '../../../common/context/request-context';
import { MASTER_DATA_WRITERS } from '../../master-data/common/master-data-writer';
import { TenantQueryParamGuard } from '../../common/tenant-query-param.guard';
import {
  AttributeValuesQueryDto,
  AttributeValueV2View,
  SetAttributeValueDto,
} from './custom-attribute-values-v2.dto';
import { CustomAttributeValuesV2Service } from './custom-attribute-values-v2.service';

/** Custom attribute values of the acting plant's units and assets. */
@ApiTags('v2 · Custom attributes')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'custom-attribute-values', version: '2' })
export class CustomAttributeValuesV2Controller {
  constructor(private readonly values: CustomAttributeValuesV2Service) {}

  @Get()
  @ApiOperation({
    summary: 'The custom attribute values of one unit or asset',
    description: '404 when the record is not in the acting plant.',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: AttributeValuesQueryDto,
  ): Promise<AttributeValueV2View[]> {
    return this.values.list(ctx, query);
  }

  @Put()
  @Roles(...MASTER_DATA_WRITERS)
  @ApiOperation({
    summary: 'Set one custom attribute value of a unit or asset',
    description:
      '404 when the record is not in the acting plant or the definition does not apply in it; ' +
      '422 ATTRIBUTE_TYPE_MISMATCH when the definition is for another record type.',
  })
  set(
    @Ctx() ctx: RequestContext,
    @Body() body: SetAttributeValueDto,
  ): Promise<AttributeValueV2View> {
    return this.values.set(ctx, body);
  }
}
