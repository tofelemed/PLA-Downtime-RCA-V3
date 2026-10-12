import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { Roles } from '../../auth/decorators/roles.decorator';
import { ETagInterceptor } from '../../common/concurrency/etag.interceptor';
import { IfMatch } from '../../common/concurrency/revision';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import {
  RcaActionsService,
  RcaOutcomeV2View,
} from '../../rca-case/rca-actions.service';
import {
  RcaCaseCommandsService,
  RcaCaseSummaryV2View,
} from '../../rca-case/rca-case-commands.service';
import { RcaCasesService } from '../../rca-case/rca-cases.service';
import { RcaEvidenceOptionsV2View } from '../../rca-case/rca-evidence-options';
import {
  RcaCaseSummaryV2View as RcaCaseListItemV2View,
  RcaCaseV2View,
} from '../../rca-case/rca-case.view';
import { RCA_WRITERS } from '../../rca-case/rca-scope';
import { ListResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import {
  RcaCaseV2CreateDto,
  RcaCaseV2ListQueryDto,
  RcaCaseV2UpdateDto,
} from './rca-cases-v2.dto';

const SCOPE =
  'Writers: reliability engineer or manager approver. A unit-limited writer names a unit of its scope ' +
  '(422 INVALID_REFERENCE otherwise; 403 TENANT_SCOPE_REQUIRED for a case without unit).';

/**
 * RCA cases (plan 3.9, RCA02, §16.2): the redesigned v2 contract (fixes the v1 save mismatch) with
 * nested recommendations, evidence and logic tree; existing-case search; outcome with the three
 * separate figures of RCA03.
 */
@ApiTags('v2 · RCA')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'rcas', version: '2' })
export class RcaCasesV2Controller {
  constructor(
    private readonly cases: RcaCasesService,
    private readonly actions: RcaActionsService,
    private readonly commands: RcaCaseCommandsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Search cases of your scope (newest first)',
    description:
      'Filters: status, unit, asset (case asset or a linked event), reason of a linked event, window of a linked event (from/to), title (q).',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: RcaCaseV2ListQueryDto,
  ): Promise<ListResponse<RcaCaseListItemV2View>> {
    return this.cases.list(ctx, query);
  }

  @Get('summary')
  @ApiOperation({
    summary:
      'Counts of the cases of your scope by status, overdue and open critical',
  })
  summary(@Ctx() ctx: RequestContext): Promise<RcaCaseSummaryV2View> {
    return this.commands.summary(ctx);
  }

  @Get('evidence-options')
  @ApiOperation({
    summary:
      'Evidence categories and locations of the tenant (pick lists of the evidence form)',
  })
  evidenceOptions(
    @Ctx() ctx: RequestContext,
  ): Promise<RcaEvidenceOptionsV2View> {
    return this.commands.evidenceOptions(ctx);
  }

  @Get(':id')
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary:
      'One case with its nested content (ETag = rowVersion); foreign ids are 404',
  })
  get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<RcaCaseV2View> {
    return this.cases.get(ctx, id);
  }

  @Post()
  @Idempotent()
  @Roles(...RCA_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Open a case',
    description: `Requires \`Idempotency-Key\`. ${SCOPE}`,
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  create(
    @Ctx() ctx: RequestContext,
    @Body() body: RcaCaseV2CreateDto,
  ): Promise<RcaCaseV2View> {
    return this.cases.create(ctx, body);
  }

  @Patch(':id')
  @Roles(...RCA_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Change a case (nested content replaced as sent)',
    description:
      `Requires \`If-Match\` (428/412). ${SCOPE} Setting status Closed feeds the knowledge base (unpublished ` +
      'entry) and marks linked events RCA completed.',
  })
  @ApiHeader({ name: 'If-Match', required: true })
  update(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @IfMatch() expectedRowVersion: number,
    @Body() body: RcaCaseV2UpdateDto,
  ): Promise<RcaCaseV2View> {
    return this.cases.update(ctx, { id, expectedRowVersion }, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...RCA_WRITERS)
  @ApiOperation({
    summary: 'Delete an open case nothing refers to yet',
    description:
      `Requires \`If-Match\` (428/412). ${SCOPE} 409 RCA_CASE_IN_USE once the case is closed, linked, has ` +
      'actions or a recommendation or knowledge entry points at it. Analysis records go with the case.',
  })
  @ApiHeader({ name: 'If-Match', required: true })
  remove(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @IfMatch() expectedRowVersion: number,
  ): Promise<void> {
    return this.commands.remove(ctx, { id, expectedRowVersion });
  }

  @Post(':id/logic-tree/reset')
  @Roles(...RCA_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: "Replace the logic tree with a fresh copy of the case's template",
    description: `Requires \`If-Match\` (428/412). ${SCOPE} 422 NO_TEMPLATE for a case opened without a template.`,
  })
  @ApiHeader({ name: 'If-Match', required: true })
  resetLogicTree(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @IfMatch() expectedRowVersion: number,
  ): Promise<RcaCaseV2View> {
    return this.commands.resetLogicTree(ctx, { id, expectedRowVersion });
  }

  @Get(':id/outcome')
  @ApiOperation({
    summary:
      'Approved historical loss, claimed avoided loss and realized difference (kept apart)',
  })
  outcome(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<RcaOutcomeV2View> {
    return this.actions.outcome(ctx, id);
  }
}
