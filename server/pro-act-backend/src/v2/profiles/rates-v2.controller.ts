import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { RatesService } from '../../profiles/rates.service';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { PROFILE_APPROVERS } from './profile-roles';
import { APPROVE_DESCRIPTION, ApproveDto } from './profile-v2.dto';
import { RateV2View, toRateView } from './profile-v2.view';

/** Unit-product rate versions (plan 2.2): approval and retirement by id. */
@ApiTags('v2 · Profiles')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'rates', version: '2' })
export class RatesV2Controller {
  constructor(private readonly rates: RatesService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get one rate version; foreign ids are 404' })
  async get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<RateV2View> {
    return toRateView(await this.rates.get(ctx, id));
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...PROFILE_APPROVERS)
  @ApiOperation({
    summary: 'Approve a draft rate version',
    description: APPROVE_DESCRIPTION,
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async approve(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ApproveDto,
  ): Promise<RateV2View> {
    return toRateView(
      await this.rates.approve(ctx, id, body.supersede ?? false),
    );
  }

  @Post(':id/retire')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...PROFILE_APPROVERS)
  @ApiOperation({
    summary: 'Retire a draft or approved rate version (never deleted)',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async retire(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<RateV2View> {
    return toRateView(await this.rates.retire(ctx, id));
  }
}
