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
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { FxRatesService } from '../../valuation/fx-rates.service';
import { listResponse, ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { PROFILE_APPROVERS, PROFILE_WRITERS } from '../profiles/profile-roles';
import { APPROVE_DESCRIPTION, ApproveDto } from '../profiles/profile-v2.dto';
import { FxRateCreateDto, FxRateListQueryDto } from './valuation-v2.dto';
import { FxRateV2View, toFxRateView } from './valuation-v2.view';

const TENANT_WIDE =
  'FX rates apply to every unit: a tenant-wide grant is required (403 TENANT_SCOPE_REQUIRED). ';

/** The approved, dated FX rate table of plan 2.6 (D08: IRR and USD; VAL03). */
@ApiTags('v2 · Valuation')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'fx-rates', version: '2' })
export class FxRatesV2Controller {
  constructor(private readonly rates: FxRatesService) {}

  @Get()
  @ApiOperation({
    summary: 'List FX rate versions (keyset on effectiveFrom, id)',
  })
  async list(
    @Ctx() ctx: RequestContext,
    @Query() query: FxRateListQueryDto,
  ): Promise<ListResponse<FxRateV2View>> {
    const page = await this.rates.list(ctx, query);
    return listResponse(page.items.map(toFxRateView), page.nextCursor, {
      tenantId: requireTenantId(ctx),
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one FX rate version; foreign ids are 404' })
  async get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<FxRateV2View> {
    return toFxRateView(await this.rates.get(ctx, id));
  }

  @Post()
  @Idempotent()
  @Roles(...PROFILE_WRITERS)
  @ApiOperation({
    summary:
      'Create a draft FX rate version (1 fromCurrency = rate toCurrency)',
    description: `Requires \`Idempotency-Key\`. ${TENANT_WIDE}422 SAME_CURRENCY, INVALID_VALUE (rate ≤ 0).`,
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async create(
    @Ctx() ctx: RequestContext,
    @Body() body: FxRateCreateDto,
  ): Promise<FxRateV2View> {
    return toFxRateView(await this.rates.create(ctx, body));
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...PROFILE_APPROVERS)
  @ApiOperation({
    summary: 'Approve a draft FX rate version',
    description: `${TENANT_WIDE}${APPROVE_DESCRIPTION}`,
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async approve(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ApproveDto,
  ): Promise<FxRateV2View> {
    return toFxRateView(
      await this.rates.approve(ctx, id, body.supersede ?? false),
    );
  }

  @Post(':id/retire')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...PROFILE_APPROVERS)
  @ApiOperation({
    summary: 'Retire a draft or approved FX rate version',
    description: TENANT_WIDE,
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async retire(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<FxRateV2View> {
    return toFxRateView(await this.rates.retire(ctx, id));
  }
}
