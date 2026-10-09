import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
import { ValuationRatesService } from '../../profiles/valuation-rates.service';
import { ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { PROFILE_APPROVERS, PROFILE_WRITERS } from './profile-roles';
import { APPROVE_DESCRIPTION, ApproveDto } from './profile-v2.dto';
import { toValuationRateView, ValuationRateV2View } from './profile-v2.view';
import { ProfilesV2Service } from './profiles-v2.service';
import {
  ValuationRateCreateDto,
  ValuationRateListQueryDto,
} from './rate-v2.dto';

/** Valuation rate versions (plan 2.2, VAL01, D08): margins / standard cost of profiles, cost per hour of impact codes. */
@ApiTags('v2 · Profiles')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'valuation-rates', version: '2' })
export class ValuationRatesV2Controller {
  constructor(
    private readonly lists: ProfilesV2Service,
    private readonly rates: ValuationRatesService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List valuation rate versions (keyset on effectiveFrom, id)',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: ValuationRateListQueryDto,
  ): Promise<ListResponse<ValuationRateV2View>> {
    return this.lists.listValuationRates(ctx, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one valuation rate version; foreign ids are 404',
  })
  async get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ValuationRateV2View> {
    return toValuationRateView(await this.rates.get(ctx, id));
  }

  @Post()
  @Idempotent()
  @Roles(...PROFILE_WRITERS)
  @ApiOperation({
    summary: 'Create a draft valuation rate version',
    description:
      'Requires `Idempotency-Key`. profileId xor impactCodeId, of the tenant (422 INVALID_REFERENCE); ' +
      'contribution_margin needs a profile, cost_per_hour an impact code (422 INVALID_OWNER); perUom is the ' +
      'profile quantity unit or "h" (422 UOM_MISMATCH).',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async create(
    @Ctx() ctx: RequestContext,
    @Body() body: ValuationRateCreateDto,
  ): Promise<ValuationRateV2View> {
    return toValuationRateView(await this.rates.create(ctx, body));
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...PROFILE_APPROVERS)
  @ApiOperation({
    summary: 'Approve a draft valuation rate version',
    description: APPROVE_DESCRIPTION,
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async approve(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ApproveDto,
  ): Promise<ValuationRateV2View> {
    return toValuationRateView(
      await this.rates.approve(ctx, id, body.supersede ?? false),
    );
  }

  @Post(':id/retire')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...PROFILE_APPROVERS)
  @ApiOperation({
    summary: 'Retire a draft or approved valuation rate version',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async retire(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ValuationRateV2View> {
    return toValuationRateView(await this.rates.retire(ctx, id));
  }
}
