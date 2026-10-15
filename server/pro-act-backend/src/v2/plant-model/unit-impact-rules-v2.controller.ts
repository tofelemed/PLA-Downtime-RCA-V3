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
import { UnitImpactRulesService } from '../../plant-model/unit-impact-rules.service';
import { ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { APPROVE_DESCRIPTION, ApproveDto } from '../profiles/profile-v2.dto';
import {
  UNIT_IMPACT_RULE_APPROVERS,
  UNIT_IMPACT_RULE_WRITERS,
} from './unit-impact-roles';
import {
  UnitImpactRuleCreateDto,
  UnitImpactRuleListQueryDto,
} from './unit-impact-rules-v2.dto';
import {
  toUnitImpactRuleView,
  UnitImpactRuleV2View,
} from './unit-impact-rules-v2.view';
import { UnitImpactRulesV2Service } from './unit-impact-rules-v2.service';

const IDEMPOTENCY = { name: 'Idempotency-Key', required: true };

/**
 * Unit impact rules (plan 1.10 step 4, SME Q5 + D9): how a stop of one asset affects its unit — full stop,
 * a fraction of the rate, or none — and the standby that holds output when it starts in time.
 * Maker-checker master data; an approved or retired version re-resolves the asset's stops over its
 * validity. A stop whose impact a person stated keeps it.
 */
@ApiTags('v2 · Profiles')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'unit-impact-rules', version: '2' })
export class UnitImpactRulesV2Controller {
  constructor(
    private readonly lists: UnitImpactRulesV2Service,
    private readonly rules: UnitImpactRulesService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List unit impact rule versions of the caller’s units (keyset on effectiveFrom, id)',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: UnitImpactRuleListQueryDto,
  ): Promise<ListResponse<UnitImpactRuleV2View>> {
    return this.lists.list(ctx, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one unit impact rule version; foreign ids are 404',
  })
  async get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<UnitImpactRuleV2View> {
    return toUnitImpactRuleView(await this.rules.get(ctx, id));
  }

  @Post()
  @Idempotent()
  @Roles(...UNIT_IMPACT_RULE_WRITERS)
  @ApiOperation({
    summary: 'Create a draft unit impact rule version',
    description:
      'Requires `Idempotency-Key`. The unit in scope and the asset of that unit (422 INVALID_REFERENCE / ' +
      'ASSET_NOT_IN_UNIT); the standby another asset of the tenant (422 SAME_ASSET); `fractional` needs ' +
      '0 < fraction ≤ 1 and the other modes none (422 INVALID_FRACTION).',
  })
  @ApiHeader(IDEMPOTENCY)
  async create(
    @Ctx() ctx: RequestContext,
    @Body() body: UnitImpactRuleCreateDto,
  ): Promise<UnitImpactRuleV2View> {
    return toUnitImpactRuleView(await this.rules.create(ctx, body));
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...UNIT_IMPACT_RULE_APPROVERS)
  @ApiOperation({
    summary: 'Approve a draft unit impact rule version',
    description: `${APPROVE_DESCRIPTION} The asset's stops starting in its validity are resolved again (worker).`,
  })
  @ApiHeader(IDEMPOTENCY)
  async approve(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ApproveDto,
  ): Promise<UnitImpactRuleV2View> {
    return toUnitImpactRuleView(
      await this.rules.approve(ctx, id, body.supersede ?? false),
    );
  }

  @Post(':id/retire')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...UNIT_IMPACT_RULE_APPROVERS)
  @ApiOperation({
    summary: 'Retire a unit impact rule version (draft or approved)',
    description:
      'Requires `Idempotency-Key`. Stops that took their impact from a retired approved version go back to ' +
      'the default (full stop) unless another version is in force.',
  })
  @ApiHeader(IDEMPOTENCY)
  async retire(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<UnitImpactRuleV2View> {
    return toUnitImpactRuleView(await this.rules.retire(ctx, id));
  }
}
