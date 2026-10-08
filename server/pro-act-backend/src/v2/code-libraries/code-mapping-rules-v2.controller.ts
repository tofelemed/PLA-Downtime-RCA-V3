import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import {
  CodeMappingRuleService,
  CodeMappingRuleView,
} from '../../code-library/code-mapping-rule.service';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { CODE_WRITERS } from './code-library-v2.controller';
import {
  CodeMappingRuleV2CreateDto,
  CodeMappingRuleV2ListQueryDto,
} from './code-mapping-rule-v2.dto';

@ApiTags('v2 · Code Mapping Rules')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'code-mapping-rules', version: '2' })
export class CodeMappingRulesV2Controller {
  constructor(private readonly rules: CodeMappingRuleService) {}

  @Get()
  @ApiOperation({
    summary: 'List versioned code mapping rules',
    description:
      'All versions by default; `asOf` keeps the version in force per (kind, source code).',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: CodeMappingRuleV2ListQueryDto,
  ): Promise<ListResponse<CodeMappingRuleView>> {
    return this.rules.list(ctx, query);
  }

  @Post()
  @Idempotent()
  @Roles(...CODE_WRITERS)
  @ApiOperation({
    summary: 'Add a rule version (spec §3.2)',
    description:
      'Requires `Idempotency-Key`. A rule for an existing (kind, source code) becomes its next version; ' +
      'earlier versions are never changed. 422 INVALID_REFERENCE / INVALID_RULE_TARGET on bad codes or values.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  create(
    @Ctx() ctx: RequestContext,
    @Body() body: CodeMappingRuleV2CreateDto,
  ): Promise<CodeMappingRuleView> {
    return this.rules.create(ctx, body);
  }
}
