import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ReadOnlyAllowed } from '../../auth/decorators/read-only-allowed.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { SkipAudit } from '../../audit-log/skip-audit.decorator';
import { ETagInterceptor } from '../../common/concurrency/etag.interceptor';
import { IfMatch } from '../../common/concurrency/revision';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import {
  RuleCheck,
  RuleCommandsService,
} from '../../rules/rule-commands.service';
import {
  RuleSimulationService,
  RuleSimulationV2View,
} from '../../rules/rule-simulation.service';
import { RuleV2View, RuleVersionV2View } from '../../rules/rule-view';
import { RulesService } from '../../rules/rules.service';
import { ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import {
  RuleV2ChangeDto,
  RuleV2CreateDto,
  RuleV2ListQueryDto,
  RuleV2ReasonDto,
  RuleV2RollbackDto,
  RuleV2SimulateDto,
  RuleV2ValidateDto,
} from './rules-v2.dto';
import { rulesSchemaView, RulesSchemaV2View } from './rules-schema.view';

/** Authors of rule drafts and simulations (same writers as code libraries, DECISIONS §D). */
export const RULE_AUTHORS = ['master_data_admin', 'manager_approver'] as const;
/** Activation, rollback and retirement change what the server applies: an approver's act. */
export const RULE_APPROVERS = ['manager_approver'] as const;

const TENANT_WIDE =
  'Rules are tenant-wide: a tenant-wide grant is required (403 TENANT_SCOPE_REQUIRED). ';

/**
 * Declarative admin rules (plan 3.8, NFR02): JSON definitions over allowlisted fields and operators,
 * validated and evaluated only on the server; drafts, immutable versions, simulation and rollback.
 */
@ApiTags('v2 · Rules')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'rules', version: '2' })
export class RulesV2Controller {
  constructor(
    private readonly reads: RulesService,
    private readonly commands: RuleCommandsService,
    private readonly simulations: RuleSimulationService,
  ) {}

  @Get('schema')
  @ApiOperation({
    summary:
      'Rule grammar: allowlisted fields, operators, actions per kind and limits',
  })
  schema(): RulesSchemaV2View {
    return rulesSchemaView();
  }

  @Get()
  @ApiOperation({ summary: 'List rules of the tenant (newest first)' })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: RuleV2ListQueryDto,
  ): Promise<ListResponse<RuleV2View>> {
    return this.reads.list(ctx, query);
  }

  @Get(':id')
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Get one rule (ETag = rowVersion); foreign ids are 404',
  })
  get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<RuleV2View> {
    return this.reads.get(ctx, id);
  }

  @Get(':id/versions')
  @ApiOperation({
    summary:
      'Approved versions of a rule, newest first (activation and rollback history)',
  })
  versions(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<RuleVersionV2View[]> {
    return this.reads.history(ctx, id);
  }

  @Post('validate')
  @ReadOnlyAllowed()
  @SkipAudit()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate a definition without storing it (live builder feedback)',
    description:
      'Same checks as create/update: `{ valid, fieldErrors, conditionCount }`; nothing is stored.',
  })
  validate(
    @Ctx() ctx: RequestContext,
    @Body() body: RuleV2ValidateDto,
  ): Promise<RuleCheck> {
    return this.commands.check(ctx, body.kind, body.definition);
  }

  @Post()
  @Idempotent()
  @Roles(...RULE_AUTHORS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Create a rule as a draft',
    description: `Requires \`Idempotency-Key\`. ${TENANT_WIDE}422 RULE_INVALID / INVALID_REFERENCE; 409 RULE_EXISTS.`,
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async create(
    @Ctx() ctx: RequestContext,
    @Body() body: RuleV2CreateDto,
  ): Promise<RuleV2View> {
    const rule = await this.commands.create(ctx, body);
    return this.reads.get(ctx, rule.id);
  }

  @Put(':id')
  @Roles(...RULE_AUTHORS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary:
      'Change the draft and descriptive fields (the version in force is unchanged)',
    description: `Requires \`If-Match\` (428/412). ${TENANT_WIDE}409 RULE_RETIRED; 422 RULE_INVALID.`,
  })
  @ApiHeader({ name: 'If-Match', required: true })
  async change(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @IfMatch() expectedRowVersion: number,
    @Body() body: RuleV2ChangeDto,
  ): Promise<RuleV2View> {
    await this.commands.update(ctx, { id, expectedRowVersion }, body);
    return this.reads.get(ctx, id);
  }

  @Post(':id/simulate')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @Roles(...RULE_AUTHORS)
  @ApiOperation({
    summary:
      'Simulate the draft (or a version) over stored events; recorded as a rule run',
    description:
      "Requires `Idempotency-Key`. Events of the caller's scope overlapping [from, to) (≤ 92 days, latest " +
      '5000); before/after counts per set field, flag counts, sample diffs. 409 NO_DRAFT when there is ' +
      'nothing to simulate; 422 INVALID_RANGE / INVALID_REFERENCE.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  simulate(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: RuleV2SimulateDto,
  ): Promise<RuleSimulationV2View> {
    return this.simulations.simulate(ctx, id, body);
  }

  @Post(':id/activate')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @Roles(...RULE_APPROVERS)
  @ApiOperation({
    summary: 'Activate the draft as the next version',
    description:
      'SuperAdmin bypasses independence checks; it may perform every stage itself. Required data and workflow states still apply. ' +
      `Requires \`Idempotency-Key\` and \`If-Match\`. ${TENANT_WIDE}The draft author cannot activate it ` +
      '(403 SEPARATION_OF_DUTIES); 409 NO_DRAFT / RULE_RETIRED. Earlier versions are kept unchanged.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiHeader({ name: 'If-Match', required: true })
  async activate(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @IfMatch() expectedRowVersion: number,
    @Body() body: RuleV2ReasonDto,
  ): Promise<RuleV2View> {
    await this.commands.activate(ctx, { id, expectedRowVersion }, body.reason);
    return this.reads.get(ctx, id);
  }

  @Post(':id/rollback')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @Roles(...RULE_APPROVERS)
  @ApiOperation({
    summary: 'Restore an earlier version as the next version',
    description:
      `Requires \`Idempotency-Key\` and \`If-Match\`. ${TENANT_WIDE}422 INVALID_REFERENCE for an unknown ` +
      'version; 409 INVALID_TRANSITION when it is already in force, RULE_RETIRED when retired.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiHeader({ name: 'If-Match', required: true })
  async rollback(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @IfMatch() expectedRowVersion: number,
    @Body() body: RuleV2RollbackDto,
  ): Promise<RuleV2View> {
    await this.commands.rollback(
      ctx,
      { id, expectedRowVersion },
      body.toVersion,
      body.reason,
    );
    return this.reads.get(ctx, id);
  }

  @Post(':id/retire')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @Roles(...RULE_APPROVERS)
  @ApiOperation({
    summary: 'Retire a rule (no longer applied; versions and runs stay)',
    description: `Requires \`Idempotency-Key\` and \`If-Match\`. ${TENANT_WIDE}409 RULE_RETIRED.`,
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiHeader({ name: 'If-Match', required: true })
  async retire(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @IfMatch() expectedRowVersion: number,
  ): Promise<RuleV2View> {
    await this.commands.retire(ctx, { id, expectedRowVersion });
    return this.reads.get(ctx, id);
  }
}
