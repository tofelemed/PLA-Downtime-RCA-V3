import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { INTEGRATION_WRITERS } from './intake-roles';
import { MqttPreviewV2Dto } from './mqtt-preview-v2.dto';
import { MqttPreviewV2Service } from './mqtt-preview-v2.service';

@ApiTags('v2 · Connections')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'connections', version: '2' })
export class MqttPreviewV2Controller {
  constructor(private readonly service: MqttPreviewV2Service) {}

  @Post(':id/mqtt-preview')
  @HttpCode(200)
  @Roles(...INTEGRATION_WRITERS)
  @ApiOperation({
    summary:
      'Decode a supplied MQTT packet and check effective signal binding; no broker I/O or writes',
    description:
      'Uses the saved payload profile, timestamp/quality/identity validation and tenant/unit-scoped signal lookup. Does not prove actual ingestion, event mapping, output authority or period accounting readiness.',
  })
  preview(
    @Ctx() context: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: MqttPreviewV2Dto,
  ) {
    return this.service.preview(context, id, body);
  }
}
