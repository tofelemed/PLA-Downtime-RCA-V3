import { MoneyOnly } from '../../auth/money/money.decorators';
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
import { DemandStatusesService } from '../../valuation/demand-statuses.service';
import { listResponse, ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { APPROVE_DESCRIPTION, ApproveDto } from '../profiles/profile-v2.dto';
import {
  DemandStatusCreateDto,
  DemandStatusListQueryDto,
} from './demand-status-v2.dto';
import {
  DemandStatusTransitionV2View,
  DemandStatusV2View,
  toDemandStatusView,
  toDemandTransitionView,
} from './demand-status-v2.view';
import { FINANCE_APPROVERS, FINANCE_MAINTAINERS } from './valuation-roles';

const TENANT_WIDE =
  'A status applies to every unit making the product: a tenant-wide grant is required (403 TENANT_SCOPE_REQUIRED). ';
const REVALUATION =
  'SME V7: approving (or retiring an approved) status queues a recalculation of the periods it covers (`revaluation`).';

/** Demand statuses of products (SME V3: sold out = lost tonnes are lost sales). */
@ApiTags('v2 · Valuation')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'demand-statuses', version: '2' })
// QA re-test 2026-10-19: finance records are money (403 MONEY_NOT_VISIBLE for operators)
@MoneyOnly()
export class DemandStatusesV2Controller {
  constructor(private readonly statuses: DemandStatusesService) {}

  @Get()
  @ApiOperation({
    summary: 'List demand status versions (keyset on effectiveFrom, id)',
  })
  async list(
    @Ctx() ctx: RequestContext,
    @Query() query: DemandStatusListQueryDto,
  ): Promise<ListResponse<DemandStatusV2View>> {
    const page = await this.statuses.list(ctx, query);
    return listResponse(page.items.map(toDemandStatusView), page.nextCursor, {
      tenantId: requireTenantId(ctx),
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one demand status version; foreign ids are 404',
  })
  async get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<DemandStatusV2View> {
    return toDemandStatusView(await this.statuses.get(ctx, id));
  }

  @Post()
  @Idempotent()
  @Roles(...FINANCE_MAINTAINERS)
  @ApiOperation({
    summary: 'Create a draft demand status of a product',
    description: `Requires \`Idempotency-Key\`. ${TENANT_WIDE}422 INVALID_REFERENCE (product of another tenant), EVIDENCE_REQUIRED, INVALID_EFFECTIVE_DATES.`,
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async create(
    @Ctx() ctx: RequestContext,
    @Body() body: DemandStatusCreateDto,
  ): Promise<DemandStatusV2View> {
    return toDemandStatusView(await this.statuses.create(ctx, body));
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...FINANCE_APPROVERS)
  @ApiOperation({
    summary: 'Approve a draft demand status',
    description: `${TENANT_WIDE}${APPROVE_DESCRIPTION} ${REVALUATION}`,
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async approve(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ApproveDto,
  ): Promise<DemandStatusTransitionV2View> {
    return toDemandTransitionView(
      await this.statuses.approve(ctx, id, body.supersede ?? false),
    );
  }

  @Post(':id/retire')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...FINANCE_APPROVERS)
  @ApiOperation({
    summary: 'Retire a draft or approved demand status',
    description: `${TENANT_WIDE}${REVALUATION}`,
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async retire(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<DemandStatusTransitionV2View> {
    return toDemandTransitionView(await this.statuses.retire(ctx, id));
  }
}
