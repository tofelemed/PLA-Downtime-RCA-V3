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
import { APPROVE_DESCRIPTION, ApproveDto } from '../profiles/profile-v2.dto';
import { FxRateCreateDto, FxRateListQueryDto } from './valuation-v2.dto';
import {
  FxRateTransitionV2View,
  FxRateV2View,
  toFxRateView,
  toFxTransitionView,
} from './valuation-v2.view';
import { FINANCE_APPROVERS, FINANCE_MAINTAINERS } from './valuation-roles';

const TENANT_WIDE =
  'FX rates apply to every unit: a tenant-wide grant is required (403 TENANT_SCOPE_REQUIRED). ';

const REVALUATION =
  'SME V7: approving (or retiring an approved) rate queues a recalculation of the periods it values — its whole ' +
  'months, every unit — and `revaluation` says so; approved periods get a change proposal, never an overwrite.';

const PROVISIONAL =
  'SME V7: final and provisional versions never overlap their own kind; a provisional draft is refused with ' +
  '409 FINAL_RATE_EXISTS where an approved final rate covers part of its window. A final rate wins over a ' +
  'provisional one, so approving it revalues what the provisional rate valued.';

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
  @Roles(...FINANCE_MAINTAINERS)
  @ApiOperation({
    summary:
      'Create a draft FX rate version (1 fromCurrency = rate toCurrency)',
    description:
      `Requires \`Idempotency-Key\`. ${TENANT_WIDE}422 SAME_CURRENCY, INVALID_VALUE (rate ≤ 0), ` +
      'PROVISIONAL_RATE_UNBOUNDED (a provisional rate without effectiveTo).',
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
  @Roles(...FINANCE_APPROVERS)
  @ApiOperation({
    summary: 'Approve a draft FX rate version (final or provisional)',
    description: `${TENANT_WIDE}${APPROVE_DESCRIPTION} ${REVALUATION} ${PROVISIONAL}`,
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async approve(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ApproveDto,
  ): Promise<FxRateTransitionV2View> {
    return toFxTransitionView(
      await this.rates.approve(ctx, id, body.supersede ?? false),
    );
  }

  @Post(':id/retire')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...FINANCE_APPROVERS)
  @ApiOperation({
    summary: 'Retire a draft or approved FX rate version',
    description: `${TENANT_WIDE}${REVALUATION}`,
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async retire(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<FxRateTransitionV2View> {
    return toFxTransitionView(await this.rates.retire(ctx, id));
  }
}
